"""MAX Studio Gateway — entrypoint FastAPI.

Implementación mínima: arranca y responde /health.
Los routers se agregan en Step 4 (auth) y siguientes.
"""

from fastapi import FastAPI

app = FastAPI(
    title="MAX Studio Gateway",
    version="0.1.0",
    description="API Gateway para MAX Studio PWA",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "max-studio-gateway"}
