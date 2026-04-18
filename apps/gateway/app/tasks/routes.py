"""CRUD de tareas programadas + ejecución inmediata.

Schema real `scheduled_tasks`:
  id uuid, title text, message text, hour int, minute int, days int[],
  status text, created_at timestamptz.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.deps import CurrentUser, SupabaseDep
from app.tasks.scheduler import calculate_next_run, validate_task_payload

router = APIRouter(prefix="/tasks", tags=["tasks"])


# ────────────────────────────────────────────────────────────────────
# Schemas
# ────────────────────────────────────────────────────────────────────

TaskStatus = Literal["active", "paused", "archived"]


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    message: str = Field(default="", max_length=2000)
    hour: int = Field(..., ge=0, le=23)
    minute: int = Field(..., ge=0, le=59)
    days: list[int] = Field(..., min_length=1, max_length=7)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    message: str | None = Field(default=None, max_length=2000)
    hour: int | None = Field(default=None, ge=0, le=23)
    minute: int | None = Field(default=None, ge=0, le=59)
    days: list[int] | None = Field(default=None, min_length=1, max_length=7)
    status: TaskStatus | None = None


def _enrich(row: dict) -> dict:
    """Calcula next_run y lo agrega al dict de respuesta."""
    if row.get("status") == "active":
        try:
            nxt = calculate_next_run(row["hour"], row["minute"], row.get("days") or [])
            row["next_run"] = nxt.isoformat() if nxt else None
        except (ValueError, TypeError):
            row["next_run"] = None
    else:
        row["next_run"] = None
    return row


# ────────────────────────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────────────────────────


@router.get("")
async def list_tasks(sb: SupabaseDep, _user: CurrentUser) -> list[dict]:
    """Devuelve todas las tareas, activas primero, ordenadas por próximo run."""
    rows = await sb.select_many(
        "scheduled_tasks",
        columns="*",
        order="created_at.desc",
        limit=200,
    )
    enriched = [_enrich(r) for r in rows]

    # Ordenar: activas con next_run más próximo primero; luego pausadas; luego archivadas
    def sort_key(r: dict) -> tuple:
        status_rank = {"active": 0, "paused": 1, "archived": 2}.get(r.get("status", ""), 3)
        next_run = r.get("next_run") or "9999"
        return (status_rank, next_run)

    enriched.sort(key=sort_key)
    return enriched


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate, sb: SupabaseDep, _user: CurrentUser
) -> dict:
    try:
        validate_task_payload(payload.title, payload.hour, payload.minute, payload.days)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    row = await sb.insert(
        "scheduled_tasks",
        {
            "title": payload.title.strip(),
            "message": payload.message.strip(),
            "hour": payload.hour,
            "minute": payload.minute,
            "days": payload.days,
            "status": "active",
        },
    )
    if not row:
        raise HTTPException(status_code=500, detail="No se pudo crear la tarea")
    return _enrich(row)


@router.patch("/{task_id}")
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    sb: SupabaseDep,
    _user: CurrentUser,
) -> dict:
    patch = payload.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=400, detail="Nada que actualizar")

    # Validación combinada — traer estado actual y mergear
    current = await sb.select_one("scheduled_tasks", {"id": task_id})
    if not current:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    merged = {**current, **patch}
    try:
        if "hour" in patch or "minute" in patch or "days" in patch or "title" in patch:
            validate_task_payload(
                merged.get("title", ""),
                merged.get("hour", 0),
                merged.get("minute", 0),
                merged.get("days") or [],
            )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    rows = await sb.update("scheduled_tasks", {"id": task_id}, patch)
    if not rows:
        raise HTTPException(status_code=500, detail="Update falló")
    return _enrich(rows[0])


@router.delete("/{task_id}")
async def delete_task(
    task_id: str, sb: SupabaseDep, _user: CurrentUser
) -> dict:
    current = await sb.select_one("scheduled_tasks", {"id": task_id}, columns="id")
    if not current:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    await sb.delete("scheduled_tasks", {"id": task_id})
    return {"deleted": True, "id": task_id}


@router.post("/{task_id}/run-now")
async def run_now(task_id: str, sb: SupabaseDep, _user: CurrentUser) -> dict:
    """Ejecuta la tarea inmediatamente encolándola en `tasks` (agent_jobs).

    La tarea programada se mantiene — esto solo dispara una ejecución ad-hoc.
    """
    task = await sb.select_one("scheduled_tasks", {"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    # Enqueue en la tabla `tasks` (agent jobs). agent.py la recoge.
    job = await sb.insert(
        "tasks",
        {
            "title": task["title"],
            "status": "pending",
            "service": "scheduled",
            "metadata": {
                "source": "scheduled_tasks",
                "scheduled_task_id": task_id,
                "message": task.get("message", ""),
            },
        },
    )
    return {"enqueued": True, "job_id": job["id"] if job else None}
