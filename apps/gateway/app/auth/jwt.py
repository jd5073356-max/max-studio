"""JWT encode/decode para sesiones del gateway."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.core.config import get_settings


class InvalidToken(Exception):
    """Token inválido o expirado."""


def create_access_token(sub: str, extra: dict[str, Any] | None = None) -> str:
    """Crea un JWT firmado con HS256.

    sub: identificador del usuario (uuid en string).
    extra: claims adicionales (email, etc.) — no meter secretos.
    """
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": sub,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.jwt_expiration_days)).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise InvalidToken(str(exc)) from exc
