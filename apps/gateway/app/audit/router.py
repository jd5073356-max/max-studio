"""Opus Auditor — auditoría de código y negocios con Claude Opus 4.7.

POST /audit/security   — código → análisis OWASP Top 10 + secretos expuestos
POST /audit/business   — idea de negocio → validación crítica con argumentos
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.deps import CurrentUser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["audit"])

OPUS_MODEL = "claude-opus-4-7"

_SECURITY_SYSTEM = (
    "Eres un experto en seguridad informática con conocimiento profundo de OWASP Top 10 2025. "
    "Analiza código de forma exhaustiva. Sé específico con líneas y patrones problemáticos."
)

_BUSINESS_SYSTEM = (
    "Eres un analista de negocios con pensamiento crítico riguroso. "
    "Tu trabajo es encontrar fallas en ideas de negocio antes de que cuesten dinero. "
    "Sé directo, específico y sin diplomacia innecesaria."
)


async def _call_opus(system: str, prompt: str) -> str:
    """Llama a Claude Opus 4.7 vía dispatcher bypass."""
    from app.chat.dispatcher import _via_anthropic
    settings = get_settings()

    if not settings.anthropic_api_key:
        raise HTTPException(503, "ANTHROPIC_API_KEY no configurada")

    result = ""
    async for token in _via_anthropic(prompt, [], settings, OPUS_MODEL):
        result += token

    # Override system prompt para esta llamada — _via_anthropic usa _build_system_prompt()
    # Necesitamos llamar Anthropic directamente con el system correcto
    return result


async def _call_opus_direct(system: str, prompt: str) -> str:
    """Llama directamente a Anthropic con system prompt específico."""
    import httpx, json
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(503, "ANTHROPIC_API_KEY no configurada")

    headers = {
        "x-api-key": settings.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    body = {
        "model": OPUS_MODEL,
        "max_tokens": 4096,
        "system": system,
        "messages": [{"role": "user", "content": prompt}],
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=body,
        )

    if resp.status_code != 200:
        raise HTTPException(502, f"Anthropic error {resp.status_code}: {resp.text[:200]}")

    data = resp.json()
    return data["content"][0]["text"]


# ── Security Audit ─────────────────────────────────────────────────────────────

class SecurityAuditRequest(BaseModel):
    code: str = Field(..., min_length=10, max_length=50_000, description="Código fuente a auditar")
    language: str = Field(default="python", max_length=20)
    filename: str = Field(default="", max_length=100)


@router.post("/security")
async def audit_security(
    body: SecurityAuditRequest,
    user: CurrentUser,  # noqa: ARG001
) -> dict[str, Any]:
    """Auditoría de seguridad con Claude Opus 4.7 (OWASP Top 10 2025)."""
    filename_note = f"\nArchivo: {body.filename}" if body.filename else ""
    prompt = (
        f"Audita este código {body.language} para vulnerabilidades de seguridad:{filename_note}\n\n"
        f"```{body.language}\n{body.code}\n```\n\n"
        "Estructura tu respuesta así:\n"
        "## Resumen ejecutivo\n"
        "## Vulnerabilidades encontradas (por severidad: CRÍTICA > ALTA > MEDIA > BAJA)\n"
        "Para cada una: qué es, línea/patrón afectado, impacto, fix recomendado\n"
        "## Secretos expuestos (API keys, passwords hardcoded, etc.)\n"
        "## Score de seguridad (0-100) y justificación\n"
        "## Próximos 3 pasos de remediación"
    )

    try:
        report = await _call_opus_direct(_SECURITY_SYSTEM, prompt)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, str(exc)) from exc

    return {
        "filename": body.filename,
        "language": body.language,
        "model": OPUS_MODEL,
        "report": report,
        "code_lines": len(body.code.split("\n")),
    }


# ── Business Audit ─────────────────────────────────────────────────────────────

class BusinessAuditRequest(BaseModel):
    idea: str = Field(..., min_length=20, max_length=5_000, description="Descripción de la idea de negocio")
    market: str = Field(default="", max_length=200, description="Mercado objetivo")
    investment: float = Field(default=0.0, ge=0)


@router.post("/business")
async def audit_business(
    body: BusinessAuditRequest,
    user: CurrentUser,  # noqa: ARG001
) -> dict[str, Any]:
    """Auditoría de idea de negocio con Claude Opus 4.7."""
    inv_note = f"\nInversión inicial: ${body.investment:,.0f}" if body.investment > 0 else ""
    market_note = f"\nMercado objetivo: {body.market}" if body.market else ""

    prompt = (
        f"Idea de negocio:{market_note}{inv_note}\n\n{body.idea}\n\n"
        "Analiza críticamente aplicando pensamiento riguroso:\n\n"
        "## Fortalezas reales (solo las genuinas, no relleno)\n"
        "## Fallas críticas (las que pueden hundir el negocio)\n"
        "## Supuestos no verificados (lista de hipótesis que hay que validar)\n"
        "## Análisis de competencia (quién ya lo hace mejor y por qué)\n"
        "## Veredicto: VIABLE / VIABLE CON CAMBIOS / NO VIABLE\n"
        "## Si viable: los 3 primeros pasos concretos de hoy\n"
        "## Si no viable: qué pivote lo haría funcionar"
    )

    try:
        report = await _call_opus_direct(_BUSINESS_SYSTEM, prompt)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, str(exc)) from exc

    verdict = "DESCONOCIDO"
    for line in report.split("\n"):
        if "VIABLE" in line.upper():
            if "NO VIABLE" in line.upper():
                verdict = "NO VIABLE"
            elif "CON CAMBIOS" in line.upper():
                verdict = "VIABLE CON CAMBIOS"
            else:
                verdict = "VIABLE"
            break

    return {
        "model": OPUS_MODEL,
        "verdict": verdict,
        "report": report,
    }
