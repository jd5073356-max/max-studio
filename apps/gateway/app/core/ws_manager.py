"""WebSocket connection manager.

Mantiene todas las conexiones activas de un usuario y hace broadcast.
Single-user app: puede haber múltiples pestañas/dispositivos del mismo usuario.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # user_id → lista de WebSockets activos
        self._connections: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(websocket)
        total = sum(len(v) for v in self._connections.values())
        logger.info(
            "WS connected: user=%s sockets=%d total=%d",
            user_id,
            len(self._connections[user_id]),
            total,
        )

    def disconnect(self, user_id: str, websocket: WebSocket | None = None) -> None:
        if user_id not in self._connections:
            return
        if websocket is not None:
            try:
                self._connections[user_id].remove(websocket)
            except ValueError:
                pass
        if not self._connections[user_id]:
            del self._connections[user_id]
        total = sum(len(v) for v in self._connections.values())
        logger.info("WS disconnected: user=%s total=%d", user_id, total)

    async def send(self, user_id: str, event: dict[str, Any]) -> bool:
        """Envía evento a TODAS las conexiones activas del usuario."""
        sockets = self._connections.get(user_id, [])
        if not sockets:
            return False

        dead: list[WebSocket] = []
        sent = False
        for ws in list(sockets):
            try:
                await ws.send_json(event)
                sent = True
            except Exception as exc:
                logger.warning("WS send failed user=%s: %s", user_id, exc)
                dead.append(ws)

        for ws in dead:
            self.disconnect(user_id, ws)

        return sent

    async def broadcast(self, event: dict[str, Any]) -> None:
        """Envía a todos los usuarios conectados."""
        for user_id in list(self._connections.keys()):
            await self.send(user_id, event)

    def is_connected(self, user_id: str) -> bool:
        return bool(self._connections.get(user_id))


manager = ConnectionManager()
