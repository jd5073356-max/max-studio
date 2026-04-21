"""Orquestador de proyectos con Kimi K2.6 — agentic tool-calling loop.

Flujo:
1. Usuario describe un proyecto en lenguaje natural.
2. Kimi recibe el prompt + tools disponibles (create_file, run_code).
3. Kimi llama tools en paralelo para crear archivos / ejecutar código.
4. El gateway ejecuta cada tool y devuelve resultados a Kimi.
5. Kimi itera hasta terminar (finish_reason == "stop").
6. Cada paso emite un evento WS `project.step` para el progreso en tiempo real.
7. Al final emite `project.done` con los archivos creados.

Límites: máx 10 rondas, máx 30 archivos por proyecto, timeout 5 min por llamada.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
import zipfile
from io import BytesIO
from pathlib import Path
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.ws_manager import manager

logger = logging.getLogger(__name__)

MOONSHOT_BASE_URL = "https://api.moonshot.cn/v1"
PROJECTS_DIR = Path("/tmp/max-projects")
PROJECTS_DIR.mkdir(exist_ok=True)

MAX_ROUNDS = 10
MAX_FILES = 30

# ── System prompt ──────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Eres MAX, un asistente de IA experto en desarrollo de software y automatización.

Cuando el usuario te pida crear un proyecto, usa las herramientas disponibles para:
1. Crear todos los archivos necesarios con `create_file`
2. Verificar que el código funciona con `run_code` cuando sea útil
3. Ser exhaustivo: crea README, requirements, configuración y todo lo necesario

Reglas:
- Usa create_file para CADA archivo del proyecto
- Los nombres de archivo deben ser válidos (sin espacios, usa guiones o guiones_bajos)
- El código debe estar completo, funcional y bien comentado en español
- Al terminar, escribe un resumen en español de lo que creaste
"""

# ── Tool definitions ───────────────────────────────────────────────────────────

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "create_file",
            "description": "Crea un archivo con el contenido especificado en el proyecto.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Nombre del archivo con extensión (ej: scraper.py, config.json)",
                    },
                    "content": {
                        "type": "string",
                        "description": "Contenido completo del archivo",
                    },
                    "description": {
                        "type": "string",
                        "description": "Una línea describiendo qué hace este archivo",
                    },
                },
                "required": ["filename", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_code",
            "description": "Ejecuta código Python en sandbox para verificar que funciona correctamente.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Código Python a ejecutar",
                    },
                    "purpose": {
                        "type": "string",
                        "description": "Para qué es esta verificación",
                    },
                },
                "required": ["code"],
            },
        },
    },
]


# ── Tool executors ─────────────────────────────────────────────────────────────

def _exec_create_file(
    project_dir: Path,
    files: list[dict],
    args: dict,
) -> str:
    if len(files) >= MAX_FILES:
        return f"Error: límite de {MAX_FILES} archivos alcanzado"

    filename = args.get("filename", "").strip()
    content = args.get("content", "")
    description = args.get("description", "")

    # Sanear nombre de archivo
    safe = "".join(c if c.isalnum() or c in "._-/" else "_" for c in filename)
    if not safe:
        return "Error: nombre de archivo inválido"

    filepath = project_dir / safe
    filepath.parent.mkdir(parents=True, exist_ok=True)
    filepath.write_text(content, encoding="utf-8")

    files.append({
        "filename": safe,
        "path": str(filepath),
        "size": filepath.stat().st_size,
        "description": description,
    })
    return f"✓ Archivo '{safe}' creado ({filepath.stat().st_size} bytes)"


async def _exec_run_code(code: str) -> str:
    """Ejecuta código en el sandbox Docker (si está disponible)."""
    try:
        from app.sandbox.docker_runner import run_code
        result = await run_code("python", code)
        out = result.stdout[:500] if result.stdout else ""
        err = result.stderr[:200] if result.stderr else ""
        if result.exit_code == 0:
            return f"✓ OK\n{out}".strip()
        return f"✗ exit={result.exit_code}\n{err or out}".strip()
    except Exception as e:
        return f"Sandbox no disponible: {e}"


# ── Kimi API call ──────────────────────────────────────────────────────────────

async def _kimi_chat(
    messages: list[dict],
    tools: list[dict] | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    payload: dict[str, Any] = {
        "model": settings.moonshot_model,
        "messages": messages,
        "max_tokens": 8192,
        "temperature": 0.2,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{MOONSHOT_BASE_URL}/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.moonshot_api_key}",
                "Content-Type": "application/json",
            },
        )

    if resp.status_code != 200:
        raise RuntimeError(f"Kimi API {resp.status_code}: {resp.text[:300]}")

    return resp.json()


# ── Orquestador principal ──────────────────────────────────────────────────────

async def run_project(
    project_id: str,
    user_id: str,
    prompt: str,
) -> dict[str, Any]:
    """
    Ejecuta el loop agentic completo y retorna el resultado final.
    Emite eventos WS `project.step` en cada acción.
    """
    settings = get_settings()
    if not settings.moonshot_api_key:
        raise ValueError("MOONSHOT_API_KEY no configurada")

    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir(exist_ok=True)

    files: list[dict] = []
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    summary = ""
    step_num = 0

    for round_num in range(MAX_ROUNDS):
        logger.info("project=%s round=%d", project_id, round_num)

        response = await _kimi_chat(messages, tools=TOOLS)
        choice = response["choices"][0]
        message = choice["message"]
        finish_reason = choice.get("finish_reason", "stop")

        # Agregar respuesta del asistente al historial
        messages.append(message)

        if finish_reason == "stop":
            summary = message.get("content") or ""
            break

        if finish_reason != "tool_calls":
            summary = message.get("content") or ""
            break

        # Ejecutar tool calls
        tool_calls = message.get("tool_calls") or []
        tool_results: list[dict] = []

        for tc in tool_calls:
            step_num += 1
            fn_name = tc["function"]["name"]
            try:
                args = json.loads(tc["function"]["arguments"])
            except json.JSONDecodeError:
                args = {}

            tc_id = tc["id"]

            # Notificar inicio del paso
            await manager.send(user_id, {
                "type": "project.step",
                "project_id": project_id,
                "step": step_num,
                "action": fn_name,
                "label": args.get("filename") or args.get("purpose") or fn_name,
                "status": "running",
            })

            # Ejecutar
            try:
                if fn_name == "create_file":
                    result_text = _exec_create_file(project_dir, files, args)
                elif fn_name == "run_code":
                    result_text = await _exec_run_code(args.get("code", ""))
                else:
                    result_text = f"Tool desconocida: {fn_name}"
            except Exception as e:
                result_text = f"Error: {e}"

            # Notificar resultado
            await manager.send(user_id, {
                "type": "project.step",
                "project_id": project_id,
                "step": step_num,
                "action": fn_name,
                "label": args.get("filename") or args.get("purpose") or fn_name,
                "status": "done" if not result_text.startswith("✗") else "error",
                "result": result_text,
            })

            tool_results.append({
                "role": "tool",
                "tool_call_id": tc_id,
                "content": result_text,
            })

        # Añadir resultados al historial para siguiente ronda
        messages.extend(tool_results)

    # Empaquetar archivos en ZIP
    zip_path = project_dir / "proyecto.zip"
    if files:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for f in files:
                zf.write(f["path"], f["filename"])

    return {
        "project_id": project_id,
        "summary": summary,
        "files": files,
        "zip_path": str(zip_path) if zip_path.exists() else None,
        "rounds": round_num + 1,
    }
