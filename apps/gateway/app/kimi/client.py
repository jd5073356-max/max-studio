"""Cliente Kimi K2.6 (Moonshot AI) — API compatible con OpenAI.

Endpoints usados:
  POST https://api.moonshot.cn/v1/chat/completions

Capacidades habilitadas aquí:
  - Vision: imagen en base64 + texto
  - Thinking: razonamiento profundo (para Fase D - Proyectos)
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

MOONSHOT_BASE_URL = "https://api.moonshot.ai/v1"


async def generate_text(
    prompt: str,
    system: str = "",
    thinking: bool = False,
) -> str:
    """Genera texto con Kimi K2.6 (sin imagen). Útil para docs complejos."""
    settings = get_settings()
    if not settings.moonshot_api_key:
        raise ValueError("MOONSHOT_API_KEY no configurada")

    messages: list[dict] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    # kimi-k2.x solo acepta temperature=1; modelos moonshot-v1-* aceptan 0-1
    temp = 1 if settings.moonshot_model.startswith("kimi") else 0.3
    payload: dict[str, Any] = {
        "model": settings.moonshot_model,
        "messages": messages,
        "max_tokens": 8192,
        "temperature": temp,
    }

    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            f"{MOONSHOT_BASE_URL}/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.moonshot_api_key}",
                "Content-Type": "application/json",
            },
        )

    if resp.status_code != 200:
        logger.error("Kimi API error %s: %s", resp.status_code, resp.text[:300])
        raise RuntimeError(f"Kimi API error {resp.status_code}: {resp.text[:200]}")

    data = resp.json()
    content: str = data["choices"][0]["message"]["content"]
    logger.info("Kimi text OK tokens=%s", data.get("usage", {}).get("total_tokens"))
    return content


async def analyze_image(
    message: str,
    image_base64: str,
    mime_type: str = "image/jpeg",
) -> str:
    """Manda imagen + texto a Kimi K2.6 y retorna la respuesta completa."""
    settings = get_settings()
    if not settings.moonshot_api_key:
        raise ValueError("MOONSHOT_API_KEY no configurada")

    temp = 1 if settings.moonshot_model.startswith("kimi") else 0.3
    payload: dict[str, Any] = {
        "model": settings.moonshot_model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_base64}",
                        },
                    },
                    {
                        "type": "text",
                        "text": message or "Analiza esta imagen y describe todo lo que ves.",
                    },
                ],
            }
        ],
        "max_tokens": 4096,
        "temperature": temp,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{MOONSHOT_BASE_URL}/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.moonshot_api_key}",
                "Content-Type": "application/json",
            },
        )

    if resp.status_code != 200:
        logger.error("Kimi API error %s: %s", resp.status_code, resp.text[:300])
        raise RuntimeError(f"Kimi API error {resp.status_code}: {resp.text[:200]}")

    data = resp.json()
    content: str = data["choices"][0]["message"]["content"]
    model_used: str = data.get("model", settings.moonshot_model)
    logger.info("Kimi vision OK model=%s tokens=%s", model_used, data.get("usage", {}).get("total_tokens"))
    return content
