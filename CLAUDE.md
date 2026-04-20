# MAX Studio

PWA single-user que da interfaz gráfica a MAX (asistente IA en EC2 Ohio). Reemplaza Telegram/WhatsApp como canal principal y agrega gestión visual de tareas, monitoreo del sistema y generación de documentos.

Blueprint completo: `C:\Users\USUARIO\.claude\skills\the-architect\output\max-studio-blueprint.md`

## Commands

### Frontend (apps/web)

- `pnpm dev` — Next.js dev server :3000
- `pnpm build` — Build producción
- `pnpm lint` — ESLint

### Gateway (apps/gateway)

- `uvicorn app.main:app --reload --port 8003` — Dev server (requiere venv activo)
- `python scripts/init_user.py` — Crea primer usuario (Step 4+)

### Deploy

- Frontend: push a `main` → Vercel auto-deploy
- Gateway: `docker compose -f infra/docker-compose.gateway.yml up -d --build` en EC2

## Tech Stack

**Frontend:** Next.js 16 App Router + TypeScript strict + Tailwind v4 + shadcn/ui (base-ui primitives, NO radix) + TanStack Query/Table + Recharts + Mermaid + react-markdown + Zustand + WebSocket nativo + next-themes.

**Gateway:** FastAPI + Supabase + Docker SDK + pywebpush + weasyprint/openpyxl/python-docx.

## Architecture

### Directory Structure

- `apps/web/` — PWA Next.js (frontend)
- `apps/gateway/` — API Gateway FastAPI (backend nuevo)
- `max-changes/` — Patches al backend MAX existente (Dispatch, Pi Service, agent.py)
- `infra/` — Docker compose + nginx config para EC2
- `docs/` — Architecture, deployment, model routing

### Data Flow

1. Usuario abre PWA → middleware valida JWT cookie → carga layout `(app)`.
2. WebSocket persistente al gateway en `/ws` (auth por query token).
3. Mensajes de chat → WS event → gateway proxy a Dispatch :8001 → streaming vuelve por WS (`chat.token` × N → `chat.done`).
4. Tareas locales (PC): Sonnet (nube) genera código → gateway encola `agent_jobs` → agent.py ejecuta → resultado por WS.
5. Notificaciones automáticas → `/internal/notify` → pywebpush a PWA. Telegram/WhatsApp solo responden mensajes llegados por su canal.

### Key Patterns

- **Server Components por default**. `"use client"` solo cuando hay interacción.
- **Path alias** `@/` para `apps/web/src/`.
- **Toda llamada al gateway pasa por `lib/api.ts`**.
- **Toda lógica WS centralizada** en `useWebSocket` global + Zustand.
- **Gateway no replica lógica de Dispatch** — orquesta y agrega features web-only.
- **Patches a MAX uno por uno** con tests; nunca refactor masivo.

## Code Organization Rules

1. Un componente por archivo, máx 300 líneas.
2. Sin barrel exports. Importar directo de la fuente.
3. Server Components por defecto.
4. Colocate componentes de página junto a la página.
5. Tipos compartidos frontend/gateway en `apps/web/src/types/api.ts`, sincronizados con Pydantic models.
6. Gateway: una ruta = un archivo en su feature folder. No mega-routers.

## Design System

### Colors (dark default — `.dark` class aplicada por next-themes)

- Primary: `#7C3AED`
- Background: `#0A0A0B`
- Surface (card/popover): `#131316`
- Surface-2: `#1C1C21`
- Border: `#27272A`
- Text: `#FAFAFA`
- Text-muted: `#A1A1AA`
- Success: `#10B981`
- Warning: `#F59E0B`
- Destructive: `#EF4444`
- Info: `#3B82F6`

### Typography

- Headings: Inter, weights 600
- Body: Inter 14px / 400
- Code: JetBrains Mono 13px

### Style

- Border radius: 6px default, 10px cards, 999px pills
- Sombras planas: máx `0 1px 2px rgba(0,0,0,0.05)`
- Spacing base: 4px (escala 4/8/12/16/24/32/48)
- Aesthetic: Linear/Vercel — denso, oscuro, info-first

## Environment Variables

### Frontend (`apps/web/.env.local`)

- `NEXT_PUBLIC_GATEWAY_URL`
- `NEXT_PUBLIC_WS_URL`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

### Gateway (`apps/gateway/.env`)

Ver `apps/gateway/.env.example`. Keys: `SUPABASE_URL/SERVICE_KEY`, `JWT_SECRET`, `AGENT_API_KEY`, `INTERNAL_API_KEY`, `VAPID_*`, `DISPATCH_URL`, `PI_SERVICE_URL`, `OPENCLAW_URL`, `ALLOWED_ORIGINS`.

## Reglas No Negociables

1. **TypeScript strict.** Sin `any`, sin `@ts-ignore` salvo justificación en comentario.
2. **Toda comunicación con MAX backend pasa por el Gateway.** El frontend NUNCA habla directo a Dispatch/Pi/OpenClaw.
3. **El agente local (agent.py) NUNCA inventa código.** Solo ejecuta lo que la nube le pasó.
4. **Notificaciones automáticas (cron + tareas batch) van a la PWA, NO a Telegram.**
5. **Sandbox de código:** `--network=none`, RAM ≤256MB, CPU ≤0.5, timeout duro 60s.
6. **Nunca commitear `.env`.** Usar `.env.example` con placeholders.
7. **Cada patch a MAX backend tiene su rollback documentado** (un commit por patch).
8. **Heartbeat agent.py ≤ 10s, threshold offline > 30s.**
9. **Single user — sin signup endpoint público.** Usuario inicial se crea con `init_user.py`.
10. **Idioma UI: español. Código: inglés.**

## Build Status (2026-04-17)

- ✅ Step 1: Scaffolding monorepo (pnpm workspace + Next 16 + gateway skeleton)
- ✅ Step 2: shadcn/ui (15 componentes) + design tokens MAX + Inter/JetBrains Mono
- ✅ Step 3: Layout base — `(app)` group + Sidebar + Header + ThemeToggle + AgentStatusDot + 6 stubs de sección
- ✅ Step 4: Auth (JWT cookie + bcrypt + rate limit + proxy.ts + /login) — pendiente provisionar Supabase
- ✅ Step 5: WebSocket (gateway `/ws` + `WebSocketProvider` + Zustand `useWsStore`)
- ✅ Step 6: Chat streaming (threads por gap >30min + MarkdownRenderer + historial)
- ✅ Step 7: Tasks CRUD (scheduler hour/min/days[] + TaskForm + TaskTable + run-now)
- ✅ Step 8: System monitoring (heartbeat agente + ping Dispatch/Pi/OpenClaw + polling 15s)
- ✅ Step 15-A: PWA instalable (manifest.ts + iconos dinámicos + `public/sw.js` + InstallPrompt + offline page)
- ✅ Step 15-B: Web Push (VAPID + push/subscribe + /internal/notify + PushToggle en header)
- ⏳ Step 16: Settings page (gateway URL editable, tema, info de cuenta)
- ⏳ Steps 9-14: Pendientes (model routing, auto-tasks, memory browser, docs, sandbox)

## Notas de ajuste vs blueprint

- **Next.js 16** en vez de 15 (create-next-app dio 16 como latest). Compatible.
- **shadcn usa `@base-ui/react`**, no Radix UI. API diferente: `asChild` → `render={<Component/>}`, `delayDuration` → `delay`. Tener en cuenta al añadir tooltips/sheets/dialogs custom.
- **Tailwind v4** — config en CSS (`@theme inline`), no `tailwind.config.ts` tradicional.
- **Toast reemplazado por Sonner** (shadcn ya no provee `toast`).
- **`pnpm dlx` rompe en Windows** con ERR_PNPM_NO_IMPORTER_MANIFEST_FOUND — usar `npx --yes` para shadcn/create-next-app.
- **Gateway Python:** reemplazamos `supabase-py` con un wrapper httpx propio (`app/core/supabase.py`) para bypassear `pyiceberg` en Python 3.14. Sin necesidad de MSVC.
- **Next 16 renombró `middleware.ts` → `proxy.ts`.** El archivo está en `apps/web/src/proxy.ts` y exporta `proxy(request)`.
- **slowapi 0.1.9 rompe FastAPI body introspection** (wrappea con *args/**kwargs, los Pydantic body params quedan como query). Reemplazado por `app/auth/ratelimit.py` (in-memory, thread-safe).

## Schema real (Supabase existente de MAX)

MAX Studio se monta sobre el Supabase productivo de MAX. **Tablas pre-existentes que MAX Studio usa** (no modificar):

- **`conversations`** — log plano de mensajes (NO thread-grouping).
  Columnas: `id uuid, engine text, role text, content text, embedding vector, created_at timestamptz`.
  Uso PWA: INSERT con `engine='pwa'`, `role='user'` al enviar; `role='assistant'` cuando responde agent. Frontend agrupa visualmente por gap temporal (> 30 min = nuevo hilo).
- **`scheduled_tasks`** — cron simple (hour/minute/days array, NO cron string).
  Columnas: `id uuid, title, message, hour int, minute int, days int[] (0-6), status text, created_at`.
  Frontend form: hora + minuto + checkboxes de días.
- **`system_logs`** — `id uuid, service, level, message, metadata jsonb, created_at`. Solo lectura para `/system`.
- **`tasks`** — agent jobs. `id uuid, title, status, result, scheduled_at, executed_at, service, metadata jsonb`.
- **`knowledge`** — RAG store. `id uuid, category, content, embedding, created_at`. Solo lectura para `/memory/knowledge`.
- **`tareas`** — reservada para uso personal del dueño (bigint id, titulo, prioridad, completada). MAX Studio NO toca.

**Tablas nuevas creadas por MAX Studio:** `users`, `agent_heartbeats`, `generated_docs`, `push_subscriptions`.

Migración aditiva: [docs/max_studio_init.sql](docs/max_studio_init.sql). Idempotente, seguro re-ejecutar.

## Archivos clave del layout base

- [src/app/layout.tsx](apps/web/src/app/layout.tsx) — Root: fonts + ThemeProvider + TooltipProvider + Toaster
- [src/app/(app)/layout.tsx](apps/web/src/app/(app)/layout.tsx) — Shell: Sidebar + Header
- [src/components/layout/Sidebar.tsx](apps/web/src/components/layout/Sidebar.tsx) — 6 secciones con active highlight
- [src/components/layout/Header.tsx](apps/web/src/components/layout/Header.tsx) — Título dinámico + dot agent + toggle tema + mobile drawer
- [src/app/globals.css](apps/web/src/app/globals.css) — Tokens MAX (dark default + light disponible)
