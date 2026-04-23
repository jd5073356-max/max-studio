# 🐝 Mente Colmena — Estado MAX Studio

**Última actualización:** 2026-04-22 21:05 (MAX session)
**Agente activo:** ninguno
**Proyecto:** MAX Studio PWA + Gateway FastAPI

---

## ✅ Archivos tocados en última sesión (MAX)

### Gateway (apps/gateway/)
- `app/chat/dispatcher.py` — DISPATCH_SECRET check + enriquecimiento system prompt con CLAUDE.md desde Supabase (cache TTL 10min)
- `app/chat/task_detector.py` — detección de tareas por schedule en chat
- `app/chat/ws.py` — auto-creación de tareas desde chat + WS event task.auto_created
- `app/context/__init__.py` — nuevo módulo (vacío)
- `app/context/routes.py` — GET /context/claude-md, GET /context/obsidian, POST /context/sync
- `app/main.py` — registra context_router + kimi_router
- `app/core/config.py` — añadido moonshot_api_key, moonshot_model
- `app/kimi/` — módulo completo: client.py, orchestrator.py, routes.py
- `app/system/routes.py` — GET /system/models (stack IA), GET /system/status
- `app/tasks/routes.py` — fix 405: GET /jobs movido antes de /{task_id}
- `app/.env` — DISPATCH_SECRET=MAX_SUPER_SECRET_2026, ALLOWED_ORIGINS incluye Vercel

### Frontend (apps/web/)
- `src/app/(app)/settings/page.tsx` — ModelsSection + ContextSection (CLAUDE.md sync) + AboutSection
- `src/app/(app)/tasks/page.tsx` — tab "Proyecto" con Kimi K2.6 (modo proyecto agentico)
- `src/app/(app)/memory/obsidian/page.tsx` — nuevo: visor notas Obsidian sincronizadas
- `src/components/chat/MessageInput.tsx` — ImagePlus button, preview imagen, callback onSendWithImage
- `src/components/chat/ChatWindow.tsx` — pasa sendVision a MessageInput
- `src/components/layout/Sidebar.tsx` — agrega "Obsidian" → /memory/obsidian
- `src/hooks/useChat.ts` — sendVision() para visión Kimi + toast task.auto_created
- `src/store/chat.ts` — setLoading()
- `src/store/settings.ts` — gatewayUrlOverride store
- `src/types/ws-events.ts` — TaskAutoCreatedEvent, ProjectStepEvent, ProjectDoneEvent, ProjectErrorEvent

### Agent (max-agent/agent.py — NO es git repo)
- Heartbeat loop: POST /system/heartbeat cada 10s (hilo daemon)
- sync_claude_md(): CLAUDE.md → Supabase knowledge table
- sync_obsidian(): notas .md vault → Supabase knowledge table
- handle_sync_context(): handler para tarea tipo "sync_context"
- context_sync_loop(): hilo daemon cada 30min
- `.env`: GATEWAY_URL y AGENT_API_KEY actualizados

---

## 🔴 Pendientes bloqueantes (resolver primero)

1. **Agente PC offline** — [HECHO] Fix aplicado (AGENT_API_KEY actualizado vía SSH)

2. **Modelo siempre usa Sonnet** — [HECHO] Fix aplicado (DISPATCH_SECRET actualizado vía SSH)

3. **URL gateway temporal** — Cloudflare tunnel cambia en cada reinicio
   - Fix pendiente: comprar dominio ($2) → Cloudflare named tunnel permanente
   - Cuando esté listo: seguir guía en docs/permanent-tunnel.md (por crear)

---

## 🟡 Pendientes secundarios

- Revocar y regenerar Moonshot API key (expuesta en chat)
- Moonshot API key no está en EC2 gateway .env → /kimi/* y visión no funcionan en prod
- EC2: verificar que openpyxl, python-docx, python-pptx estén instalados en venv
- [HECHO] Hacer git pull en EC2 para tener los últimos cambios del dispatcher y context router
- ALLOWED_ORIGINS en EC2 .env: agregar `https://max-studio-ashy.vercel.app`

---

## 📋 Próximo paso recomendado

**Antigravity debe:**
1. Confirmar con Juan si falta comprar el dominio para el túnel permanente.
2. Revocar y regenerar Moonshot API key e insertarla en el gateway.
3. Probar que el chat está funcionando correctamente.