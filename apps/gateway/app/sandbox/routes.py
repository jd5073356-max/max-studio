"""Sandbox de código — Step 14.

POST /sandbox/run  — ejecuta código Python o JavaScript en container efímero.
GET  /sandbox/languages — devuelve lenguajes soportados.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.core.deps import CurrentUser
from app.sandbox.docker_runner import SUPPORTED_IMAGES, run_code

router = APIRouter(prefix="/sandbox", tags=["sandbox"])

RUNNABLE_LANGUAGES = sorted(set(SUPPORTED_IMAGES.keys()))


class RunRequest(BaseModel):
    language: str = Field(..., description="python | javascript | js | py")
    code: str = Field(..., min_length=1, max_length=8000)


class RunResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    duration_ms: int
    language: str


@router.get("/languages")
async def list_languages(_user: CurrentUser) -> list[str]:
    """Retorna los lenguajes disponibles en el sandbox."""
    return RUNNABLE_LANGUAGES


@router.post("/run", status_code=status.HTTP_200_OK)
async def run_sandbox(body: RunRequest, _user: CurrentUser) -> RunResponse:
    """Ejecuta código en un contenedor Docker efímero y retorna el output."""
    if body.language.lower() not in SUPPORTED_IMAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lenguaje no soportado: {body.language}. Disponibles: {RUNNABLE_LANGUAGES}",
        )

    result = await run_code(body.language, body.code)

    return RunResponse(
        stdout=result["stdout"],
        stderr=result["stderr"],
        exit_code=result["exit_code"],
        duration_ms=result["duration_ms"],
        language=body.language,
    )
