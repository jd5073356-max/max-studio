"""Ejecutor de código efímero en Docker.

Seguridad:
- Sin red (network_mode=none)
- RAM ≤ 256 MB
- CPU ≤ 0.5
- Timeout duro 60 s
- tmpfs /tmp (sin acceso al host)
- Contenedor removido automáticamente tras ejecución
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import TypedDict

logger = logging.getLogger(__name__)

SUPPORTED_IMAGES: dict[str, str] = {
    "python": "max-sandbox-py",
    "py": "max-sandbox-py",
    "javascript": "max-sandbox-js",
    "js": "max-sandbox-js",
}

TIMEOUT_SECONDS = 60
MAX_OUTPUT_BYTES = 64 * 1024  # 64 KB — evitar floods


class RunResult(TypedDict):
    stdout: str
    stderr: str
    exit_code: int
    duration_ms: int


def _get_command(language: str, code: str) -> list[str]:
    lang = language.lower()
    if lang in ("python", "py"):
        return ["python", "-c", code]
    # javascript / js
    return ["node", "-e", code]


def _run_sync(image: str, command: list[str]) -> RunResult:
    """Bloquea el hilo hasta que el container termina o expira."""
    import docker  # lazy import — no crash si el SDK no está instalado

    client = docker.from_env()
    start = time.monotonic()
    container = None

    try:
        container = client.containers.run(
            image=image,
            command=command,
            detach=True,
            network_mode="none",
            mem_limit="256m",
            nano_cpus=500_000_000,   # 0.5 CPU
            tmpfs={"/tmp": "size=32m,noexec"},
            read_only=True,
            user="nobody",
        )

        result = container.wait(timeout=TIMEOUT_SECONDS)
        exit_code: int = result.get("StatusCode", 0)

        raw_out = container.logs(stdout=True, stderr=False)
        raw_err = container.logs(stdout=False, stderr=True)

        stdout = raw_out[:MAX_OUTPUT_BYTES].decode("utf-8", errors="replace")
        stderr = raw_err[:MAX_OUTPUT_BYTES].decode("utf-8", errors="replace")

    except Exception as exc:  # timeout, image not found, etc.
        stdout = ""
        stderr = str(exc)
        exit_code = 1
    finally:
        if container:
            try:
                container.remove(force=True)
            except Exception:
                pass

    duration_ms = int((time.monotonic() - start) * 1000)
    return RunResult(stdout=stdout, stderr=stderr, exit_code=exit_code, duration_ms=duration_ms)


async def run_code(language: str, code: str) -> RunResult:
    """Ejecuta código en un contenedor efímero. Async-safe vía thread pool."""
    lang = language.lower()
    image = SUPPORTED_IMAGES.get(lang)
    if not image:
        return RunResult(
            stdout="",
            stderr=f"Lenguaje '{language}' no soportado. Usa: python, javascript",
            exit_code=1,
            duration_ms=0,
        )

    command = _get_command(lang, code)
    try:
        return await asyncio.to_thread(_run_sync, image, command)
    except Exception as exc:
        logger.exception("Error inesperado en sandbox")
        return RunResult(stdout="", stderr=str(exc), exit_code=1, duration_ms=0)
