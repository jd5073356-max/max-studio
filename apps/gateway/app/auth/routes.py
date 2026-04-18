"""Endpoints de autenticación."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field

from app.auth.jwt import create_access_token
from app.auth.password import verify_password
from app.auth.ratelimit import login_limiter
from app.core.config import get_settings
from app.core.deps import CurrentUser, SupabaseDep

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class UserPublic(BaseModel):
    id: str
    email: EmailStr


class LoginResponse(BaseModel):
    user: UserPublic


def _client_ip(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    response: Response,
    sb: SupabaseDep,
    body: Annotated[LoginRequest, Body()],
) -> LoginResponse:
    settings = get_settings()
    key = _client_ip(request)

    if not login_limiter.check(key):
        retry = login_limiter.retry_after(key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Demasiados intentos. Reintenta en {retry // 60 + 1} min.",
        )

    user = await sb.select_one(
        "users",
        {"email": body.email},
        columns="id,email,password_hash",
    )
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
        )

    token = create_access_token(sub=user["id"], extra={"email": user["email"]})

    response.set_cookie(
        key=settings.cookie_name,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.jwt_expiration_days * 24 * 60 * 60,
        path="/",
    )

    return LoginResponse(user=UserPublic(id=user["id"], email=user["email"]))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def logout() -> Response:
    settings = get_settings()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(
        key=settings.cookie_name, path="/", samesite=settings.cookie_samesite
    )
    return response


@router.get("/me", response_model=UserPublic)
async def me(user: CurrentUser) -> UserPublic:
    return UserPublic(id=user["id"], email=user["email"])
