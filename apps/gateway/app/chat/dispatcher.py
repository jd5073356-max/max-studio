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

_FINANCE_KEYWORDS = (
    "gasto", "ingreso", "cuenta", "balance", "saldo", "proyecto", "presupuesto",
    "dinero", "plata", "ahorro", "préstamo", "prestamo", "pago", "cobro",
    "finance", "finanza", "actualiza", "agrega", "quita", "registra", "elimina",
    "autoflow", "casaflow", "restaurante", "spotify", "computador", "pasaje",
    "deuda", "inversión", "inversion", "cuánto tengo", "cuanto tengo",
)

# Instrucciones compactas que se inyectan en el mensaje cuando hay contexto finance
_FINANCE_INJECT_TEMPLATE = """[SISTEMA: FINANCE HUB ACTIVO]
Datos financieros actuales de Juan David:
{finance_lines}

INSTRUCCIÓN CRÍTICA: Si el usuario pide agregar, quitar o actualizar datos financieros, incluye OBLIGATORIAMENTE al final de tu respuesta un bloque así (el sistema lo ejecuta en silencio, el usuario NO lo ve):

```finance_action
{{"action": "<accion>", "payload": {{...}}}}
```

Acciones disponibles (elige la correcta):
- update_account → payload: {{"id":"<uuid>","balance":<número>}}
- update_project → payload: {{"id":"<uuid>","monthly_income":<número>,"status":"active|pending"}}
- create_expense_category → payload: {{"name":"<nombre>","budget_limit":<número>,"color":"#hex"}}
- update_expense_category → payload: {{"id":"<uuid>","budget_limit":<número>}}
- add_ledger → payload: {{"entity_id":"<uuid>","entity_type":"account|project|category","amount":<número>,"currency":"COP","note":"<descripcion>"}}

REGLA: Si debes hacer varios cambios, pon VARIOS bloques finance_action, uno por acción. No expliques el bloque al usuario.
[FIN SISTEMA]

MENSAJE DEL USUARIO:
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


async def _get_finance_lines() -> list[str]:
    """Retorna líneas de estado financiero con cache de 10 min."""
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

    lines = []
    for acc in state.get("accounts", []):
        lines.append(f"- Cuenta '{acc['name']}' ({acc['account_type']}): ${float(acc['balance']):,.0f} COP [id:{acc['id']}]")
    for p in state.get("projects", []):
        meta = p.get("metadata") or {}
        lines.append(f"- Proyecto '{p['name']}' ({p['status']}): ${float(p['monthly_income']):,.0f} COP/mes [id:{p['id']}] meta_mensual:{meta.get('meta_mensual',0):,.0f}")
    for c in state.get("categories", []):
        lines.append(f"- Categoria gasto '{c['name']}': presupuesto ${float(c['budget_limit']):,.0f} COP [id:{c['id']}]")
    return lines


def _is_finance_message(content: str) -> bool:
    low = content.lower()
    return any(kw in low for kw in _FINANCE_KEYWORDS)


async def _enrich_with_finance(content: str) -> str:
    """Si el mensaje es de finanzas, antepone el contexto con instrucciones."""
    if not _is_finance_message(content):
        return content
    lines = await _get_finance_lines()
    if not lines:
        return content
    return _FINANCE_INJECT_TEMPLATE.format(finance_lines="\n".join(lines)) + content


async def _get_finance_context() -> str:
    """Para system prompt (fallback Anthropic)."""
    lines = await _get_finance_lines()
    if not lines:
        return ""
    return "## Finance Hub\n" + "\n".join(lines)


async def _get_skills_context(content: str) -> str:
    """Busca skills relevantes para el mensaje y retorna contexto para el prompt."""
    try:
        from app.memory.skills import search_skills
        matches = await search_skills(content, top_k=2)
        if not matches:
            return ""
        lines = [f"## Skill relevante: {m['content'][:800]}" for m in matches]
        return "\n\n---\n\n# Skills Relevantes:\n" + "\n\n".join(lines)
    except Exception:
        return ""


async def _build_system_prompt(content: str = "") -> str:
    """Construye el system prompt para fallback Anthropic."""
    ctx = await _get_claude_md_context()
    finance_ctx = await _get_finance_context()
    skills_ctx = await _get_skills_context(content) if content else ""
    prompt = BASE_SYSTEM_PROMPT
    if ctx:
        prompt += "\n\n---\n\n# Contexto MAX (CLAUDE.md):\n\n" + ctx[:6000]
    if finance_ctx:
        prompt += "\n\n---\n\n" + finance_ctx
    if skills_ctx:
        prompt += skills_ctx
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
    enriched = await _enrich_with_finance(content)

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{settings.dispatch_url}/dispatch",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"message": enriched},
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
    system = await _build_system_prompt(content)

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


async def _via_kimi_stream(
    content: str,
    history: list[dict[str, str]],
    settings,
) -> AsyncGenerator[str, None]:
    """Kimi K2.5 vía Moonshot API — respuesta word-by-word simulada."""
    from app.kimi.client import generate_text as kimi_generate
    system = await _build_system_prompt(content)
    # Incluir historial en el prompt cuando Kimi no tiene API de multi-turn aquí
    hist_text = ""
    for msg in history[-6:]:
        role = "Juan" if msg["role"] == "user" else "MAX"
        hist_text += f"{role}: {msg['content']}\n"
    full_prompt = f"{hist_text}Juan: {content}\nMAX:"
    reply = await kimi_generate(prompt=full_prompt, system=system)
    words = reply.split(" ")
    for i, word in enumerate(words):
        yield word + (" " if i < len(words) - 1 else "")


async def stream_response(
    content: str,
    history: list[dict[str, str]],
    *,
    model: str | None = None,
) -> AsyncGenerator[str, None]:
    """Punto de entrada principal.

    Routing:
      - model='kimi-k2.5'      → Moonshot API directo
      - model='claude-*'       → Anthropic directo con ese model ID
      - model='gpt-oss:120b'   → Dispatch (lo enruta a nivel 2)
      - model=None / 'auto'    → Dispatch → fallback Anthropic
    """
    settings = get_settings()

    # Brain Switcher: Kimi explícito
    if model and model.startswith("kimi"):
        try:
            async for token in _via_kimi_stream(content, history, settings):
                yield token
            return
        except Exception as exc:
            logger.error("Kimi direct failed (%s) — fallback to Dispatch", exc)

    # Brain Switcher: Claude explícito → bypass Dispatch
    if model and model.startswith("claude"):
        async for token in _via_anthropic(content, history, settings, model):
            yield token
        return

    # Default: Dispatch (con fallback a Anthropic)
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
            async for token in _via_anthropic(content, history, settings, model):
                yield token
    else:
        logger.warning(
            "DISPATCH_SECRET no configurado — usando Anthropic directo. "
            "Agrega DISPATCH_SECRET=MAX_SUPER_SECRET_2026 al .env del gateway y reinicia."
        )
        async for token in _via_anthropic(content, history, settings, model):
            yield token
