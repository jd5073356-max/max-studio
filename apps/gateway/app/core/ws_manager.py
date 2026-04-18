"""WebSocket connection manager.

Mantiene las conexiones activas y provee send/broadcast.
Single-user: una conexión a la vez por user_id.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # user_id → WebSocket
        self._connections: dict[str, WebSocket] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        # Si había conexión previa, cerrarla limpiamente
        if user_id in self._connections:
            try:
                await self._connections[user_id].close(code=1001)
            except Exception:
                pass
        self._connections[user_id] = websocket
        logger.info("WS connected: user=%s total=%d", user_id, len(self._connections))

    def disconnect(self, user_id: str) -> None:
        self._connections.pop(user_id, None)
        logger.info("WS disconnected: user=%s total=%d", user_id, len(self._connections))

    async def send(self, user_id: str, event: dict[str, Any]) -> bool:
        """Envía evento a un usuario. Retorna False si no hay conexión."""
        ws = self._connections.get(user_id)
        if not ws:
            return False
        try:
            await ws.send_json(event)
            return True
        except Exception as exc:
            logger.warning("WS send failed user=%s: %s", user_id, exc)
            self.disconnect(user_id)
            return False

    async def broadcast(self, event: dict[str, Any]) -> None:
        """Envía a todos los usuarios conectados."""
        disconnected = []
        for user_id, ws in self._connections.items():
            try:
                await ws.send_json(event)
            except Exception:
                disconnected.append(user_id)
        for uid in disconnected:
            self.disconnect(uid)

    def is_connected(self, user_id: str) -> bool:
        return user_id in self._connections


manager = ConnectionManager()
