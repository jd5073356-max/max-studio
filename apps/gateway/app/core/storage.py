"""Utilidad de almacenamiento: si un archivo supera 5MB lo sube a Supabase Storage
y retorna una signed URL (1h). Archivos pequeños se sirven directo desde /tmp.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

SIZE_THRESHOLD_BYTES = 5 * 1024 * 1024  # 5 MB
BUCKET = "max-docs"
SIGNED_URL_EXPIRY = 3600  # 1 hora


async def upload_to_storage(filepath: Path, dest_name: str) -> str:
    """Sube el archivo a Supabase Storage y retorna la signed URL.

    Levanta excepción si Supabase Storage no responde.
    """
    settings = get_settings()
    base = settings.supabase_url.rstrip("/")
    headers = {
        "apikey": settings.supabase_service_key,
        "Authorization": f"Bearer {settings.supabase_service_key}",
    }

    file_bytes = await asyncio.to_thread(filepath.read_bytes)
    content_type = _guess_mime(filepath.suffix.lstrip("."))

    # Upload
    upload_url = f"{base}/storage/v1/object/{BUCKET}/{dest_name}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            upload_url,
            content=file_bytes,
            headers={**headers, "Content-Type": content_type},
        )
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Storage upload failed: {resp.status_code} {resp.text[:200]}")

        # Create signed URL
        sign_url = f"{base}/storage/v1/object/sign/{BUCKET}/{dest_name}"
        sign_resp = await client.post(
            sign_url,
            json={"expiresIn": SIGNED_URL_EXPIRY},
            headers={**headers, "Content-Type": "application/json"},
        )
        if sign_resp.status_code != 200:
            raise RuntimeError(f"Sign URL failed: {sign_resp.status_code}")

        signed = sign_resp.json().get("signedURL", "")
        return f"{base}/storage/v1{signed}" if signed.startswith("/") else signed


async def maybe_offload(filepath: Path, dest_name: str) -> str | None:
    """Si el archivo supera el umbral, lo sube a Supabase Storage y retorna la URL.

    Retorna None si el archivo es pequeño (se sirve directo desde el endpoint /download).
    """
    try:
        size = await asyncio.to_thread(filepath.stat().st_size.__class__, filepath.stat().st_size)
        # Re-check using sync stat in thread
        size_bytes = await asyncio.to_thread(lambda: filepath.stat().st_size)
    except Exception:
        return None

    if size_bytes <= SIZE_THRESHOLD_BYTES:
        return None

    try:
        url = await upload_to_storage(filepath, dest_name)
        logger.info("Large file offloaded to Supabase Storage: %s (%d bytes)", dest_name, size_bytes)
        return url
    except Exception as exc:
        logger.warning("Storage offload failed for %s: %s — serving from local", dest_name, exc)
        return None


def _guess_mime(ext: str) -> str:
    MIMES = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "md": "text/markdown",
        "txt": "text/plain",
        "json": "application/json",
        "csv": "text/csv",
    }
    return MIMES.get(ext, "application/octet-stream")
