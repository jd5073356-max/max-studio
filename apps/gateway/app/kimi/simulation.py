"""Simulación 300 agentes — Kimi K2.6 orquestado en 3 rondas de 100 agentes.

Modos:
  standard  — 3 rondas × 100 agentes (ideas → auditoría → supervivencia)
  portfolio — 12 prompts × 25 agentes = 300 total, guarda 12 docs en /docs

GET  /kimi/simulation/list         — lista simulaciones guardadas
POST /kimi/simulation/start        — inicia simulación (standard o portfolio)
GET  /kimi/simulation/{id}/stream  — SSE de progreso en tiempo real
GET  /kimi/simulation/{id}/report  — estado y resultados finales
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from pathlib import Path
from typing import Any, AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import httpx

from app.core.config import get_settings
from app.core.deps import CurrentUser, SupabaseDep
from app.kimi.client import generate_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/kimi/simulation", tags=["simulation"])

_queues: dict[str, asyncio.Queue] = {}

SEMAPHORE_LIMIT = 1       # Standard mode (Kimi): secuencial — free tier límite 3 concurrent
PORTFOLIO_SEMAPHORE = 20  # Portfolio mode (Anthropic Haiku): 20 concurrent — 1000 RPM disponible
DOCS_DIR = Path("/tmp/max-docs")
DOCS_DIR.mkdir(exist_ok=True)

# ── Standard mode ──────────────────────────────────────────────────────────────

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

# ── Portfolio mode — 12 prompts × 25 agentes = 300 total ─────────────────────

PORTFOLIO_PROMPTS: list[dict[str, str]] = [
    {
        "title": "Business Intelligence LATAM",
        "prompt": (
            "Eres un analista de mercado senior. Genera un Business Intelligence Report completo "
            "sobre el sector de agencias de automatización IA en Latinoamérica 2025-2026.\n\n"
            "Incluye obligatoriamente:\n"
            "1. Tamaño del mercado y tasa de crecimiento (LATAM vs global)\n"
            "2. Top 5 competidores directos con precios, servicios y puntos débiles\n"
            "3. Mapa de oportunidades: nichos subatendidos\n"
            "4. Pricing óptimo para agencia unipersonal en Colombia\n"
            "5. Proyección de ingresos a 3, 6 y 12 meses con supuestos\n"
            "6. Recomendación: servicio #1 para lanzar con máximo ROI\n\n"
            "Formato: reporte ejecutivo con secciones, tablas comparativas. "
            "Que sirva para presentar a un potencial inversionista. Mínimo 600 palabras."
        ),
    },
    {
        "title": "Arquitectura SaaS Dental",
        "prompt": (
            "Eres un arquitecto de software con experiencia en SaaS B2B. Diseña la arquitectura "
            "técnica completa de un sistema de automatización para clínicas dentales en Colombia "
            "a $200 USD/mes.\n\n"
            "El sistema incluye:\n"
            "- Recordatorios de citas por WhatsApp + Email automáticos\n"
            "- CRM ligero integrado con Google Calendar\n"
            "- Panel de métricas (nuevos vs retornantes, cancelaciones)\n"
            "- Generador de reportes mensuales PDF\n"
            "- n8n como motor de automatización (self-hosted VPS $10/mes)\n\n"
            "Genera: diagrama de arquitectura en mermaid, stack tecnológico justificado, "
            "estimación de costos de infraestructura, plan de implementación en 2 semanas, "
            "y SLA que puedes ofrecer al cliente. Mínimo 600 palabras."
        ),
    },
    {
        "title": "Propuesta Comercial Clínica Dental",
        "prompt": (
            "Eres un consultor de ventas B2B especializado en software para clínicas. "
            "Genera una propuesta comercial completa lista para enviar HOY a:\n"
            "Clínica Dental Sonrisa Perfecta, Bogotá, 2 dentistas, ~150 pacientes/mes.\n\n"
            "Incluye:\n"
            "- Diagnóstico del problema actual (sin automatización)\n"
            "- Solución propuesta con descripción de cómo quedaría el sistema\n"
            "- ROI calculado: tiempo que ahorra la recepcionista por semana\n"
            "- Inversión: $200 USD setup + $150 USD/mes mantenimiento\n"
            "- Garantía de 90 días o devolución del setup\n"
            "- 2 casos de éxito inventados pero realistas\n"
            "- Contrato básico de servicios\n"
            "- Próximos pasos con fechas concretas\n\n"
            "Formato Word-ready: secciones claras, tabla de precios. Mínimo 700 palabras."
        ),
    },
    {
        "title": "API Documentation Suite",
        "prompt": (
            "Eres un technical writer senior. Genera la documentación técnica completa de producción "
            "para este endpoint:\n\nPOST /api/v1/dental/appointment/reminder\n"
            "Función: envía recordatorio de cita por WhatsApp\n\n"
            "Documenta como si fuera una startup Serie A:\n"
            "- OpenAPI 3.0 spec completa en YAML\n"
            "- Guía de autenticación (Bearer token + rate limiting)\n"
            "- Request/Response examples para 5 casos de uso\n"
            "- Error codes con descripción y cómo resolverlos\n"
            "- SDK snippets en JavaScript, Python y PHP\n"
            "- Webhook documentation para confirmaciones de lectura\n"
            "- Postman collection JSON lista para importar\n"
            "- Sección de troubleshooting con los 10 errores más comunes\n\n"
            "Que alguien pueda integrar esto sin hablar con nadie. Mínimo 700 palabras."
        ),
    },
    {
        "title": "Email Sequence 7 Correos",
        "prompt": (
            "Eres un copywriter especialista en cold email B2B. "
            "Diseña una secuencia completa de 7 correos para convertir clínicas dentales "
            "en clientes de una agencia de automatización IA a $150 USD/mes:\n\n"
            "Email 1 (día 0): Cold outreach sobre problema que tienen sin saberlo\n"
            "Email 2 (día 2): Caso de estudio + prueba social realista\n"
            "Email 3 (día 4): Demo (guión de video de 2 min)\n"
            "Email 4 (día 7): Objeción 'es muy caro' — respuesta con ROI\n"
            "Email 5 (día 10): Objeción 'no tengo tiempo' — respuesta directa\n"
            "Email 6 (día 14): Scarcity real — solo 3 spots este mes\n"
            "Email 7 (día 17): Breakup email + regalo de despedida\n\n"
            "Para cada email: subject line con A/B variant, preview text 90 chars, "
            "body completo, CTA exacto, P.S. estratégico. Copy humano, no genérico. "
            "Tasa de apertura objetivo >40%. Mínimo 800 palabras total."
        ),
    },
    {
        "title": "n8n Workflow Onboarding Dental",
        "prompt": (
            "Eres un experto en n8n y automatización de procesos. "
            "Diseña el workflow n8n completo de onboarding de cliente dental:\n\n"
            "Trigger: Webhook recibe nuevo cliente (nombre, teléfono, email, dentista)\n\n"
            "Flujo completo:\n"
            "1. Validar datos con JavaScript node\n"
            "2. Crear contacto en Google Contacts\n"
            "3. Enviar WhatsApp bienvenida con fecha primera cita (Twilio)\n"
            "4. Crear evento en Google Calendar del dentista\n"
            "5. Enviar email de confirmación con plantilla HTML\n"
            "6. Registrar en Airtable como 'nuevo cliente'\n"
            "7. Notificar al dentista por Telegram\n"
            "8. Si falla cualquier paso: alerta a Slack + retry automático\n\n"
            "Genera: JSON exportable del workflow (completo y funcional), "
            "documentación de cada nodo, variables de entorno requeridas, "
            "y guía de testing paso a paso. Mínimo 600 palabras."
        ),
    },
    {
        "title": "Dashboard Analytics Dental — Código",
        "prompt": (
            "Eres un frontend developer senior especializado en dashboards de datos. "
            "Genera el código TypeScript completo de un dashboard de analytics para clínica dental:\n\n"
            "Tech stack: Next.js 16 + TypeScript + Recharts + Tailwind v4\n\n"
            "Componentes a generar con código real:\n"
            "- KPICard: métrica con trend indicator (↑↓ vs mes anterior)\n"
            "- AppointmentCalendar: heatmap de citas por día\n"
            "- RevenueChart: área chart mensual con forecast punteado\n"
            "- PatientRetentionFunnel: funnel nuevos→retornantes→perdidos\n"
            "- TopServicesTable: tabla rankeable de servicios\n\n"
            "Datos: mock data realista (150 pacientes/mes, 2 dentistas, Colombia)\n"
            "Diseño: dark mode, colores médicos, denso pero legible.\n"
            "Genera el código completo y funcional. Mínimo 600 palabras de código real."
        ),
    },
    {
        "title": "Python Campaign Script",
        "prompt": (
            "Eres un Python developer con experiencia en automatización y marketing. "
            "Escribe un script Python de producción completo que:\n\n"
            "1. Lee lista de clínicas dentales desde CSV (nombre, email, teléfono, ciudad)\n"
            "2. Clasifica cada clínica por 'pain score' (pocas reseñas = más dolor)\n"
            "3. Genera email personalizado para cada una usando OpenAI API\n"
            "4. Envía emails por lotes de 10/hora con rate limiting\n"
            "5. Registra cada envío en SQLite con status y timestamp\n"
            "6. Genera reporte diario en markdown con estadísticas de campaña\n\n"
            "Estilo: clean, type hints completos, logging estructurado, "
            "manejo de errores robusto, retry con backoff.\n"
            "Uso: python campaign.py --city=bogota --limit=100\n"
            "Genera el código completo y funcional. Mínimo 600 palabras de código real."
        ),
    },
    {
        "title": "Go-to-Market Strategy AutoFlow",
        "prompt": (
            "Eres un CMO con experiencia en lanzamiento de SaaS en mercados emergentes. "
            "Crea el plan Go-to-Market completo para lanzar una agencia de automatización "
            "IA (AutoFlow Studio) en Colombia, enfocado en clínicas dentales:\n\n"
            "- ICP: datos demográficos, psicográficos y conductuales del cliente ideal\n"
            "- Canales de adquisición rankeados por CAC estimado y tiempo de cierre\n"
            "- Guión de llamada en frío de 30 segundos + manejo de 5 objeciones\n"
            "- Plan de contenido LinkedIn 30 días (posts, frecuencia, formato)\n"
            "- Pricing ladder: desde $50 USD (básico) hasta $500 USD (enterprise)\n"
            "- OKRs para Q2 2026: leads, demos, cierres, MRR objetivo\n\n"
            "Cada sección termina con 'Acción esta semana:' con tarea concreta. "
            "Que sea ejecutable, no corporativo. Mínimo 700 palabras."
        ),
    },
    {
        "title": "Sistema Contenido LinkedIn 30 días",
        "prompt": (
            "Eres un estratega de contenido B2B especializado en LinkedIn para fundadores. "
            "Diseña el sistema completo de contenido para posicionar AutoFlow Studio "
            "(agencia de automatización IA, founder de 18 años, Colombia):\n\n"
            "- 30 hooks magnéticos para posts de LinkedIn (primera oración que para el scroll)\n"
            "- 10 estructuras de post tipo 'antes/después' con métricas reales\n"
            "- 5 guiones para videos cortos (<60s) mostrando automatizaciones\n"
            "- Calendario editorial mayo 2026: día a día, 5 posts/semana\n"
            "- Strategy para producir todo el contenido en 30 min/semana total\n\n"
            "El contenido debe ser tan técnico y específico que los dentistas digan "
            "'este chico sí sabe de lo que habla'. Mínimo 800 palabras."
        ),
    },
    {
        "title": "Pitch Deck Investor + Financial Model",
        "prompt": (
            "Eres un venture capital associate con experiencia en startups early-stage LATAM. "
            "Crea el pitch deck ejecutivo de AutoFlow Studio para ronda seed de $15,000 USD:\n\n"
            "Slides completas (contenido real de cada una):\n"
            "1. Cover — problema en una frase\n"
            "2. Problem — dolor del dentista con datos reales\n"
            "3. Solution — demo del producto en 3 bullets\n"
            "4. Market Size — TAM/SAM/SOM mercado dental Colombia\n"
            "5. Business Model — revenue streams + unit economics\n"
            "6. Traction — métricas actuales (honesto: en construcción)\n"
            "7. Go-to-Market — cómo llegar a 50 clientes en 6 meses\n"
            "8. Team — Juan David (18 años, founder) + skills únicos\n"
            "9. Financials — P&L proyectado 18 meses con supuestos\n"
            "10. The Ask — $15k para qué exactamente (breakdown)\n\n"
            "Modelo financiero en tabla: MRR, churn, CAC, LTV para 3 escenarios. "
            "Mínimo 800 palabras."
        ),
    },
    {
        "title": "Análisis Competitivo + Script de Ventas",
        "prompt": (
            "Eres un consultor estratégico con especialidad en análisis competitivo de SaaS. "
            "Crea el análisis competitivo de AutoFlow Studio vs las principales soluciones "
            "de automatización para PYMEs en Colombia:\n\n"
            "- Tabla feature-by-feature vs Make.com, Zapier, Manychat, ActiveCampaign\n"
            "- Pricing comparativo en COP y USD\n"
            "- Por qué AutoFlow gana en segmento de clínicas dentales locales\n"
            "- Mapa de posicionamiento (precio vs valor)\n"
            "- Script de ventas de 3 minutos basado en las diferencias\n"
            "- Respuestas a las 5 objeciones más comunes comparando con competidores\n"
            "- Deck de 1 página que el cliente puede quedarse después de la reunión\n\n"
            "Que el análisis sea tan bueno que se pueda usar en reuniones de ventas reales. "
            "Mínimo 700 palabras."
        ),
    },
]


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _run_agent(
    sem: asyncio.Semaphore,
    round_num: int,
    agent_index: int,
    context: str,
) -> dict[str, Any]:
    """Ejecuta un agente con retry FUERA del semáforo para no bloquear slots."""
    prompt = ROUND_PROMPTS[round_num].format(idea=context)
    reply = await _call_kimi_safe(sem, f"R{round_num}#{agent_index}", prompt)
    return {"round": round_num, "agent_index": agent_index, "reply": reply}


async def _run_portfolio_agent(
    sem: asyncio.Semaphore,
    prompt_idx: int,
    agent_index: int,
    prompt: str,
) -> dict[str, Any]:
    """Ejecuta un agente portfolio via Anthropic Claude Haiku — 1000 RPM, alta concurrencia."""
    reply = await _call_anthropic_fast(sem, f"P{prompt_idx}#{agent_index}", prompt)
    return {"prompt_idx": prompt_idx, "agent_index": agent_index, "reply": reply}


async def _call_anthropic_fast(sem: asyncio.Semaphore, label: str, prompt: str) -> str:
    """Llama a Claude Haiku directamente con hasta 20 requests simultáneos.
    Sin retry agresivo — Anthropic 1000 RPM rara vez da 429 con semáforo 20.
    """
    settings = get_settings()
    api_key = settings.anthropic_api_key
    if not api_key:
        return "[error: ANTHROPIC_API_KEY no configurada]"

    MAX_RETRIES = 3
    for attempt in range(MAX_RETRIES):
        async with sem:
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.post(
                        "https://api.anthropic.com/v1/messages",
                        headers={
                            "x-api-key": api_key,
                            "anthropic-version": "2023-06-01",
                            "content-type": "application/json",
                        },
                        json={
                            "model": "claude-haiku-4-5",
                            "max_tokens": 4096,
                            "messages": [{"role": "user", "content": prompt}],
                        },
                    )
                if resp.status_code == 200:
                    data = resp.json()
                    return data["content"][0]["text"]
                if resp.status_code == 429 and attempt < MAX_RETRIES - 1:
                    logger.info("Anthropic 429 %s — retry %d", label, attempt + 1)
                else:
                    logger.warning("Anthropic %d %s: %s", resp.status_code, label, resp.text[:200])
                    return f"[error: Anthropic {resp.status_code}]"
            except Exception as exc:
                logger.warning("Anthropic agent %s failed: %s", label, exc)
                if attempt == MAX_RETRIES - 1:
                    return f"[error: {exc}]"
        await asyncio.sleep(2 * (attempt + 1))
    return "[error: max retries]"


async def _call_kimi_safe(sem: asyncio.Semaphore, label: str, prompt: str) -> str:
    """Adquiere semáforo → llama Kimi → libera → retry si 429 (sleep fuera del lock)."""
    MAX_RETRIES = 5
    for attempt in range(MAX_RETRIES):
        async with sem:
            try:
                return await generate_text(prompt=prompt)
            except Exception as exc:
                msg = str(exc)
                is_429 = "429" in msg or "concurrency" in msg.lower()
                if not is_429 or attempt == MAX_RETRIES - 1:
                    logger.warning("Agent %s failed permanently: %s", label, msg[:120])
                    return f"[error: {msg[:200]}]"
                # 429: liberar semáforo ANTES de dormir
                wait = 5 * (attempt + 1)  # 5s, 10s, 15s, 20s, 25s
                logger.info("Kimi 429 %s — attempt %d/%d, waiting %ds", label, attempt + 1, MAX_RETRIES, wait)
        # sleep FUERA del 'async with sem' — semáforo libre para otros
        await asyncio.sleep(wait)
    return "[error: max retries exceeded]"


def _extract_score(reply: str) -> float:
    try:
        data = json.loads(reply)
        return float(data.get("score", 0.5))
    except Exception:
        import re
        m = re.search(r'"score"\s*:\s*([0-9.]+)', reply)
        return float(m.group(1)) if m else 0.5


def _select_best(outputs: list[str]) -> str:
    """Selecciona el output más completo (más largo, sin errores)."""
    valid = [o for o in outputs if not o.startswith("[error") and len(o) > 100]
    if not valid:
        return outputs[0] if outputs else "[Sin output]"
    return max(valid, key=len)


# ── Standard simulation ────────────────────────────────────────────────────────

async def _run_simulation(sim_id: str, sb_url: str, sb_key: str) -> None:
    from app.core.supabase import SupabaseRest
    sb = SupabaseRest()
    queue = _queues.get(sim_id)

    def _emit(event: str, data: dict) -> None:
        if queue:
            queue.put_nowait({"event": event, "data": data})

    sem = asyncio.Semaphore(SEMAPHORE_LIMIT)
    round1_ideas: list[str] = []

    try:
        _emit("round_start", {"round": 1, "label": ROUND_LABELS[1], "total": 100})
        tasks_r1 = [_run_agent(sem, 1, i, "") for i in range(100)]
        for future in asyncio.as_completed(tasks_r1):
            result = await future
            idea = result["reply"]
            round1_ideas.append(idea)
            await sb.insert("simulations", {"round": 1, "agent_type": "entrepreneur",
                "business_idea": idea[:500], "survival_score": None, "analysis": None,
                "metadata": {"sim_id": sim_id}})
            _emit("agent_done", {"round": 1, "index": result["agent_index"], "preview": idea[:120]})
        _emit("round_end", {"round": 1, "count": len(round1_ideas)})

        _emit("round_start", {"round": 2, "label": ROUND_LABELS[2], "total": 100})
        tasks_r2 = [_run_agent(sem, 2, i, round1_ideas[i % len(round1_ideas)]) for i in range(100)]
        round2_analyses: list[str] = []
        for future in asyncio.as_completed(tasks_r2):
            result = await future
            analysis = result["reply"]
            round2_analyses.append(analysis)
            await sb.insert("simulations", {"round": 2, "agent_type": "auditor",
                "analysis": analysis[:500], "survival_score": None, "business_idea": None})
            _emit("agent_done", {"round": 2, "index": result["agent_index"], "preview": analysis[:120]})
        _emit("round_end", {"round": 2, "count": len(round2_analyses)})

        _emit("round_start", {"round": 3, "label": ROUND_LABELS[3], "total": 100})
        tasks_r3 = [_run_agent(sem, 3, i, round1_ideas[i % len(round1_ideas)]) for i in range(100)]
        scores: list[float] = []
        for future in asyncio.as_completed(tasks_r3):
            result = await future
            score = _extract_score(result["reply"])
            scores.append(score)
            await sb.insert("simulations", {"round": 3, "agent_type": "futurist",
                "survival_score": score, "analysis": result["reply"][:500], "business_idea": None})
            _emit("agent_done", {"round": 3, "index": result["agent_index"], "score": score})
        _emit("round_end", {"round": 3, "count": len(scores)})

        avg_score = sum(scores) / len(scores) if scores else 0.0
        top_ideas = sorted(zip(round1_ideas, scores), key=lambda x: x[1], reverse=True)[:5]
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
        if queue:
            queue.put_nowait(None)
        async def _cleanup() -> None:
            await asyncio.sleep(300)
            _queues.pop(sim_id, None)
        asyncio.create_task(_cleanup())


# ── Portfolio simulation ───────────────────────────────────────────────────────

async def _run_portfolio_simulation(sim_id: str) -> None:
    """12 prompts × 25 agentes = 300 total via Anthropic Haiku.
    20 agentes concurrentes → ~2 min total vs 40 min con Kimi secuencial.
    """
    from app.core.supabase import SupabaseRest
    sb = SupabaseRest()
    queue = _queues.get(sim_id)

    def _emit(event: str, data: dict) -> None:
        if queue:
            queue.put_nowait({"event": event, "data": data})

    sem = asyncio.Semaphore(PORTFOLIO_SEMAPHORE)  # 20 concurrent Anthropic requests
    AGENTS_PER_PROMPT = 25
    docs_created: list[dict] = []

    try:
        for i, pdata in enumerate(PORTFOLIO_PROMPTS):
            round_num = i + 1
            label = f"P{round_num}: {pdata['title']}"
            _emit("round_start", {"round": round_num, "label": label, "total": AGENTS_PER_PROMPT})

            tasks = [
                _run_portfolio_agent(sem, round_num, j, pdata["prompt"])
                for j in range(AGENTS_PER_PROMPT)
            ]
            outputs: list[str] = []
            for future in asyncio.as_completed(tasks):
                result = await future
                outputs.append(result["reply"])
                _emit("agent_done", {
                    "round": round_num,
                    "index": result["agent_index"],
                    "preview": result["reply"][:80] if not result["reply"].startswith("[error") else None,
                    "score": len(result["reply"]) / 100 if not result["reply"].startswith("[error") else 0,
                })

            # Seleccionar el mejor output
            best = _select_best(outputs)

            # Guardar como doc en disco + Supabase
            safe_title = pdata["title"].replace(" ", "_").replace("/", "-").lower()
            filename = f"portfolio_{i+1:02d}_{safe_title}_{sim_id[:6]}.md"
            filepath = DOCS_DIR / filename
            md_content = f"# {pdata['title']}\n\n*Generado por 25 agentes Kimi K2.6 — SimID: {sim_id}*\n\n---\n\n{best}"
            filepath.write_text(md_content, encoding="utf-8")

            row = await sb.insert("generated_docs", {
                "filename": filename,
                "mime_type": "text/markdown",
                "storage_path": str(filepath),
                "size_bytes": filepath.stat().st_size,
            })
            doc_id = (row or {}).get("id")
            docs_created.append({"title": pdata["title"], "doc_id": doc_id, "filename": filename})

            _emit("round_end", {"round": round_num, "doc_id": doc_id, "filename": filename})
            logger.info("Portfolio P%d '%s' done — doc_id=%s", round_num, pdata["title"], doc_id)

        _emit("complete", {
            "sim_id": sim_id,
            "mode": "portfolio",
            "avg_score": 1.0,
            "top_ideas": [{"idea": d["title"], "score": 1.0} for d in docs_created],
            "total_agents": 300,
            "docs": docs_created,
        })

    except Exception as exc:
        logger.error("Portfolio sim %s failed: %s", sim_id, exc)
        _emit("error", {"detail": str(exc)})
    finally:
        if queue:
            queue.put_nowait(None)
        async def _cleanup() -> None:
            await asyncio.sleep(300)
            _queues.pop(sim_id, None)
        asyncio.create_task(_cleanup())


# ── SSE generator ──────────────────────────────────────────────────────────────

async def _sse_generator(sim_id: str) -> AsyncGenerator[str, None]:
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


# ── Request models ─────────────────────────────────────────────────────────────

class StartSimRequest(BaseModel):
    label: str = "Simulación 300 agentes"
    mode: str = "standard"  # "standard" | "portfolio"


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
    _queues[sim_id] = asyncio.Queue(maxsize=1000)

    if body.mode == "portfolio":
        background_tasks.add_task(_run_portfolio_simulation, sim_id)
        return {
            "sim_id": sim_id,
            "mode": "portfolio",
            "message": f"Portfolio iniciado: {len(PORTFOLIO_PROMPTS)} prompts × 25 agentes = 300 total",
        }
    else:
        background_tasks.add_task(
            _run_simulation,
            sim_id,
            settings_ref.supabase_url,
            settings_ref.supabase_service_key,
        )
        return {"sim_id": sim_id, "mode": "standard", "message": "Simulación iniciada — conecta al stream SSE"}


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
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
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
