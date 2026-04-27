"""Canvas state persistence — guarda/carga el estado del canvas de Excalidraw."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.deps import CurrentUser, SupabaseDep

router = APIRouter(prefix="/canvas", tags=["canvas"])


class SaveRequest(BaseModel):
    data: dict[str, Any]


@router.post("/save", status_code=status.HTTP_200_OK)
async def save_canvas(body: SaveRequest, user: CurrentUser, sb: SupabaseDep) -> dict:  # noqa: ARG001
    """Guarda el estado actual del canvas (upsert en canvas_states)."""
    try:
        rows = await sb.select_many("canvas_states", columns="id", limit=1)
        if rows:
            await sb.update("canvas_states", {"id": rows[0]["id"]}, {"data": body.data})
            return {"ok": True, "id": rows[0]["id"]}
        row = await sb.insert("canvas_states", {"data": body.data})
        return {"ok": True, "id": (row or {}).get("id")}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Canvas save failed: {exc}. Run docs/max_studio_init.sql in Supabase.",
        ) from exc


@router.get("/latest")
async def get_canvas(user: CurrentUser, sb: SupabaseDep) -> dict | None:  # noqa: ARG001
    """Retorna el estado más reciente del canvas. Retorna null si la tabla no existe aún."""
    try:
        rows = await sb.select_many(
            "canvas_states",
            columns="id,data,created_at",
            order="created_at.desc",
            limit=1,
        )
        return rows[0] if rows else None
    except Exception:
        return None


@router.delete("/clear")
async def clear_canvas(user: CurrentUser, sb: SupabaseDep) -> dict:  # noqa: ARG001
    """Borra todos los estados del canvas."""
    try:
        rows = await sb.select_many("canvas_states", columns="id")
        for row in rows:
            await sb.delete("canvas_states", {"id": row["id"]})
    except Exception:
        pass
    return {"ok": True}
