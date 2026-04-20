"""MAX Studio Gateway — entrypoint FastAPI."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.routes import router as auth_router
from app.chat.routes import router as chat_router
from app.chat.ws import router as ws_router
from app.core.config import get_settings
from app.docs.routes import router as docs_router
from app.memory.routes import router as memory_router
from app.push.routes import router as push_router
from app.sandbox.routes import router as sandbox_router
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

    return app


app = create_app()
