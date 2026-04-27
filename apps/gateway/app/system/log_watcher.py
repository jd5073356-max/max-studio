"""Watcher de system_logs — polling cada 30s para detectar errores críticos y disparar notificaciones."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.core.supabase import SupabaseRest
from app.system.error_notifier import notify_if_critical

logger = logging.getLogger(__name__)

# Timestamp del último log procesado
_last_checked: str = ""


async def _poll_errors() -> None:
    """Busca nuevos logs ERROR/CRITICAL desde la última revisión."""
    global _last_checked
    sb = SupabaseRest()
    try:
        filters = {}
        if _last_checked:
            # PostgREST range filter: created_at > _last_checked
            pass  # handled via params below

        rows = await sb.select_many_filtered(
            "system_logs",
            columns="id,service,level,message,metadata,created_at",
            filters=None,
            ilike=None,
            order="created_at.desc",
            limit=20,
        )

        now_iso = datetime.now(timezone.utc).isoformat()
        new_rows = [
            r for r in rows
            if r.get("level", "").upper() in ("ERROR", "CRITICAL")
            and r.get("created_at", "") > (_last_checked or "")
        ]

        for row in new_rows:
            await notify_if_critical(row)

        if rows:
            _last_checked = rows[0].get("created_at", now_iso)

    except Exception as exc:
        logger.debug("Log watcher poll error: %s", exc)


async def start_log_watcher() -> None:
    """Loop background que corre indefinidamente."""
    logger.info("Log watcher started — polling every 30s")
    while True:
        await asyncio.sleep(30)
        await _poll_errors()
