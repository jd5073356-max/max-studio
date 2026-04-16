# MAX Studio — Gateway

API Gateway FastAPI para MAX Studio. Expone REST + WebSocket en `:8003` y orquesta el backend de MAX (Dispatch, Pi Service, OpenClaw, agent.py).

## Setup local

```bash
# 1. Crear venv (ya existe en .venv/)
python -m venv .venv

# 2. Activar venv
# Windows (Git Bash):
source .venv/Scripts/activate
# Linux/Mac:
source .venv/bin/activate

# 3. Instalar deps
pip install -r requirements.txt

# 4. Variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 5. Crear primer usuario
python scripts/init_user.py

# 6. Arrancar servidor dev
uvicorn app.main:app --reload --port 8003
```

## ⚠️ Nota Python 3.14

Si `pip install -r requirements.txt` falla en `pyiceberg` (dep transitiva de `supabase`):

**Opción A — usar Python 3.12 (recomendado):**
- Windows: `winget install Python.Python.3.12`
- Recrear venv con Python 3.12.

**Opción B — instalar Microsoft C++ Build Tools:**
- https://visualstudio.microsoft.com/visual-cpp-build-tools/
- Instalar "C++ build tools" workload.

## Estructura

- `app/main.py` — entrypoint FastAPI
- `app/auth/` — login/logout/JWT
- `app/chat/` — REST + WebSocket de chat
- `app/tasks/` — CRUD scheduled_tasks
- `app/system/` — heartbeat + health checks
- `app/memory/` — conversations + knowledge CRUD
- `app/docs/` — generación PDF/XLSX/DOCX
- `app/sandbox/` — ejecución Docker aislada
- `app/push/` — Web Push notifications
- `app/notifications/` — dispatcher PWA vs Telegram
- `app/core/` — config, supabase client, deps, ws manager
- `app/models/` — Pydantic models
