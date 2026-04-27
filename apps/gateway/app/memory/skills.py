"""RAG Skills — búsqueda semántica por keywords en la tabla knowledge (category='skill').

POST /memory/skills/search  — busca skills relevantes para un prompt
GET  /memory/skills         — lista todas las skills disponibles

La búsqueda es keyword-based (tf-idf simple) para evitar depender de pgvector
o de la API de embeddings en cada mensaje. Suficientemente precisa para el uso case.
"""

from __future__ import annotations

import re
import time
from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.core.deps import CurrentUser, SupabaseDep
from app.core.supabase import SupabaseRest

router = APIRouter(prefix="/skills", tags=["skills"])

# ── Cache de skills (TTL 5 min) ───────────────────────────────────────────────
_skills_cache: dict = {"rows": [], "ts": 0.0}
_SKILLS_TTL = 300.0
MATCH_THRESHOLD = 0.15  # score mínimo para inyectar


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-záéíóúüñ\w]+", text.lower()))


def _score(prompt_tokens: set[str], skill_content: str) -> float:
    skill_tokens = _tokenize(skill_content)
    if not skill_tokens:
        return 0.0
    overlap = len(prompt_tokens & skill_tokens)
    # Jaccard-like: overlap / (prompt + skill - overlap)
    union = len(prompt_tokens | skill_tokens)
    return overlap / union if union else 0.0


async def _get_skills() -> list[dict[str, Any]]:
    """Retorna skills del cache o las carga desde Supabase."""
    now = time.monotonic()
    if now - _skills_cache["ts"] < _SKILLS_TTL and _skills_cache["rows"]:
        return _skills_cache["rows"]
    try:
        sb = SupabaseRest()
        rows = await sb.select_many(
            "knowledge",
            filters={"category": "skill"},
            columns="id,content,created_at",
            limit=100,
        )
        _skills_cache["rows"] = rows
        _skills_cache["ts"] = now
        return rows
    except Exception:
        return []


async def search_skills(prompt: str, top_k: int = 3) -> list[dict[str, Any]]:
    """Busca las top_k skills más relevantes para el prompt dado.

    Retorna lista de {id, content, score} con score >= MATCH_THRESHOLD.
    """
    skills = await _get_skills()
    if not skills:
        return []

    prompt_tokens = _tokenize(prompt)
    scored = [
        {"id": s["id"], "content": s["content"], "score": _score(prompt_tokens, s["content"])}
        for s in skills
    ]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return [s for s in scored[:top_k] if s["score"] >= MATCH_THRESHOLD]


def invalidate_skills_cache() -> None:
    """Invalida el cache — llamar cuando se agrega una nueva skill."""
    _skills_cache["ts"] = 0.0


# ── Endpoints ──────────────────────────────────────────────────────────────────

class SkillSearchRequest(BaseModel):
    prompt: str
    top_k: int = 3


@router.post("/search")
async def search_skills_endpoint(
    body: SkillSearchRequest,
    user: CurrentUser,  # noqa: ARG001
) -> list[dict[str, Any]]:
    return await search_skills(body.prompt, body.top_k)


@router.get("")
async def list_skills(
    user: CurrentUser,  # noqa: ARG001
    sb: SupabaseDep,
    q: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
) -> list[dict[str, Any]]:
    ilike = {"content": q} if q else None
    return await sb.select_many_filtered(
        "knowledge",
        columns="id,content,created_at",
        filters={"category": "skill"},
        ilike=ilike,
        order="created_at.desc",
        limit=limit,
    )


@router.post("")
async def add_skill(
    body: dict,
    user: CurrentUser,  # noqa: ARG001
    sb: SupabaseDep,
) -> dict[str, Any]:
    row = await sb.insert("knowledge", {"category": "skill", "content": body.get("content", "")})
    invalidate_skills_cache()
    return row or {}
