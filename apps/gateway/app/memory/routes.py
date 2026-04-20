"""Memory Browser — endpoints de lectura del historial de MAX.

GET /memory/conversations  — historial cross-channel (tabla `conversations`)
GET /memory/knowledge      — base de conocimiento RAG (tabla `knowledge`)
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, SupabaseDep

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("/conversations")
async def get_conversations(
    user: CurrentUser,  # noqa: ARG001
    sb: SupabaseDep,
    q: str | None = Query(default=None, description="Búsqueda en contenido"),
    engine: str | None = Query(default=None, description="Filtrar por canal: pwa, telegram, etc."),
    role: str | None = Query(default=None, description="user | assistant"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[dict[str, Any]]:
    """Devuelve mensajes del log de conversaciones, más recientes primero."""
    filters = {}
    ilike = {}

    if engine:
        filters["engine"] = engine
    if role:
        filters["role"] = role
    if q:
        ilike["content"] = q

    return await sb.select_many_filtered(
        "conversations",
        columns="id,engine,role,content,created_at",
        filters=filters if filters else None,
        ilike=ilike if ilike else None,
        order="created_at.desc",
        limit=limit,
        offset=offset,
    )


@router.get("/knowledge")
async def get_knowledge(
    user: CurrentUser,  # noqa: ARG001
    sb: SupabaseDep,
    q: str | None = Query(default=None, description="Búsqueda en contenido"),
    category: str | None = Query(default=None, description="Filtrar por categoría"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[dict[str, Any]]:
    """Devuelve entradas del RAG store."""
    filters = {}
    ilike = {}

    if category:
        filters["category"] = category
    if q:
        ilike["content"] = q

    return await sb.select_many_filtered(
        "knowledge",
        columns="id,category,content,created_at",
        filters=filters if filters else None,
        ilike=ilike if ilike else None,
        order="created_at.desc",
        limit=limit,
        offset=offset,
    )
