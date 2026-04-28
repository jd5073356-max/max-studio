"""Endpoints de monitoreo del sistema.

- `POST /system/heartbeat` — recibe pings del agente PC (protegido con X-Agent-Key).
- `GET /system/status` — agrega último heartbeat + health de servicios MAX.
- `GET /system/memory` — uso de RAM del proceso gateway.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field

from app.core.deps import CurrentUser, SettingsDep, SupabaseDep

router = APIRouter(prefix="/system", tags=["system"])

# Umbral para considerar al agente online (segundos desde último heartbeat).
AGENT_ONLINE_THRESHOLD_S = 30


# ────────────────────────────────────────────────────────────────────
# Heartbeat del agente
# ────────────────────────────────────────────────────────────────────


class HeartbeatPayload(BaseModel):
    agent_id: str = Field(default="agent_pc", max_length=50)
    metadata: dict = Field(default_factory=dict)


async def verify_agent_key(
    settings: SettingsDep,
    x_agent_key: str | None = Header(default=None, alias="X-Agent-Key"),
) -> None:
    if not x_agent_key or x_agent_key != settings.agent_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="X-Agent-Key inválida",
        )


@router.post("/heartbeat", dependencies=[Depends(verify_agent_key)])
async def heartbeat(payload: HeartbeatPayload, sb: SupabaseDep) -> dict:
    """Registra un heartbeat del agente PC."""
    await sb.insert(
        "agent_heartbeats",
        {
            "agent_id": payload.agent_id,
            "metadata": payload.metadata,
        },
        returning=False,
    )
    return {"ok": True, "received_at": datetime.now(timezone.utc).isoformat()}


# ────────────────────────────────────────────────────────────────────
# Health check de servicios MAX
# ────────────────────────────────────────────────────────────────────

ServiceName = Literal["dispatch", "pi", "openclaw"]


async def _ping_service(name: str, url: str, timeout: float = 2.0) -> dict:
    """Ping rápido a `/health` o root — devuelve status + latency."""
    target = url.rstrip("/") + "/health"
    started = asyncio.get_event_loop().time()
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(target)
        latency_ms = int((asyncio.get_event_loop().time() - started) * 1000)
        return {
            "name": name,
            "url": url,
            "status": "online" if resp.status_code < 500 else "degraded",
            "http_code": resp.status_code,
            "latency_ms": latency_ms,
        }
    except (httpx.ConnectError, httpx.ConnectTimeout):
        return {
            "name": name,
            "url": url,
            "status": "offline",
            "http_code": None,
            "latency_ms": None,
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "name": name,
            "url": url,
            "status": "error",
            "http_code": None,
            "latency_ms": None,
            "error": str(exc)[:120],
        }


@router.get("/status")
async def get_status(
    sb: SupabaseDep, settings: SettingsDep, _user: CurrentUser
) -> dict:
    """Devuelve estado completo del sistema: agente PC + servicios MAX."""
    # 1. Último heartbeat
    heartbeats = await sb.select_many(
        "agent_heartbeats",
        columns="id,agent_id,received_at,metadata",
        order="received_at.desc",
        limit=1,
    )
    last_hb = heartbeats[0] if heartbeats else None

    agent_online = False
    seconds_since = None
    if last_hb:
        try:
            ts = datetime.fromisoformat(
                last_hb["received_at"].replace("Z", "+00:00")
            )
            delta = datetime.now(timezone.utc) - ts
            seconds_since = int(delta.total_seconds())
            agent_online = seconds_since <= AGENT_ONLINE_THRESHOLD_S
        except (ValueError, KeyError):
            pass

    # 2. Ping de servicios MAX en paralelo
    services = await asyncio.gather(
        _ping_service("dispatch", settings.dispatch_url),
        _ping_service("pi", settings.pi_service_url),
        _ping_service("openclaw", settings.openclaw_url),
    )

    return {
        "agent": {
            "online": agent_online,
            "last_heartbeat": last_hb["received_at"] if last_hb else None,
            "seconds_since": seconds_since,
            "metadata": (last_hb or {}).get("metadata") or {},
        },
        "services": services,
        "gateway": {
            "status": "online",
            "checked_at": datetime.now(timezone.utc).isoformat(),
        },
    }


@router.get("/models")
async def get_models(settings: SettingsDep, _user: CurrentUser) -> dict:
    """Devuelve el stack de modelos IA configurados y su estado."""
    dispatch_ping = await _ping_service("dispatch", settings.dispatch_url)

    models = [
        {
            "id": "gpt-oss-120b",
            "name": "gpt-oss:120b",
            "provider": "Ollama (EC2)",
            "role": "Chat principal",
            "status": dispatch_ping["status"],
            "via": "Dispatch",
        },
        {
            "id": "kimi-k2",
            "name": "Kimi K2.6",
            "provider": "Moonshot AI",
            "role": "Vision · Docs · Proyectos",
            "status": "configured" if settings.moonshot_api_key else "not_configured",
            "via": "API directa",
        },
        {
            "id": "kimi-k25",
            "name": "kimi-k2.5",
            "provider": "Ollama (EC2)",
            "role": "Fallback calidad",
            "status": dispatch_ping["status"],
            "via": "Dispatch",
        },
        {
            "id": "claude-sonnet",
            "name": "Claude Sonnet 4.6",
            "provider": "Anthropic",
            "role": "Fallback nube",
            "status": "configured" if settings.anthropic_api_key else "not_configured",
            "via": "API directa",
        },
    ]

    return {
        "models": models,
        "default_model": settings.default_model,
        "kimi_model": settings.moonshot_model,
    }


@router.get("/memory")
async def get_memory(_user: CurrentUser) -> dict:
    """Uso de RAM del proceso gateway (requiere /proc — solo Linux)."""
    info: dict = {"pid": os.getpid()}
    try:
        with open(f"/proc/{os.getpid()}/status") as f:
            for line in f:
                if line.startswith(("VmRSS:", "VmPeak:", "VmSize:")):
                    key, val = line.split(":", 1)
                    info[key.strip()] = val.strip()
    except OSError:
        info["note"] = "solo disponible en Linux"

    # Memoria del sistema
    try:
        with open("/proc/meminfo") as f:
            meminfo = {}
            for line in f:
                if line.startswith(("MemTotal:", "MemAvailable:", "SwapTotal:", "SwapFree:")):
                    k, v = line.split(":", 1)
                    meminfo[k.strip()] = v.strip()
        info["system"] = meminfo
    except OSError:
        pass

    return info
