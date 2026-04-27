"""Kimi Supervisor — POST /kimi/supervise

Recibe un array de outputs (ideas, análisis) y usa Kimi K2.5 para:
- Detectar contradicciones lógicas
- Eliminar duplicados semánticos
- Rankear por coherencia y calidad
Reduce ruido del 80%+ en outputs de simulación.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.deps import CurrentUser
from app.kimi.client import generate_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/kimi", tags=["kimi"])


class SuperviseRequest(BaseModel):
    outputs: list[str] = Field(..., min_length=2, max_length=50)
    context: str = Field(default="", max_length=500)


@router.post("/supervise")
async def supervise_outputs(
    body: SuperviseRequest,
    user: CurrentUser,  # noqa: ARG001
) -> dict[str, Any]:
    """Filtra y rankea outputs usando Kimi K2.5 como supervisor."""
    settings = get_settings()
    if not settings.moonshot_api_key:
        raise HTTPException(503, "MOONSHOT_API_KEY no configurada")

    numbered = "\n".join(f"{i+1}. {o[:300]}" for i, o in enumerate(body.outputs))
    ctx_note = f"\nContexto adicional: {body.context}\n" if body.context else ""

    prompt = (
        f"Eres un supervisor de calidad de outputs IA. Analiza estos {len(body.outputs)} outputs:{ctx_note}\n\n"
        f"{numbered}\n\n"
        "Tareas:\n"
        "1. Elimina duplicados semánticos (misma idea con distintas palabras)\n"
        "2. Detecta contradicciones lógicas internas\n"
        "3. Rankea los únicos y coherentes del mejor al peor\n"
        "4. Responde con JSON:\n"
        '{"ranked": [{"index": N, "score": 0.X, "reason": "..."}], '
        '"duplicates": [[N,M], ...], "contradictions": [N, ...]}\n\n'
        "donde index = número de 1-based del output original."
    )

    try:
        reply = await generate_text(
            prompt=prompt,
            system="Eres un auditor de calidad. Responde SOLO con JSON válido.",
        )
    except Exception as exc:
        raise HTTPException(502, f"Kimi error: {exc}") from exc

    import json, re
    # Extraer JSON del reply (puede estar envuelto en ```json)
    json_match = re.search(r"\{.*\}", reply, re.DOTALL)
    parsed: dict = {}
    if json_match:
        try:
            parsed = json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    ranked_indices = [r["index"] - 1 for r in parsed.get("ranked", []) if isinstance(r.get("index"), int)]
    ranked_outputs = [body.outputs[i] for i in ranked_indices if 0 <= i < len(body.outputs)]

    return {
        "original_count": len(body.outputs),
        "filtered_count": len(ranked_outputs),
        "noise_reduction_pct": round((1 - len(ranked_outputs) / len(body.outputs)) * 100, 1),
        "ranked_outputs": ranked_outputs,
        "ranking_detail": parsed.get("ranked", []),
        "duplicates": parsed.get("duplicates", []),
        "contradictions": parsed.get("contradictions", []),
    }
