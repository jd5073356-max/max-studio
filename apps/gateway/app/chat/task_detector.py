"""Detección de intent de programación de tareas en mensajes de chat.

Cuando el usuario escribe cosas como:
  "recuérdame todos los lunes a las 9am revisar ventas"
  "programa una tarea para cada día a las 8pm"
  "avísame cada martes y jueves a las 6:30"

El detector extrae título, hora, minuto y días y retorna un dict
listo para insertar en `scheduled_tasks`. Si no hay intent, retorna None.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, timedelta
from typing import Any

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# Días de la semana (0 = lunes … 6 = domingo) — mapeados desde español
_DAY_MAP: dict[str, int] = {
    "lunes": 0, "lun": 0, "monday": 0, "mon": 0,
    "martes": 1, "mar": 1, "tuesday": 1, "tue": 1,
    "miércoles": 2, "miercoles": 2, "mié": 2, "mie": 2, "wednesday": 2, "wed": 2,
    "jueves": 3, "jue": 3, "thursday": 3, "thu": 3,
    "viernes": 4, "vie": 4, "friday": 4, "fri": 4,
    "sábado": 5, "sabado": 5, "sáb": 5, "sab": 5, "saturday": 5, "sat": 5,
    "domingo": 6, "dom": 6, "sunday": 6, "sun": 6,
}

_ALL_DAYS = list(range(7))
_WEEKDAYS = list(range(5))   # lun–vie
_WEEKEND = [5, 6]            # sáb–dom

_SCHEDULE_KEYWORDS = {
    "recuérdame", "recuerdame", "recuerda", "programa", "agrega",
    "crea una tarea", "crea tarea", "agenda", "avísame", "avisame",
    "remind me", "schedule", "set a reminder", "add a task",
    "cada día", "cada dia", "todos los días", "todos los dias",
    "every day", "diariamente", "daily", "semanalmente", "weekly",
}


def _has_schedule_keyword(text: str) -> bool:
    low = text.lower()
    return any(kw in low for kw in _SCHEDULE_KEYWORDS)


def _parse_days(text: str) -> list[int] | None:
    low = text.lower()

    # Relativos: mañana / hoy → día concreto de la semana
    if re.search(r"\bma[ñn]ana\b|\btomorrow\b", low):
        tomorrow = (date.today() + timedelta(days=1)).weekday()  # 0=lun
        return [tomorrow]
    if re.search(r"\bhoy\b|\btoday\b", low):
        return [date.today().weekday()]

    # Atajos globales
    if any(k in low for k in ("cada día", "cada dia", "todos los días", "todos los dias", "every day", "diariamente", "daily")):
        return _ALL_DAYS
    if any(k in low for k in ("días de semana", "dias de semana", "días hábiles", "dias habiles", "weekdays", "lunes a viernes")):
        return _WEEKDAYS
    if any(k in low for k in ("fines de semana", "fin de semana", "weekends")):
        return _WEEKEND

    # Buscar nombres de días individuales
    found = []
    for name, num in _DAY_MAP.items():
        if re.search(r"\b" + re.escape(name) + r"\b", low):
            if num not in found:
                found.append(num)
    return sorted(found) if found else None


def _parse_time(text: str) -> tuple[int, int] | None:
    """Extrae hora y minuto del texto. Retorna (hour, minute) o None."""
    # Palabras especiales primero
    if re.search(r"\bmedianoche\b|\bmidnight\b", text, re.IGNORECASE):
        return 0, 0
    if re.search(r"\bmediodia\b|\bmediodía\b|\bnoon\b", text, re.IGNORECASE):
        return 12, 0

    # Patrón "HH:MM" con am/pm opcional
    m = re.search(r"\b(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?", text, re.IGNORECASE)
    if m:
        h, mi = int(m.group(1)), int(m.group(2))
        suffix = (m.group(3) or "").lower().replace(".", "")
        if suffix == "pm" and h < 12:
            h += 12
        if suffix == "am" and h == 12:
            h = 0
        if 0 <= h <= 23 and 0 <= mi <= 59:
            return h, mi

    # Patrón "Xam / Xpm" sin minuto
    m = re.search(r"\b(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)\b", text, re.IGNORECASE)
    if m:
        h = int(m.group(1))
        suffix = m.group(2).lower().replace(".", "")
        if suffix == "pm" and h < 12:
            h += 12
        if suffix == "am" and h == 12:
            h = 0
        if 0 <= h <= 23:
            return h, 0

    # Patrón "a las N" / "las N" / "at N" sin am/pm
    # Asumimos: 1-6 → pm (13-18), 7-12 → am (7-12), 13-23 → 24h
    m = re.search(r"\b(?:a\s+las?|at)\s+(\d{1,2})\b", text, re.IGNORECASE)
    if m:
        h = int(m.group(1))
        if 0 <= h <= 23:
            # Heurística: 1–6 sin contexto = pm
            if 1 <= h <= 6:
                h += 12
            return h, 0

    return None


def _extract_title(text: str) -> str:
    """Genera un título corto quitando las palabras de comando."""
    # Remover frases de activación comunes
    clean = re.sub(
        r"(?i)(recuérdame|recuerdame|avísame|avisame|programa(r)?|agrega(r)?|crea(r)?\s+(una\s+)?tarea\s+(de)?\s*|(agenda(r)?)|set\s+a\s+reminder|remind\s+me\s+(to|that)?|schedule\s+(a\s+)?)",
        "",
        text,
    ).strip()

    # Remover información de tiempo y días que ya se extrajo
    clean = re.sub(
        r"(?i)\b(cada\s+)?(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(\s+(y|and)\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday))*",
        "",
        clean,
    )
    clean = re.sub(
        r"(?i)\b(a\s+las|at|a\s+la)\s+\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?\b",
        "",
        clean,
    )
    clean = re.sub(r"(?i)\b(cada\s+d[ií]a|todos\s+los\s+d[ií]as|diariamente|every\s+day|daily|semanalmente|weekly)\b", "", clean)
    clean = re.sub(r"\s{2,}", " ", clean).strip(" ,.")

    # Capitalizar y truncar
    title = clean.capitalize()[:100] or "Recordatorio"
    return title


# ── API pública ───────────────────────────────────────────────────────────────

async def detect_task(user_message: str) -> dict[str, Any] | None:
    """
    Detecta si el mensaje contiene un intent de crear una tarea programada.

    Estrategia de dos pasos:
    1. Filtro rápido por keywords (evita llamadas innecesarias al LLM).
    2. Extracción local de hora/días con regex (sin costo de API).

    Si el regex extrae hora y días → retorna el dict directamente.
    Si extrae solo hora o solo días → intenta completar con LLM.
    Si no detecta nada → None.
    """
    if not _has_schedule_keyword(user_message):
        return None

    time_result = _parse_time(user_message)
    days_result = _parse_days(user_message)

    # Caso 1: extracción completa por regex
    if time_result and days_result:
        hour, minute = time_result
        title = _extract_title(user_message)
        return {
            "title": title,
            "message": user_message,
            "hour": hour,
            "minute": minute,
            "days": days_result,
            "status": "active",
        }

    # Caso 2: hora detectada, días no → preguntar al LLM
    if time_result and not days_result:
        days_result = await _ask_llm_for_days(user_message)
        if days_result:
            hour, minute = time_result
            return {
                "title": _extract_title(user_message),
                "message": user_message,
                "hour": hour,
                "minute": minute,
                "days": days_result,
                "status": "active",
            }

    # Caso 3: días detectados, hora no → preguntar al LLM
    if days_result and not time_result:
        time_result = await _ask_llm_for_time(user_message)
        if time_result:
            hour, minute = time_result
            return {
                "title": _extract_title(user_message),
                "message": user_message,
                "hour": hour,
                "minute": minute,
                "days": days_result,
                "status": "active",
            }

    # Caso 4: nada detectado por regex → intentar extracción completa vía LLM
    return await _ask_llm_full(user_message)


async def _ask_llm_full(user_message: str) -> dict[str, Any] | None:
    """Usa el LLM para extraer TODOS los campos de tarea del mensaje."""
    settings = get_settings()
    if not settings.dispatch_secret:
        return None

    prompt = (
        "Analiza este mensaje de usuario y extrae información de tarea programada.\n"
        f"Mensaje: {user_message!r}\n\n"
        "Si el mensaje pide programar una tarea/recordatorio, responde SOLO con JSON:\n"
        '{"title": "...", "hour": N, "minute": N, "days": [0-6]}\n'
        "donde days usa 0=lunes...6=domingo.\n"
        "Si NO hay intent de programar tarea, responde SOLO: null"
    )

    raw = await _call_dispatch(prompt)
    if not raw:
        return None

    return _parse_llm_json(raw, user_message)


async def _ask_llm_for_days(user_message: str) -> list[int] | None:
    settings = get_settings()
    if not settings.dispatch_secret:
        return None

    prompt = (
        f"Mensaje: {user_message!r}\n"
        "¿Qué días de la semana menciona? Responde SOLO con JSON array de enteros (0=lun...6=dom). "
        "Si son todos los días: [0,1,2,3,4,5,6]. Si no se especifica: null"
    )
    raw = await _call_dispatch(prompt)
    if not raw:
        return None
    try:
        cleaned = raw.strip().strip("`")
        result = json.loads(cleaned)
        if isinstance(result, list):
            return [int(d) for d in result if 0 <= int(d) <= 6]
    except Exception:
        pass
    return None


async def _ask_llm_for_time(user_message: str) -> tuple[int, int] | None:
    settings = get_settings()
    if not settings.dispatch_secret:
        return None

    prompt = (
        f"Mensaje: {user_message!r}\n"
        'Extrae la hora. Responde SOLO con JSON: {"hour": N, "minute": N} (formato 24h). '
        "Si no hay hora especificada: null"
    )
    raw = await _call_dispatch(prompt)
    if not raw:
        return None
    try:
        cleaned = raw.strip().strip("`").strip()
        if cleaned.lower() == "null":
            return None
        data = json.loads(cleaned)
        if isinstance(data, dict) and "hour" in data:
            h, mi = int(data["hour"]), int(data.get("minute", 0))
            if 0 <= h <= 23 and 0 <= mi <= 59:
                return h, mi
    except Exception:
        pass
    return None


async def _call_dispatch(prompt: str) -> str | None:
    """Llama a Dispatch y retorna la respuesta completa como string."""
    from app.core.config import get_settings
    from app.chat.dispatcher import _create_dispatch_token  # import interno

    settings = get_settings()
    if not settings.dispatch_secret:
        return None

    try:
        token = _create_dispatch_token(settings.dispatch_secret)
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "http://localhost:8001/dispatch",
                json={"content": prompt},
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            return data.get("reply", "")
    except Exception as e:
        logger.debug("task_detector LLM call failed: %s", e)
        return None


def _parse_llm_json(raw: str, user_message: str) -> dict[str, Any] | None:
    """Parsea la respuesta JSON del LLM para extracción completa."""
    try:
        # Extraer JSON de posible texto extra
        match = re.search(r"\{[^}]+\}", raw, re.DOTALL)
        if not match:
            return None
        data = json.loads(match.group())
        hour = int(data.get("hour", -1))
        minute = int(data.get("minute", 0))
        days = [int(d) for d in (data.get("days") or []) if 0 <= int(d) <= 6]

        if not (0 <= hour <= 23 and 0 <= minute <= 59 and days):
            return None

        title = data.get("title") or _extract_title(user_message)
        return {
            "title": str(title)[:100],
            "message": user_message,
            "hour": hour,
            "minute": minute,
            "days": days,
            "status": "active",
        }
    except Exception:
        return None
