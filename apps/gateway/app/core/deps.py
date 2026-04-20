"""FastAPI dependencies compartidas."""

from __future__ import annotations

from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, status

from app.auth.jwt import InvalidToken, decode_token
from app.core.config import Settings, get_settings
from app.core.supabase import SupabaseRest, get_supabase


SettingsDep = Annotated[Settings, Depends(get_settings)]
SupabaseDep = Annotated[SupabaseRest, Depends(get_supabase)]


async def get_current_user(
    sb: SupabaseDep,
    settings: SettingsDep,
    max_auth: Annotated[str | None, Cookie(alias=None)] = None,
    authorization: Annotated[str | None, Header(alias="authorization")] = None,
) -> dict:
    """Extrae usuario del JWT.

    Acepta el token de dos fuentes (en orden de prioridad):
    1. Header Authorization: Bearer <token>  — usado por el frontend PWA cross-origin
    2. Cookie max_auth                        — usado por requests server-side

    Raises 401 si ninguna fuente provee un token válido.
    """
    token: str | None = None

    # Prioridad 1: Bearer header
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()

    # Prioridad 2: cookie
    if not token:
        token = max_auth

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado"
        )

    try:
        payload = decode_token(token)
    except InvalidToken:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido"
        ) from None

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token sin sub"
        )

    user = await sb.select_one("users", {"id": user_id}, columns="id,email,created_at")
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado"
        )
    return user


CurrentUser = Annotated[dict, Depends(get_current_user)]
