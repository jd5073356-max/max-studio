"""WebSocket endpoint /ws — autenticado por cookie max_auth."""

from __future__ import annotations

import json
import logging
import re
import uuid

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.auth.jwt import InvalidToken, decode_token
from app.chat.dispatcher import stream_response
from app.chat.task_detector import detect_task
from app.core.config import get_settings
from app.core.supabase import SupabaseRest
from app.core.ws_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ws"])

_FINANCE_BLOCK_RE = re.compile(r"```finance_action\s*(.*?)\s*```", re.DOTALL)


def _strip_finance_blocks(text: str) -> str:
    """Elimina bloques finance_action del texto visible."""
    return _FINANCE_BLOCK_RE.sub("", text).strip()


async def _execute_finance_actions(user_id: str, response_text: str) -> list[dict]:
    """Detecta y ejecuta bloques finance_action. Retorna lista de resultados."""
    blocks = _FINANCE_BLOCK_RE.findall(response_text)
    if not blocks:
        return []

    results = []
    async with httpx.AsyncClient(timeout=10.0) as client:
        for block in blocks:
            try:
                action_data = json.loads(block)
                resp = await client.post(
                    "http://localhost:8003/finance/action",
                    json=action_data,
                )
                result = resp.json()
                results.append(result)
                logger.info("finance_action executed user=%s action=%s", user_id, action_data.get("action"))
            except Exception as exc:
                logger.error("finance_action failed user=%s: %s", user_id, exc)
                results.append({"ok": False, "error": str(exc)})

    return results


async def handle_chat_send(user_id: str, data: dict) -> None:
    """Procesa evento chat.send: guarda mensaje, llama LLM, streamea respuesta."""
    content: str = (data.get("content") or "").strip()
    if not content:
        return

    session_id = str(uuid.uuid4())
    sb = SupabaseRest()
    settings = get_settings()

    # 1. Cargar historial previo ANTES de insertar el nuevo mensaje
    history_rows = await sb.select_many(
        "conversations",
        {"engine": "pwa"},
        columns="role,content",
        order="created_at.desc",
        limit=20,
    )
    # Revertir a orden cronológico para el LLM
    history = [
        {"role": r["role"], "content": r["content"]}
        for r in reversed(history_rows)
    ]

    # 2. Guardar mensaje de usuario en Supabase (sin bloquear el stream)
    await sb.insert(
        "conversations",
        {"engine": "pwa", "role": "user", "content": content},
        returning=False,
    )

    # 3. Streaming de respuesta LLM
    full_response = ""
    try:
        async for token in stream_response(content, history, model=settings.default_model):
            await manager.send(
                user_id,
                {"type": "chat.token", "session_id": session_id, "token": token},
            )
            full_response += token

    except Exception as exc:
        logger.error("chat stream error user=%s: %s", user_id, exc)
        await manager.send(
            user_id,
            {"type": "chat.error", "session_id": session_id, "detail": str(exc)},
        )
        return

    # 4. Ejecutar finance_actions si MAX incluyó bloques
    finance_results = await _execute_finance_actions(user_id, full_response)
    visible_response = _strip_finance_blocks(full_response)

    # Notificar al frontend que actualice el Finance Hub
    if finance_results:
        await manager.send(
            user_id,
            {"type": "finance.updated", "actions": finance_results},
        )
        # Invalida cache de finanzas para que el próximo mensaje tenga datos frescos
        from app.chat.dispatcher import _finance_cache
        _finance_cache["ts"] = 0.0

    # 5. Guardar respuesta visible (sin bloques de acción)
    assistant_row = await sb.insert(
        "conversations",
        {"engine": "pwa", "role": "assistant", "content": visible_response},
    )

    await manager.send(
        user_id,
        {
            "type": "chat.done",
            "session_id": session_id,
            "model_used": settings.default_model,
            "conversation_id": (assistant_row or {}).get("id", session_id),
        },
    )

    # 5. Detectar intent de tarea programada en el mensaje del usuario
    try:
        task_data = await detect_task(content)
        if task_data:
            created = await sb.insert("scheduled_tasks", task_data)
            task_id = (created or {}).get("id", str(uuid.uuid4()))
            days_labels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
            days_str = ", ".join(days_labels[d] for d in sorted(task_data["days"]))
            h, m = task_data["hour"], task_data["minute"]
            await manager.send(
                user_id,
                {
                    "type": "task.auto_created",
                    "task_id": task_id,
                    "title": task_data["title"],
                    "schedule": f"{days_str} · {h:02d}:{m:02d}",
                },
            )
            logger.info("auto-task created user=%s title=%r", user_id, task_data["title"])
    except Exception as exc:
        logger.warning("auto-task detection failed user=%s: %s", user_id, exc)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    # Acepta token desde query param (cross-origin PWA) o cookie (server-side)
    token = websocket.query_params.get("token") or websocket.cookies.get("max_auth")
    if not token:
        await websocket.close(code=4001, reason="No autenticado")
        return

    try:
        payload = decode_token(token)
    except InvalidToken:
        await websocket.close(code=4001, reason="Token inválido")
        return

    user_id: str | None = payload.get("sub")
    if not user_id:
        await websocket.close(code=4001, reason="Token sin sub")
        return

    await manager.connect(user_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            event_type: str = data.get("type", "")

            if event_type == "ping":
                await manager.send(user_id, {"type": "pong"})
            elif event_type == "chat.send":
                await handle_chat_send(user_id, data)

    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception as exc:
        logger.error("WS error user=%s: %s", user_id, exc)
        manager.disconnect(user_id, websocket)
