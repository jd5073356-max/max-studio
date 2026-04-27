"""Monte Carlo Financiero — POST /simulations/monte_carlo

GPT-120 (via Dispatch) genera el modelo matemático + script Python,
que se ejecuta inline (sin Docker). Output: distribución, P10/P50/P90, fórmulas LaTeX.
"""

from __future__ import annotations

import asyncio
import logging
import random
import math
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.chat.dispatcher import stream_response
from app.core.deps import CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/simulations", tags=["simulations"])


class MonteCarloRequest(BaseModel):
    business_name: str = Field(..., max_length=100)
    initial_investment: float = Field(..., gt=0)
    monthly_costs: float = Field(..., gt=0)
    market_size: float = Field(..., gt=0, description="Tamaño de mercado en USD")
    variables: list[str] = Field(default_factory=list, max_length=10)
    iterations: int = Field(default=10_000, ge=1000, le=100_000)


def _run_simulation(req: MonteCarloRequest) -> dict[str, Any]:
    """Corre la simulación Monte Carlo numéricamente."""
    iters = req.iterations
    # Variables de incertidumbre: captura_mercado 0.1–15%, crecimiento mensual -5%–+20%
    results = []

    base_capture = 0.02  # 2% mercado inicial
    capture_std = 0.03

    for _ in range(iters):
        # Simular 12 meses
        market_capture = max(0.0, random.gauss(base_capture, capture_std))
        monthly_revenue = req.market_size * market_capture / 12
        growth_rate = random.gauss(0.05, 0.08)

        annual_revenue = 0.0
        revenue = monthly_revenue
        for _ in range(12):
            annual_revenue += revenue
            revenue *= (1 + growth_rate)

        annual_profit = annual_revenue - req.monthly_costs * 12 - req.initial_investment
        roi = annual_profit / req.initial_investment if req.initial_investment > 0 else 0.0
        results.append(roi)

    results.sort()
    p10 = results[int(iters * 0.10)]
    p50 = results[int(iters * 0.50)]
    p90 = results[int(iters * 0.90)]
    mean = sum(results) / iters
    positive_pct = sum(1 for r in results if r > 0) / iters * 100

    return {
        "p10": round(p10 * 100, 1),
        "p50": round(p50 * 100, 1),
        "p90": round(p90 * 100, 1),
        "mean_roi": round(mean * 100, 1),
        "positive_probability": round(positive_pct, 1),
        "iterations": iters,
    }


async def _generate_analysis(req: MonteCarloRequest, stats: dict) -> str:
    """Pide a GPT-120 (via Dispatch) un análisis narrativo de los resultados."""
    prompt = (
        f"Analiza estos resultados de simulación Monte Carlo ({req.iterations:,} iteraciones) "
        f"para el negocio '{req.business_name}':\n\n"
        f"- Inversión inicial: ${req.initial_investment:,.0f}\n"
        f"- Costos mensuales: ${req.monthly_costs:,.0f}\n"
        f"- Tamaño de mercado: ${req.market_size:,.0f}\n"
        f"- ROI P10 (pesimista): {stats['p10']}%\n"
        f"- ROI P50 (base): {stats['p50']}%\n"
        f"- ROI P90 (optimista): {stats['p90']}%\n"
        f"- ROI promedio: {stats['mean_roi']}%\n"
        f"- Probabilidad de éxito: {stats['positive_probability']}%\n\n"
        f"Variables adicionales: {', '.join(req.variables) if req.variables else 'ninguna'}\n\n"
        "En 200 palabras: ¿vale la pena la inversión? ¿Qué riesgos son críticos? "
        "Da recomendaciones concretas. Incluye 2 fórmulas LaTeX del modelo."
    )
    analysis = ""
    try:
        async for token in stream_response(prompt, [], model=None):
            analysis += token
    except Exception as exc:
        logger.warning("Monte Carlo analysis failed: %s", exc)
        analysis = "Análisis no disponible — verifica la conexión con Dispatch."
    return analysis


@router.post("/monte_carlo")
async def run_monte_carlo(
    body: MonteCarloRequest,
    user: CurrentUser,  # noqa: ARG001
) -> dict[str, Any]:
    """Simulación Monte Carlo financiera con análisis narrativo de GPT-120."""
    stats = await asyncio.to_thread(_run_simulation, body)

    analysis = await _generate_analysis(body, stats)

    return {
        "business_name": body.business_name,
        "stats": stats,
        "analysis": analysis,
        "latex_model": (
            r"ROI = \frac{R_{anual} - C_{anual} - I_0}{I_0} \times 100\%"
            "\n\n"
            r"P(ROI > 0) = \frac{|\{x \in S : x > 0\}|}{|S|}"
        ),
    }
