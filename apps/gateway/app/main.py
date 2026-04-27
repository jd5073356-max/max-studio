"""MAX Studio Gateway — entrypoint FastAPI."""

from __future__ import annotations

import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.audit.router import router as audit_router
from app.auth.routes import router as auth_router
from app.canvas.router import router as canvas_router
from app.context.routes import router as context_router
from app.finance.routes import finance_router
from app.kimi.routes import router as kimi_router
from app.kimi.simulation import router as simulation_router
from app.kimi.supervisor import router as supervisor_router
from app.chat.routes import router as chat_router
from app.chat.ws import router as ws_router
from app.core.config import get_settings
from app.docs.routes import router as docs_router
from app.memory.routes import router as memory_router
from app.push.routes import router as push_router
from app.sandbox.routes import router as sandbox_router
from app.simulations.monte_carlo import router as monte_carlo_router
from app.system.routes import router as system_router
from app.tasks.routes import router as tasks_router


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="MAX Studio Gateway",
        version="0.1.0",
        description="API Gateway para MAX Studio PWA",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def _start_background_tasks() -> None:
        from app.system.log_watcher import start_log_watcher
        asyncio.create_task(start_log_watcher())

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "max-studio-gateway"}

    app.include_router(auth_router)
    app.include_router(ws_router)
    app.include_router(chat_router)
    app.include_router(tasks_router)
    app.include_router(system_router)
    app.include_router(docs_router)
    app.include_router(memory_router)
    app.include_router(push_router)
    app.include_router(sandbox_router)
    app.include_router(kimi_router)
    app.include_router(simulation_router)
    app.include_router(supervisor_router)
    app.include_router(monte_carlo_router)
    app.include_router(audit_router)
    app.include_router(context_router)
    app.include_router(finance_router)
    app.include_router(canvas_router)

    return app


app = create_app()
