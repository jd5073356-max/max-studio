"""Endpoints Kimi K2.6 — visión + orquestación de proyectos.

POST /vision/analyze       — imagen + texto → Kimi K2.6
POST /kimi/project         — proyecto en lenguaje natural → archivos + ZIP
GET  /kimi/project/{id}/download — descarga ZIP del proyecto
"""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.deps import CurrentUser
from app.core.ws_manager import manager
from app.kimi.client import analyze_image
from app.kimi.orchestrator import PROJECTS_DIR, run_project

router = APIRouter(tags=["kimi"])

# ── Vision ─────────────────────────────────────────────────────────────────────

class VisionRequest(BaseModel):
    message: str = Field(default="", max_length=4000)
    image_base64: str = Field(..., description="Imagen en base64 sin prefijo data:")
    mime_type: str = Field(default="image/jpeg", description="MIME type de la imagen")


class VisionResponse(BaseModel):
    content: str
    model: str


@router.post("/analyze", response_model=VisionResponse)
async def analyze(
    body: VisionRequest,
    _user: CurrentUser,
) -> VisionResponse:
    """Analiza una imagen con Kimi K2.6 y retorna la descripción/análisis."""
    settings = get_settings()
    if not settings.moonshot_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Kimi K2.6 no configurado — falta MOONSHOT_API_KEY",
        )

    # Validación básica: base64 no vacío y tamaño razonable (<10MB decoded)
    if not body.image_base64:
        raise HTTPException(status_code=400, detail="image_base64 vacío")
    if len(body.image_base64) > 14_000_000:  # ~10MB en base64
        raise HTTPException(status_code=413, detail="Imagen demasiado grande (máx 10MB)")

    try:
        content = await analyze_image(
            message=body.message,
            image_base64=body.image_base64,
            mime_type=body.mime_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return VisionResponse(content=content, model=settings.moonshot_model)


# ── Modo Proyecto ──────────────────────────────────────────────────────────────

class ProjectRequest(BaseModel):
    prompt: str = Field(..., min_length=10, max_length=4000, description="Descripción del proyecto")
    title: str = Field(default="", max_length=100)


class ProjectStarted(BaseModel):
    project_id: str
    message: str


async def _run_and_notify(project_id: str, user_id: str, prompt: str) -> None:
    """Corre el proyecto en background y emite project.done / project.error."""
    try:
        result = await run_project(project_id, user_id, prompt)
        await manager.send(user_id, {
            "type": "project.done",
            "project_id": project_id,
            "summary": result["summary"],
            "files": result["files"],
            "zip_ready": result["zip_path"] is not None,
            "rounds": result["rounds"],
        })
    except Exception as exc:
        await manager.send(user_id, {
            "type": "project.error",
            "project_id": project_id,
            "detail": str(exc),
        })


@router.post("/kimi/project", response_model=ProjectStarted, status_code=status.HTTP_202_ACCEPTED)
async def start_project(
    body: ProjectRequest,
    user: CurrentUser,
    background_tasks: BackgroundTasks,
) -> ProjectStarted:
    """Inicia un proyecto en background. El progreso llega por WebSocket."""
    settings = get_settings()
    if not settings.moonshot_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Kimi K2.6 no configurado — falta MOONSHOT_API_KEY",
        )

    project_id = uuid.uuid4().hex[:12]
    user_id: str = user["id"]

    background_tasks.add_task(_run_and_notify, project_id, user_id, body.prompt)

    return ProjectStarted(
        project_id=project_id,
        message=f"Proyecto iniciado. Recibirás actualizaciones en tiempo real.",
    )


@router.get("/kimi/project/{project_id}/download")
async def download_project(
    project_id: str,
    _user: CurrentUser,
) -> FileResponse:
    """Descarga el ZIP del proyecto generado."""
    # Validar que el project_id es alfanumérico (seguridad path traversal)
    if not project_id.isalnum():
        raise HTTPException(status_code=400, detail="ID inválido")

    zip_path = PROJECTS_DIR / project_id / "proyecto.zip"
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="ZIP no encontrado — el proyecto aún está en progreso")

    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename=f"proyecto_{project_id}.zip",
    )
