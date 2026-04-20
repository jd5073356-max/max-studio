"""WebSocket endpoint /ws — autenticado por cookie max_auth."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.auth.jwt import InvalidToken, decode_token
from app.chat.dispatcher import stream_response
from app.core.config import get_settings
from app.core.supabase import SupabaseRest
from app.core.ws_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ws"])


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

    # 4. Guardar respuesta del asistente
    assistant_row = await sb.insert(
        "conversations",
        {"engine": "pwa", "role": "assistant", "content": full_response},
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
