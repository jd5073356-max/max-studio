"""Dispatcher de chat — routing via Dispatch :8001.

Dispatch clasifica el mensaje y enruta al modelo correcto:
  nivel 1: minimax-m2.7:cloud  (respuesta rápida)
  nivel 2: gpt-oss:120b / qwen3.5  (normal)
  nivel 3: kimi-k2.5 / lead  (complejo)
  nivel 4: claude-sonnet/opus  (razonamiento profundo)

El gateway NO llama a Anthropic directamente — eso le corresponde a Dispatch.
Fallback a Anthropic solo si DISPATCH_SECRET no está configurado (modo dev).
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timedelta
from typing import AsyncGenerator

import httpx
from jose import jwt as jose_jwt

from app.core.config import get_settings
from app.core.supabase import SupabaseRest
from app.finance.routes import get_finance_state

logger = logging.getLogger(__name__)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MAX_TOKENS = 8192

BASE_SYSTEM_PROMPT = (
    "Eres MAX, el asistente IA personal de Juan David. "
    "Responde en español o en el idioma del usuario. "
    "Puedes usar markdown, tablas, bloques de código y diagramas mermaid."
)

# Cache del CLAUDE.md leído desde Supabase (TTL 10 min)
_claude_md_cache: dict = {"content": "", "ts": 0.0}
_finance_cache: dict = {"state": {}, "ts": 0.0}
_CACHE_TTL = 600  # segundos

FINANCE_TOOLS_PROMPT = """
## Finance Hub — Herramientas disponibles

Tienes acceso en tiempo real a los datos financieros de Juan David.
Puedes consultarlos, analizarlos y modificarlos.

### Estado actual:
{finance_state}

### Cómo actualizar datos
Si el usuario pide actualizar sus finanzas, incluye al FINAL de tu respuesta un bloque como este (el sistema lo ejecuta automáticamente, el usuario NO lo ve):

```finance_action
{{"action": "update_account", "payload": {{"id": "<uuid>", "balance": <nuevo_saldo>}}}}
```

Acciones disponibles:
- `update_account` → {{"id": "uuid", "balance": 560000, "institution": "opcional"}}
- `update_project` → {{"id": "uuid", "monthly_income": 150000, "status": "active"}}
- `add_ledger` → {{"entity_id": "uuid", "entity_type": "account|project|category", "amount": 70000, "recorded_at": "2026-04-23"}}
- `update_expense_category` → {{"id": "uuid", "budget_limit": 200000}}

Reglas:
- Solo incluye el bloque `finance_action` si el usuario pide explícitamente cambiar o registrar datos.
- Para análisis y opiniones, responde normalmente sin el bloque.
- Puedes incluir múltiples bloques si se necesitan varios cambios.
"""


async def _get_claude_md_context() -> str:
    """Obtiene el CLAUDE.md desde Supabase con cache de 10 min."""
    now = time.monotonic()
    if now - _claude_md_cache["ts"] < _CACHE_TTL and _claude_md_cache["content"]:
        return _claude_md_cache["content"]
    try:
        sb = SupabaseRest()
        rows = await sb.select_many(
            "knowledge",
            filters={"category": "claude_md"},
            columns="content",
            limit=1,
        )
        if rows and rows[0].get("content"):
            _claude_md_cache["content"] = rows[0]["content"]
            _claude_md_cache["ts"] = now
    except Exception:
        pass
    return _claude_md_cache["content"]


async def _get_finance_context() -> str:
    """Obtiene estado financiero con cache de 10 min."""
    now = time.monotonic()
    if now - _finance_cache["ts"] < _CACHE_TTL and _finance_cache["state"]:
        state = _finance_cache["state"]
    else:
        try:
            state = await get_finance_state()
            _finance_cache["state"] = state
            _finance_cache["ts"] = now
        except Exception:
            state = {}

    if not state:
        return ""

    lines = []
    for acc in state.get("accounts", []):
        lines.append(f"- Cuenta '{acc['name']}' ({acc['account_type']}): ${acc['balance']:,.0f} COP [id:{acc['id']}]")
    for p in state.get("projects", []):
        meta = p.get("metadata") or {}
        lines.append(f"- Proyecto '{p['name']}' ({p['status']}): ${p['monthly_income']:,.0f} COP/mes [id:{p['id']}] meta:{meta.get('meta_mensual',0):,.0f}")
    for c in state.get("categories", []):
        lines.append(f"- Gasto '{c['name']}': presupuesto ${c['budget_limit']:,.0f} COP [id:{c['id']}]")

    return FINANCE_TOOLS_PROMPT.format(finance_state="\n".join(lines))


async def _build_system_prompt() -> str:
    """Construye el system prompt enriquecido con CLAUDE.md y finanzas."""
    ctx = await _get_claude_md_context()
    finance_ctx = await _get_finance_context()
    prompt = BASE_SYSTEM_PROMPT
    if ctx:
        prompt += "\n\n---\n\n# Contexto MAX (CLAUDE.md):\n\n" + ctx[:6000]
    if finance_ctx:
        prompt += "\n\n---\n\n" + finance_ctx
    return prompt


SYSTEM_PROMPT = BASE_SYSTEM_PROMPT  # alias para retrocompatibilidad


def _create_dispatch_token(secret: str) -> str:
    """Genera JWT HS256 compatible con el verify_jwt de Dispatch."""
    now = datetime.utcnow()
    payload = {
        "sub": "max-studio-gateway",
        "iat": now,
        "exp": now + timedelta(hours=1),
    }
    return jose_jwt.encode(payload, secret, algorithm="HS256")


async def _via_dispatch(content: str, settings) -> AsyncGenerator[str, None]:
    """Llama a Dispatch y simula streaming por palabras."""
    token = _create_dispatch_token(settings.dispatch_secret)

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{settings.dispatch_url}/dispatch",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"message": content},
        )

    if resp.status_code != 200:
        raise ValueError(f"Dispatch {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    reply: str = data.get("reply", "").strip()
    if not reply:
        raise ValueError("Dispatch no retornó respuesta")

    logger.info(
        "Dispatch OK — nivel=%s pi=%s claude=%s",
        data.get("level"),
        data.get("models_used", {}).get("pi"),
        data.get("models_used", {}).get("claude"),
    )

    # Simular streaming: yield palabra a palabra
    words = reply.split(" ")
    for i, word in enumerate(words):
        yield word + (" " if i < len(words) - 1 else "")


async def _via_anthropic(
    content: str,
    history: list[dict[str, str]],
    settings,
    model: str | None,
) -> AsyncGenerator[str, None]:
    """Fallback directo a Anthropic (solo si DISPATCH_SECRET no está configurado)."""
    api_key = settings.anthropic_api_key
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY no configurado. "
            "Agregar en apps/gateway/.env y reiniciar el servidor."
        )

    used_model = model or settings.default_model
    messages = [*history, {"role": "user", "content": content}]
    system = await _build_system_prompt()

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": used_model,
        "max_tokens": MAX_TOKENS,
        "system": system,
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

                if event.get("type") == "content_block_delta":
                    delta = event.get("delta", {})
                    if delta.get("type") == "text_delta":
                        text = delta.get("text", "")
                        if text:
                            yield text


async def stream_response(
    content: str,
    history: list[dict[str, str]],
    *,
    model: str | None = None,
) -> AsyncGenerator[str, None]:
    """Punto de entrada principal.

    Prioridad:
      1. Dispatch :8001 (si DISPATCH_SECRET está configurado)
      2. Anthropic directo (fallback — logueado como WARNING)
    """
    settings = get_settings()

    if settings.dispatch_secret:
        try:
            async for token in _via_dispatch(content, settings):
                yield token
            return
        except Exception as exc:
            logger.error(
                "Dispatch falló (%s) — usando Anthropic como fallback. "
                "Verifica que DISPATCH_URL=%s sea accesible desde el gateway.",
                exc,
                settings.dispatch_url,
            )
            # Fallback automático a Anthropic si Dispatch no responde
            async for token in _via_anthropic(content, history, settings, model):
                yield token
    else:
        logger.warning(
            "DISPATCH_SECRET no configurado — usando Anthropic directo. "
            "Agrega DISPATCH_SECRET=MAX_SUPER_SECRET_2026 al .env del gateway y reinicia."
        )
        async for token in _via_anthropic(content, history, settings, model):
            yield token
