"""Dispatcher de chat — streaming vía Anthropic API.

Para Step 9 se añadirá routing a través de Dispatch :8001 (multi-LLM).
Por ahora: httpx directo a Anthropic con SSE streaming.
"""

from __future__ import annotations

import json
import logging
from typing import AsyncGenerator

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MAX_TOKENS = 8192

SYSTEM_PROMPT = (
    "Eres MAX, el asistente IA personal de Juan David. "
    "Responde en español o en el idioma del usuario. "
    "Puedes usar markdown, tablas, bloques de código y diagramas mermaid."
)


async def stream_response(
    content: str,
    history: list[dict[str, str]],
    *,
    model: str | None = None,
) -> AsyncGenerator[str, None]:
    """Llama Anthropic con streaming y hace yield de fragmentos de texto.

    Args:
        content: mensaje del usuario (NO incluido en history).
        history: historial previo en formato Anthropic [{role, content}].
        model: modelo a usar. Si None, usa default_model del .env.

    Yields:
        Fragmentos de texto conforme llegan del stream SSE.

    Raises:
        ValueError: si ANTHROPIC_API_KEY no está configurado o la API responde error.
    """
    settings = get_settings()
    api_key = settings.anthropic_api_key
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY no configurado. "
            "Agregar en apps/gateway/.env y reiniciar el servidor."
        )

    used_model = model or settings.default_model
    messages = [*history, {"role": "user", "content": content}]

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": used_model,
        "max_tokens": MAX_TOKENS,
        "system": SYSTEM_PROMPT,
        "messages": messages,
        "stream": True,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", ANTHROPIC_URL, headers=headers, json=body) as resp:
            if resp.status_code != 200:
                err = await resp.aread()
                raise ValueError(f"Anthropic {resp.status_code}: {err.decode()[:300]}")

            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                payload = line[6:]
                if payload.strip() == "[DONE]":
                    break
                try:
                    event = json.loads(payload)
                except json.JSONDecodeError:
                    continue

                # content_block_delta → text_delta contiene el token
                if event.get("type") == "content_block_delta":
                    delta = event.get("delta", {})
                    if delta.get("type") == "text_delta":
                        text = delta.get("text", "")
                        if text:
                            yield text
