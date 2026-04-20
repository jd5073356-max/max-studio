"""Documentos generados por MAX — Step 12.

GET  /docs           — lista de documentos generados
POST /docs/generate  — solicitar generación (LLM → archivo → Supabase)
GET  /docs/{id}/download — descargar el documento
"""

from __future__ import annotations

import os
import textwrap
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.auth.jwt import create_access_token
from app.chat.dispatcher import stream_response
from app.core.config import get_settings
from app.core.deps import CurrentUser, SupabaseDep

router = APIRouter(prefix="/docs", tags=["docs"])

DOCS_DIR = Path("/tmp/max-docs")
DOCS_DIR.mkdir(exist_ok=True)

MIME_TYPES = {
    "md": "text/markdown",
    "html": "text/html",
    "txt": "text/plain",
}


class GenerateRequest(BaseModel):
    title: str
    format: str = "md"   # md | html | txt
    prompt: str


# ── Lista ─────────────────────────────────────────────────────────────────────

@router.get("")
async def list_docs(
    user: CurrentUser,  # noqa: ARG001
    sb: SupabaseDep,
) -> list[dict[str, Any]]:
    """Devuelve documentos generados, más recientes primero."""
    return await sb.select_many(
        "generated_docs",
        columns="id,filename,mime_type,size_bytes,created_at",
        order="created_at.desc",
        limit=100,
    )


# ── Generación ────────────────────────────────────────────────────────────────

@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_doc(
    body: GenerateRequest,
    user: CurrentUser,  # noqa: ARG001
    sb: SupabaseDep,
) -> dict[str, Any]:
    """Genera un documento usando el LLM y lo guarda en disco + Supabase."""
    settings = get_settings()
    fmt = body.format.lower().strip(".")
    if fmt not in MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato no soportado: {fmt}. Usar: md, html, txt",
        )

    # Llamar al LLM para generar el contenido
    system_hint = {
        "md": "Responde en Markdown limpio, sin bloques de código extra.",
        "html": "Responde solo con el contenido del <body> en HTML semántico, sin <html>/<head>.",
        "txt": "Responde en texto plano, bien formateado.",
    }[fmt]

    full_prompt = (
        f"Genera un documento con el título: {body.title!r}.\n\n"
        f"Instrucción: {body.prompt}\n\n"
        f"Formato: {system_hint}"
    )

    content = ""
    async for token in stream_response(full_prompt, [], model=settings.default_model):
        content += token

    if not content.strip():
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="El LLM no devolvió contenido",
        )

    # Guardar en disco
    safe_title = "".join(c if c.isalnum() or c in "-_ " else "_" for c in body.title)[:40]
    filename = f"{safe_title.replace(' ', '_')}_{uuid.uuid4().hex[:6]}.{fmt}"
    filepath = DOCS_DIR / filename
    filepath.write_text(content, encoding="utf-8")
    size = filepath.stat().st_size

    # Guardar referencia en Supabase
    row = await sb.insert(
        "generated_docs",
        {
            "filename": filename,
            "mime_type": MIME_TYPES[fmt],
            "storage_path": str(filepath),
            "size_bytes": size,
        },
    )

    return {
        "id": (row or {}).get("id"),
        "filename": filename,
        "size_bytes": size,
        "preview": textwrap.shorten(content, width=300, placeholder="…"),
    }


# ── Descarga ──────────────────────────────────────────────────────────────────

@router.get("/{doc_id}/download")
async def download_doc(
    doc_id: str,
    user: CurrentUser,  # noqa: ARG001
    sb: SupabaseDep,
) -> FileResponse:
    """Descarga un documento generado."""
    row = await sb.select_one("generated_docs", {"id": doc_id})
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado")

    path = Path(row["storage_path"])
    if not path.exists():
        raise HTTPException(
            status_code=status.HTTP_410_GONE, detail="Archivo eliminado del servidor"
        )

    return FileResponse(
        path=str(path),
        media_type=row["mime_type"],
        filename=row["filename"],
    )
