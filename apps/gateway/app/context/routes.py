"""Endpoints de contexto MAX: CLAUDE.md + notas Obsidian.

- `GET /context/claude-md`  — devuelve el CLAUDE.md sincronizado por agent.py
- `GET /context/obsidian`   — lista de notas Obsidian sincronizadas
- `POST /context/sync`      — encola tarea en agent.py para re-sincronizar ahora
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter

from app.core.deps import CurrentUser, SupabaseDep

router = APIRouter(prefix="/context", tags=["context"])


@router.get("/claude-md")
async def get_claude_md(
    _user: CurrentUser,
    sb: SupabaseDep,
) -> dict[str, Any]:
    """Devuelve el contenido del CLAUDE.md sincronizado por el agente local."""
    rows = await sb.select_many(
        "knowledge",
        filters={"category": "claude_md"},
        columns="id,content,created_at",
        limit=1,
    )
    if not rows:
        return {"content": None, "synced_at": None, "message": "No sincronizado aún. Reinicia agent.py."}
    row = rows[0]
    return {
        "content": row["content"],
        "synced_at": row.get("created_at"),
        "chars": len(row["content"]) if row["content"] else 0,
    }


@router.get("/obsidian")
async def get_obsidian_notes(
    _user: CurrentUser,
    sb: SupabaseDep,
    q: str | None = None,
    limit: int = 30,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Devuelve notas de Obsidian sincronizadas por el agente local."""
    ilike = {"content": q} if q else None
    return await sb.select_many_filtered(
        "knowledge",
        columns="id,content,created_at",
        filters={"category": "obsidian"},
        ilike=ilike,
        order="created_at.desc",
        limit=limit,
        offset=offset,
    )


@router.post("/sync")
async def trigger_sync(
    _user: CurrentUser,
    sb: SupabaseDep,
) -> dict[str, str]:
    """Encola una tarea para que agent.py re-sincronice CLAUDE.md y Obsidian ahora."""
    await sb.insert(
        "tasks",
        {
            "title": "Sync contexto: CLAUDE.md + Obsidian",
            "status": "pending",
            "service": "local_pc",
            "scheduled_at": datetime.now(timezone.utc).isoformat(),
            "metadata": {"action": "sync_context"},
        },
        returning=False,
    )
    return {"status": "queued", "message": "Tarea enviada al agente local"}
