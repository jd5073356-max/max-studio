"""FastAPI dependencies compartidas."""

from __future__ import annotations

from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status

from app.auth.jwt import InvalidToken, decode_token
from app.core.config import Settings, get_settings
from app.core.supabase import SupabaseRest, get_supabase


SettingsDep = Annotated[Settings, Depends(get_settings)]
SupabaseDep = Annotated[SupabaseRest, Depends(get_supabase)]


async def get_current_user(
    sb: SupabaseDep,
    settings: SettingsDep,
    max_auth: Annotated[str | None, Cookie(alias=None)] = None,
) -> dict:
    """Extrae usuario del JWT en cookie.

    Raises 401 si la cookie falta, es inválida o el usuario no existe.
    """
    # Cookie con nombre dinámico desde settings
    token = max_auth
    if token is None:
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
