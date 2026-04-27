"""Simulación 300 agentes — Kimi K2.6 orquestado en 3 rondas de 100 agentes.

GET  /kimi/simulation/list         — lista simulaciones guardadas
POST /kimi/simulation/start        — inicia una nueva simulación (background)
GET  /kimi/simulation/{id}/stream  — SSE de progreso en tiempo real
GET  /kimi/simulation/{id}/report  — estado y resultados finales
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.deps import CurrentUser, SupabaseDep
from app.kimi.client import generate_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/kimi/simulation", tags=["simulation"])

# In-memory queues for SSE streaming — key: sim_id, value: asyncio.Queue
_queues: dict[str, asyncio.Queue] = {}

SEMAPHORE_LIMIT = 5

ROUND_LABELS = {1: "Emprendedores", 2: "Auditores", 3: "Futuristas"}

ROUND_PROMPTS = {
    1: (
        "Eres un emprendedor creativo. Genera una idea de negocio innovadora y viable "
        "en menos de 150 palabras. Incluye: nombre, qué hace, mercado objetivo, y "
        "estimación de ingreso mensual potencial en USD. Sé específico y original."
    ),
    2: (
        "Eres un auditor de negocios experto. Analiza esta idea de negocio y detecta "
        "sus 3 principales fallas, riesgos de mercado y puntos de saturación. "
        "Sé crítico pero constructivo. Máximo 150 palabras.\n\nIdea a auditar:\n{idea}"
    ),
    3: (
        "Eres un futurista estratégico. Simula cómo variables externas (economía global, "
        "regulaciones, cambios tecnológicos en 2025-2027) impactarán esta idea de negocio. "
        "Da un score de supervivencia del 0.0 al 1.0 y justifica en 100 palabras.\n"
        "Responde con JSON: {{\"score\": 0.X, \"analysis\": \"...\"}}\n\nIdea:\n{idea}"
    ),
}


async def _run_agent(
    sem: asyncio.Semaphore,
    round_num: int,
    agent_index: int,
    context: str,
) -> dict[str, Any]:
    """Ejecuta un agente individual con rate limiting."""
    async with sem:
        prompt = ROUND_PROMPTS[round_num].format(idea=context)
        try:
            reply = await generate_text(prompt=prompt)
        except Exception as exc:
            logger.warning("Agent R%d#%d failed: %s", round_num, agent_index, exc)
            reply = f"[error: {exc}]"
        return {"round": round_num, "agent_index": agent_index, "reply": reply}


def _extract_score(reply: str) -> float:
    """Extrae score de surviva del reply JSON del round 3."""
    try:
        data = json.loads(reply)
        return float(data.get("score", 0.5))
    except Exception:
        # Buscar patrón "score": X.X en texto libre
        import re
        m = re.search(r'"score"\s*:\s*([0-9.]+)', reply)
        return float(m.group(1)) if m else 0.5


async def _run_simulation(sim_id: str, sb_url: str, sb_key: str) -> None:
    """Orquesta los 3 rounds de 100 agentes y guarda resultados en Supabase."""
    from app.core.supabase import SupabaseRest
    sb = SupabaseRest()

    queue = _queues.get(sim_id)

    def _emit(event: str, data: dict) -> None:
        if queue:
            queue.put_nowait({"event": event, "data": data})

    sem = asyncio.Semaphore(SEMAPHORE_LIMIT)
    round1_ideas: list[str] = []

    try:
        # ── ROUND 1: 100 Emprendedores generan ideas ──────────────────────────
        _emit("round_start", {"round": 1, "label": ROUND_LABELS[1], "total": 100})

        tasks_r1 = [_run_agent(sem, 1, i, "") for i in range(100)]
        for future in asyncio.as_completed(tasks_r1):
            result = await future
            idea = result["reply"]
            round1_ideas.append(idea)

            row = {
                "round": 1,
                "agent_type": "entrepreneur",
                "business_idea": idea[:500],
                "survival_score": None,
                "analysis": None,
            }
            await sb.insert("simulations", {**row, "metadata": {"sim_id": sim_id}})
            _emit("agent_done", {
                "round": 1,
                "index": result["agent_index"],
                "preview": idea[:120],
            })

        _emit("round_end", {"round": 1, "count": len(round1_ideas)})

        # ── ROUND 2: 100 Auditores critican ideas ─────────────────────────────
        _emit("round_start", {"round": 2, "label": ROUND_LABELS[2], "total": 100})

        tasks_r2 = [
            _run_agent(sem, 2, i, round1_ideas[i % len(round1_ideas)])
            for i in range(100)
        ]
        round2_analyses: list[str] = []
        for future in asyncio.as_completed(tasks_r2):
            result = await future
            analysis = result["reply"]
            round2_analyses.append(analysis)
            await sb.insert("simulations", {
                "round": 2,
                "agent_type": "auditor",
                "analysis": analysis[:500],
                "survival_score": None,
                "business_idea": None,
            })
            _emit("agent_done", {
                "round": 2,
                "index": result["agent_index"],
                "preview": analysis[:120],
            })

        _emit("round_end", {"round": 2, "count": len(round2_analyses)})

        # ── ROUND 3: 100 Futuristas asignan scores ────────────────────────────
        _emit("round_start", {"round": 3, "label": ROUND_LABELS[3], "total": 100})

        tasks_r3 = [
            _run_agent(sem, 3, i, round1_ideas[i % len(round1_ideas)])
            for i in range(100)
        ]
        scores: list[float] = []
        for future in asyncio.as_completed(tasks_r3):
            result = await future
            score = _extract_score(result["reply"])
            scores.append(score)
            await sb.insert("simulations", {
                "round": 3,
                "agent_type": "futurist",
                "survival_score": score,
                "analysis": result["reply"][:500],
                "business_idea": None,
            })
            _emit("agent_done", {
                "round": 3,
                "index": result["agent_index"],
                "score": score,
            })

        _emit("round_end", {"round": 3, "count": len(scores)})

        # ── AGGREGATION ───────────────────────────────────────────────────────
        avg_score = sum(scores) / len(scores) if scores else 0.0
        top_ideas = sorted(
            zip(round1_ideas, scores),
            key=lambda x: x[1],
            reverse=True,
        )[:5]

        _emit("complete", {
            "sim_id": sim_id,
            "avg_score": round(avg_score, 3),
            "top_ideas": [{"idea": idea[:200], "score": score} for idea, score in top_ideas],
            "total_agents": 300,
        })

    except Exception as exc:
        logger.error("Simulation %s failed: %s", sim_id, exc)
        _emit("error", {"detail": str(exc)})
    finally:
        # Signal end of stream
        if queue:
            queue.put_nowait(None)


async def _sse_generator(sim_id: str) -> AsyncGenerator[str, None]:
    """Genera eventos SSE desde la queue de la simulación."""
    queue = _queues.get(sim_id)
    if not queue:
        yield f"data: {json.dumps({'event': 'error', 'data': {'detail': 'sim_id no encontrado'}})}\n\n"
        return

    while True:
        item = await queue.get()
        if item is None:
            yield "data: [DONE]\n\n"
            break
        yield f"event: {item['event']}\ndata: {json.dumps(item['data'])}\n\n"


# ── Modelos ────────────────────────────────────────────────────────────────────

class StartSimRequest(BaseModel):
    label: str = "Simulación 300 agentes"


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/start", status_code=202)
async def start_simulation(
    body: StartSimRequest,
    user: CurrentUser,
    background_tasks: BackgroundTasks,
    sb: SupabaseDep,
) -> dict:
    settings_ref = __import__("app.core.config", fromlist=["get_settings"]).get_settings()
    if not settings_ref.moonshot_api_key:
        raise HTTPException(503, "MOONSHOT_API_KEY no configurada")

    sim_id = uuid.uuid4().hex[:12]
    _queues[sim_id] = asyncio.Queue(maxsize=500)

    background_tasks.add_task(
        _run_simulation,
        sim_id,
        settings_ref.supabase_url,
        settings_ref.supabase_service_key,
    )
    return {"sim_id": sim_id, "message": "Simulación iniciada — conecta al stream SSE"}


@router.get("/{sim_id}/stream")
async def stream_simulation(
    sim_id: str,
    user: CurrentUser,
) -> StreamingResponse:
    if sim_id not in _queues:
        raise HTTPException(404, "Simulación no encontrada o ya finalizada")
    return StreamingResponse(
        _sse_generator(sim_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/list")
async def list_simulations(
    user: CurrentUser,
    sb: SupabaseDep,
) -> list[dict]:
    return await sb.select_many(
        "simulations",
        columns="id,round,agent_type,survival_score,created_at",
        order="created_at.desc",
        limit=300,
    )
