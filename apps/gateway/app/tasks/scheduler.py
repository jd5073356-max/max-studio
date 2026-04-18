"""Cálculo de next_run para tareas programadas.

Schema `scheduled_tasks` usa hour/minute/days[] en vez de cron string.
Convención: days array con enteros 0-6 donde 0=Lunes, 6=Domingo.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone


def calculate_next_run(
    hour: int,
    minute: int,
    days: list[int],
    *,
    now: datetime | None = None,
) -> datetime | None:
    """Devuelve el próximo datetime en que debe correr la tarea.

    Retorna None si `days` está vacío (tarea inactiva).

    Args:
        hour: 0-23
        minute: 0-59
        days: lista con 0=Lun ... 6=Dom (Python weekday())
    """
    if not days:
        return None
    if not (0 <= hour <= 23) or not (0 <= minute <= 59):
        raise ValueError(f"hora/minuto inválidos: {hour}:{minute}")
    valid_days = sorted({d for d in days if 0 <= d <= 6})
    if not valid_days:
        raise ValueError(f"days inválido: {days}")

    ref = (now or datetime.now(timezone.utc)).astimezone()

    # Buscar dentro de los próximos 7 días
    for offset in range(0, 8):
        candidate = (ref + timedelta(days=offset)).replace(
            hour=hour, minute=minute, second=0, microsecond=0
        )
        # weekday(): 0=Lun ... 6=Dom — coincide con nuestra convención
        if candidate.weekday() not in valid_days:
            continue
        if candidate <= ref:
            continue
        return candidate

    # Caso borde — no debería llegar, pero fallback
    return None


def validate_task_payload(
    title: str, hour: int, minute: int, days: list[int]
) -> None:
    """Valida un payload de creación/edición de tarea.

    Lanza ValueError si algo está mal.
    """
    if not title or not title.strip():
        raise ValueError("title requerido")
    if not (0 <= hour <= 23):
        raise ValueError("hour debe estar entre 0 y 23")
    if not (0 <= minute <= 59):
        raise ValueError("minute debe estar entre 0 y 59")
    if not isinstance(days, list) or not days:
        raise ValueError("days requerido (lista no vacía)")
    for d in days:
        if not isinstance(d, int) or not (0 <= d <= 6):
            raise ValueError(f"day inválido: {d}")
