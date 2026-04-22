# 🧠 Contexto MAX Studio — Mente Colmena

## ¿Qué es este proyecto?
PWA single-user que da interfaz gráfica a MAX (asistente IA en EC2). Reemplaza Telegram/WhatsApp como canal principal. Stack: Next.js 16 + FastAPI + Supabase + WebSocket.

## Arquitectura

```
[Browser PWA - Vercel]
   ↓ HTTPS/WSS
[Cloudflare Tunnel - temp URL]
   ↓
[FastAPI Gateway - EC2 :8003]
   ├── /ws          → WebSocket streaming
   ├── /chat/*      → Proxy a Dispatch
   ├── /tasks/*     → CRUD scheduled_tasks
   ├── /system/*    → heartbeat agente + status servicios
   ├── /memory/*    → conversations + knowledge (Supabase)
   ├── /context/*   → CLAUDE.md + Obsidian desde Supabase
   ├── /kimi/*      → Kimi K2.6 visión + modo proyecto
   ├── /docs/*      → generación documentos (pdf/docx/xlsx)
   └── /vision/*    → análisis de imágenes con Kimi
   ↓
[Dispatch - EC2 :8001] → gpt-oss:120b / kimi-k2.5 / claude-sonnet
[Pi Service - EC2 :8000]
[OpenClaw - EC2 :8002]

[Agent.py - Windows PC]
   → Polls Supabase tasks table (service='local_pc')
   → Heartbeat → /system/heartbeat cada 10s
   → Sync CLAUDE.md + Obsidian → Supabase knowledge cada 30min
```

## Credenciales clave (NO commitear)

```
Supabase URL:      https://wrdzfmfpusvzcxqhgmwa.supabase.co
EC2 IP:            18.189.17.187
EC2 user:          ubuntu (asumir)
Gateway port:      8003
Dispatch secret:   MAX_SUPER_SECRET_2026
Agent API key:     S34PkS_wob0lqGV-wD35OZSGAeXrIvWjFRxSsmqJMDM
JWT secret:        uIF_W6j-TijcOJDkfBJZNmhLy2s7PvsdzsDnGaLQ5cXIdYZe1gu9m5LeVAs19HSU
Vercel URL:        https://max-studio-ashy.vercel.app
GitHub repo:       https://github.com/jd5073356-max/max-studio
```

## Supabase — tablas usadas

| Tabla | Uso |
|-------|-----|
| `conversations` | Log chat (engine: pwa/telegram/whatsapp) |
| `scheduled_tasks` | Tareas cron (hour/min/days[]) |
| `tasks` | Jobs para agent.py (service='local_pc') |
| `knowledge` | RAG store (category: claude_md / obsidian / ...) |
| `agent_heartbeats` | Pings del agente local |
| `users` | Auth JWT (single user) |
| `system_logs` | Logs del agente |
| `generated_docs` | Documentos generados |
| `push_subscriptions` | Web Push |

## Stack técnico

### Frontend
- Next.js 16 App Router + TypeScript strict
- Tailwind v4 (config en CSS, no tailwind.config.ts)
- shadcn/ui con @base-ui/react (NO Radix - API diferente)
- Zustand para estado global (chat, ws, settings)
- WebSocket nativo en `useWebSocket` hook
- Toast: Sonner (NO el de shadcn)
- `apiFetch()` en `lib/api.ts` para todas las llamadas al gateway

### Gateway (FastAPI)
- Python 3.x + FastAPI + pydantic-settings
- Auth: JWT HS256 en cookie `max_auth` (30 días)
- Supabase: wrapper httpx propio (NO supabase-py) en `core/supabase.py`
- CORS: FastAPI CORSMiddleware
- Sin Docker (corre directo con uvicorn en EC2)

### Agent (Windows PC)
- `C:\Users\USUARIO\Trabajo\max\max-agent\agent.py`
- Polling Supabase tasks cada 5s
- Heartbeat gateway cada 10s
- Sync contexto (CLAUDE.md + Obsidian) cada 30min
- Handlers: shell, write_file, pdf, docx, xlsx, pptx, claude_code, browser, playwright, sync_context, ...

## Variables de entorno EC2 (.env del gateway)

```env
SUPABASE_URL=https://wrdzfmfpusvzcxqhgmwa.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
JWT_SECRET=uIF_W6j-TijcOJDkfBJZNmhLy2s7PvsdzsDnGaLQ5cXIdYZe1gu9m5LeVAs19HSU
ANTHROPIC_API_KEY=<key>
DEFAULT_MODEL=claude-sonnet-4-6
AGENT_API_KEY=S34PkS_wob0lqGV-wD35OZSGAeXrIvWjFRxSsmqJMDM   ← CRÍTICO
INTERNAL_API_KEY=KGkW3v40tTPNN5i7HaQlRiisGp0B0k2-F9k2DnSM5mw
DISPATCH_URL=http://localhost:8001
DISPATCH_SECRET=MAX_SUPER_SECRET_2026   ← CRÍTICO (hace que chat use gpt-120)
PI_SERVICE_URL=http://localhost:8000
OPENCLAW_URL=http://localhost:8002
ALLOWED_ORIGINS=http://localhost:3000,https://max-studio-ashy.vercel.app   ← CRÍTICO
MOONSHOT_API_KEY=<regenerar - la vieja fue expuesta>
```

## Modelo de routing (cómo el chat elige modelo)

```
dispatcher.py:
  1. Si DISPATCH_SECRET → POST a Dispatch :8001
     Dispatch decide: minimax → gpt-120 → kimi-k2.5 → claude-sonnet
  2. Si no DISPATCH_SECRET → Anthropic directo (claude-sonnet-4-6)
     + enriquece system prompt con CLAUDE.md desde Supabase

Imágenes (visión):
  → POST /vision/analyze → Kimi K2.6 (Moonshot AI)

Modo Proyecto:
  → POST /kimi/project → agentic loop Kimi K2.6 con tools
```

## Comandos útiles EC2

```bash
# Ver gateway logs
tail -f ~/max-studio/apps/gateway/gateway.log

# Reiniciar gateway
pkill -f uvicorn
cd ~/max-studio/apps/gateway && source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8003 > gateway.log 2>&1 &

# Actualizar código
cd ~/max-studio && git pull origin main

# Ver procesos
ps aux | grep -E "uvicorn|cloudflared|dispatch"

# Test local
curl http://localhost:8003/health
curl http://localhost:8003/system/status -H "Authorization: Bearer <jwt>"
```

## Comandos útiles PC (agent)

```bash
cd C:\Users\USUARIO\Trabajo\max\max-agent
python agent.py
```

## Estado del build (2026-04-22)

| Feature | Estado |
|---------|--------|
| Auth JWT + login | ✅ |
| WebSocket streaming | ✅ |
| Chat con historial | ✅ |
| Tareas CRUD + scheduler | ✅ |
| Sistema monitor | ✅ |
| PWA instalable | ✅ |
| Web Push | ✅ |
| Settings page | ✅ |
| Auto-tasks desde chat | ✅ |
| Visión con Kimi K2.6 | ✅ (falta MOONSHOT_API_KEY en EC2) |
| Modo Proyecto Kimi | ✅ (falta MOONSHOT_API_KEY en EC2) |
| CLAUDE.md sync | ✅ (agent.py reiniciado) |
| Obsidian sync | ✅ (3 notas iniciales) |
| Docs (pdf/docx/xlsx) | ✅ |
| Memory browser | ✅ |
| Heartbeat agente | ⚠️ Código OK, EC2 .env tiene key incorrecta |
| Routing a gpt-120 | ⚠️ Código OK, falta DISPATCH_SECRET en EC2 |
| URL gateway permanente | ❌ Pendiente dominio ~$2 |
