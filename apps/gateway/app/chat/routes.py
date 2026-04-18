"""Endpoints REST de chat — historial de mensajes y agrupación por hilos.

El schema `conversations` es un log plano (sin thread_id). Agrupamos
mensajes con gap temporal >30 min en el mismo hilo — simula el UX de
ChatGPT/Claude sin tocar el schema existente.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query

from app.core.deps import CurrentUser, SupabaseDep

router = APIRouter(prefix="/chat", tags=["chat"])


# Umbral para considerar un mensaje como inicio de nuevo hilo.
THREAD_GAP = timedelta(minutes=30)


def _parse_ts(raw: str) -> datetime:
    """Parsea timestamp de Supabase (ISO con timezone)."""
    # Supabase devuelve "2026-04-16T12:34:56.789Z" o con offset
    return datetime.fromisoformat(raw.replace("Z", "+00:00"))


def _group_threads(rows: list[dict]) -> list[dict]:
    """Agrupa mensajes por gap temporal >30min.

    rows debe venir ordenado ASC por created_at.
    Retorna [{id, title, last_message_at, first_message_at, message_count}].
    """
    threads: list[dict] = []
    current: dict | None = None
    prev_ts: datetime | None = None

    for row in rows:
        ts = _parse_ts(row["created_at"])
        is_new = current is None or (prev_ts is not None and ts - prev_ts > THREAD_GAP)

        if is_new:
            # Título = primeros 60 chars del primer mensaje (preferible user)
            title = (row.get("content") or "").strip().split("\n")[0][:60]
            if not title:
                title = "Sin título"
            current = {
                "id": row["created_at"],  # timestamp ISO = id estable del hilo
                "title": title,
                "first_message_at": row["created_at"],
                "last_message_at": row["created_at"],
                "message_count": 1,
            }
            threads.append(current)
        else:
            assert current is not None
            current["last_message_at"] = row["created_at"]
            current["message_count"] += 1
            # Si el título inicial fue de assistant y ahora hay user, mejorar título
            if row.get("role") == "user" and current["message_count"] <= 2:
                first_line = (row.get("content") or "").strip().split("\n")[0][:60]
                if first_line:
                    current["title"] = first_line

        prev_ts = ts

    # Retornar del más reciente al más viejo para la sidebar
    threads.reverse()
    return threads


@router.get("/messages")
async def get_messages(
    sb: SupabaseDep,
    _user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict]:
    """Últimos N mensajes del canal 'pwa' en orden cronológico ASC."""
    rows = await sb.select_many(
        "conversations",
        {"engine": "pwa"},
        columns="id,role,content,created_at",
        order="created_at.desc",
        limit=limit,
    )
    return list(reversed(rows))


@router.get("/threads")
async def get_threads(
    sb: SupabaseDep,
    _user: CurrentUser,
    limit: int = Query(default=500, ge=50, le=2000),
) -> list[dict]:
    """Devuelve hilos agrupados por gap temporal >30 min.

    Cada hilo: {id, title, first_message_at, last_message_at, message_count}.
    Orden: más reciente primero.
    """
    rows = await sb.select_many(
        "conversations",
        {"engine": "pwa"},
        columns="id,role,content,created_at",
        order="created_at.desc",
        limit=limit,
    )
    # Agrupador espera ASC
    rows_asc = list(reversed(rows))
    return _group_threads(rows_asc)


@router.get("/threads/{thread_id}/messages")
async def get_thread_messages(
    thread_id: str,
    sb: SupabaseDep,
    _user: CurrentUser,
) -> list[dict]:
    """Mensajes de un hilo específico.

    thread_id = created_at ISO del primer mensaje. Trae mensajes desde ese
    timestamp hasta que aparezca un gap >30min (pertenecen a otro hilo).
    """
    try:
        start = _parse_ts(thread_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="thread_id inválido") from None

    # Traer una ventana amplia desde el inicio del hilo
    rows = await sb.select_many(
        "conversations",
        {"engine": "pwa"},
        columns="id,role,content,created_at",
        order="created_at.asc",
        limit=500,
    )

    # Filtrar mensajes que pertenecen a este hilo
    result: list[dict] = []
    prev_ts: datetime | None = None
    started = False

    for row in rows:
        ts = _parse_ts(row["created_at"])
        if not started:
            if ts >= start - timedelta(seconds=1):
                started = True
                result.append(row)
                prev_ts = ts
            continue

        # Dentro del hilo: corto si detecto gap grande
        assert prev_ts is not None
        if ts - prev_ts > THREAD_GAP:
            break
        result.append(row)
        prev_ts = ts

    return result
