"""Error Notifier — monitorea system_logs y dispara n8n webhook para errores críticos.

Uso:
  - Llama `notify_if_critical(log_row)` después de insertar en system_logs
  - El webhook envía el error a Telegram/WhatsApp via n8n
  - Rate limiting: máx 1 notificación por error único cada 5 minutos
"""

from __future__ import annotations

import hashlib
import logging
import time
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Cache para evitar spam: hash del mensaje → último envío timestamp
_notified: dict[str, float] = {}
_COOLDOWN = 300.0  # 5 minutos entre notificaciones del mismo error


def _error_hash(service: str, message: str) -> str:
    return hashlib.md5(f"{service}:{message[:100]}".encode()).hexdigest()[:8]


async def notify_if_critical(log_row: dict[str, Any]) -> None:
    """Dispara n8n webhook si el log es de nivel ERROR o CRITICAL."""
    level = (log_row.get("level") or "").upper()
    if level not in ("ERROR", "CRITICAL"):
        return

    settings = get_settings()
    webhook_url: str = getattr(settings, "n8n_error_webhook", "") or ""
    if not webhook_url:
        return  # webhook no configurado — silencioso

    service = log_row.get("service", "unknown")
    message = log_row.get("message", "")
    err_hash = _error_hash(service, message)

    now = time.monotonic()
    if now - _notified.get(err_hash, 0.0) < _COOLDOWN:
        return  # dentro del cooldown

    payload = {
        "level": level,
        "service": service,
        "message": message[:500],
        "metadata": log_row.get("metadata") or {},
        "timestamp": log_row.get("created_at", ""),
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code < 300:
                _notified[err_hash] = now
                logger.info("Error notification sent: %s/%s", service, level)
            else:
                logger.warning("n8n webhook returned %s", resp.status_code)
    except Exception as exc:
        logger.warning("Error notifier failed: %s", exc)
