# 🐝 Mente Colmena — Estado MAX Studio

**Última actualización:** 2026-04-27 (MAX session — Protocolo Evolución Integral completo)
**Agente activo:** ninguno
**Proyecto:** MAX Studio PWA + Gateway FastAPI

---

## ✅ Protocolo de Evolución Integral — COMPLETADO

### FASE 1 — Centro de Control Visual (Excalidraw)
- `apps/web/src/app/(app)/canvas/page.tsx` — Server Component wrapper
- `apps/web/src/app/(app)/canvas/CanvasClient.tsx` — Canvas Excalidraw, auto-save 60s
- `apps/web/src/app/(app)/canvas/SystemHealthPanel.tsx` — polling /system/status cada 5s
- `apps/web/src/app/(app)/canvas/ErrorModal.tsx` — modal de error al click en nodo rojo
- `apps/gateway/app/canvas/router.py` — POST /canvas/save, GET /canvas/latest, DELETE /canvas/clear
- `docs/max_studio_init.sql` — canvas_states + simulations tables añadidas

### FASE 2 — Saneamiento de Infraestructura
- `apps/gateway/app/docs/routes.py` — writes async con asyncio.to_thread, offload Supabase Storage
- `apps/gateway/app/core/storage.py` — maybe_offload() para archivos >5MB → bucket max-docs

### FASE 3 — Gestión Financiera + Brain Switcher
- `apps/gateway/app/finance/routes.py` — GET /finance/budgets con predicción agotamiento
- `apps/web/src/app/(app)/finances/page.tsx` — badge depleted_date + daily_burn por categoría
- `apps/web/src/components/chat/ModelSelector.tsx` — dropdown 5 modelos
- `apps/web/src/components/chat/MessageInput.tsx` — ModelSelector integrado
- `apps/web/src/store/chat.ts` — selectedModel + setSelectedModel
- `apps/web/src/hooks/useChat.ts` — pasa model en chat.send WS event
- `apps/web/src/types/ws-events.ts` — ChatSendEvent con model?: string
- `apps/gateway/app/chat/ws.py` — lee model del evento, pasa a stream_response
- `apps/gateway/app/chat/dispatcher.py` — Brain Switcher: kimi → Moonshot, claude-* → Anthropic directo, auto → Dispatch

### FASE 4 — Simulación 300 Agentes
- `apps/gateway/app/kimi/simulation.py` — 3 rounds × 100 agentes, SSE stream, asyncio.Semaphore(5)
- `apps/web/src/app/(app)/laboratorio/page.tsx` — página con tabs
- `apps/web/src/app/(app)/laboratorio/SimulationDashboard.tsx` — dashboard en tiempo real

### FASE 5 — RAG Skills
- `apps/gateway/app/memory/skills.py` — búsqueda keyword-based, POST /memory/skills/search
- `apps/gateway/app/chat/dispatcher.py` — inyección de skills en system prompt
- `apps/gateway/app/memory/routes.py` — skills router incluido

### FASE 6 — Explotación Extrema de Modelos
- `apps/gateway/app/simulations/monte_carlo.py` — POST /simulations/monte_carlo (CPU en thread pool)
- `apps/gateway/app/kimi/supervisor.py` — POST /kimi/supervise (dedup + ranking)
- `apps/gateway/app/system/error_notifier.py` — notify_if_critical() + cooldown 5min
- `apps/gateway/app/system/log_watcher.py` — background polling system_logs cada 30s
- `apps/gateway/app/audit/router.py` — POST /audit/security + POST /audit/business (Opus 4.7)
- `apps/web/src/app/(app)/laboratorio/AuditPanel.tsx` — UI auditor código y negocio
- `apps/gateway/app/main.py` — todos los routers registrados + log_watcher startup

---

## 🔴 Pendientes BLOQUEANTES (antes de usar en prod)

1. **SQL migrations** — Ejecutar en Supabase SQL editor (no PostgREST):
   ```
   docs/max_studio_init.sql
   ```
   Tablas nuevas: `canvas_states`, `simulations`

2. **EC2 .env** — Agregar variables faltantes:
   ```
   N8N_ERROR_WEBHOOK=https://<n8n>/webhook/error-alert
   OLLAMA_URL=http://localhost:11434
   ```

3. **git pull + restart en EC2**:
   ```bash
   ssh -i maxclaves.pem ubuntu@16.59.206.172
   cd ~/max-studio && git pull
   sudo systemctl restart max-gateway
   ```

4. **pnpm add @excalidraw/excalidraw** — ya ejecutado, verificar en Vercel deploy

---

## 🟡 Pendientes secundarios (antes pendientes del estado anterior)

- Revocar y regenerar Moonshot API key (expuesta en chat anterior)
- EC2: verificar que openpyxl, python-docx, python-pptx estén instalados en venv
- ALLOWED_ORIGINS: verificar `https://max-studio-ashy.vercel.app` en EC2 .env

---

## 📋 Próximo paso recomendado

1. Juan ejecuta el SQL de migración en Supabase dashboard
2. SSH al EC2: git pull + restart gateway
3. Verificar /canvas, /laboratorio, Brain Switcher en chat
4. Agregar N8N_ERROR_WEBHOOK cuando tenga la URL de n8n
