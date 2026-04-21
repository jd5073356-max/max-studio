"""Endpoints Kimi K2.6 — visión y (futuro) orquestación de proyectos.

POST /vision/analyze  — imagen + texto → respuesta de Kimi K2.6
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.deps import CurrentUser
from app.kimi.client import analyze_image

router = APIRouter(prefix="/vision", tags=["kimi"])


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
