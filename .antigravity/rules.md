# 🤖 Reglas para Antigravity — MAX Studio

## Protocolo Mente Colmena

1. **Leer siempre primero** `.hive/state.md` y `.hive/context.md` antes de tocar cualquier archivo
2. **Actualizar state.md** al terminar: listar archivos tocados + próximo paso
3. **No modificar archivos** que estén marcados como "en uso" en state.md
4. **Prioridad**: resolver los pendientes bloqueantes antes de añadir features

## Convenciones del proyecto

### Frontend (Next.js 16)
- TypeScript strict — sin `any` sin justificación
- shadcn usa `@base-ui/react`, NO Radix. API diferente: `render={<Component/>}` en vez de `asChild`
- Tailwind v4 — configuración en CSS (`@theme inline`), NO tailwind.config.ts
- Toast → Sonner (`import { toast } from "sonner"`)
- Zustand stores en `src/store/`
- Todo fetch al gateway → `apiFetch()` de `@/lib/api`
- `"use client"` solo cuando hay interacción — Server Components por defecto

### Gateway (FastAPI)
- Una ruta = un archivo en su feature folder
- Supabase via `SupabaseRest` de `app/core/supabase.py` (NO supabase-py)
- Configuración via `get_settings()` de `app/core/config.py`
- Auth via `CurrentUser` dependency
- Máx 300 líneas por archivo

### Agent (agent.py — Windows)
- NO es git repo — cambios se guardan directo
- Path: `C:\Users\USUARIO\Trabajo\max\max-agent\agent.py`
- Handlers nuevos → agregar a dict HANDLERS
- Threads daemon — nunca bloquear el loop principal

## Fixes críticos pendientes (hacer en este orden)

### Fix 1 — AGENT_API_KEY en EC2 (agente offline)
```bash
ssh ubuntu@18.189.17.187
sed -i 's/AGENT_API_KEY=.*/AGENT_API_KEY=S34PkS_wob0lqGV-wD35OZSGAeXrIvWjFRxSsmqJMDM/' ~/max-studio/apps/gateway/.env
```

### Fix 2 — DISPATCH_SECRET en EC2 (chat usa Sonnet en vez de gpt-120)
```bash
grep -q DISPATCH_SECRET ~/max-studio/apps/gateway/.env || echo "DISPATCH_SECRET=MAX_SUPER_SECRET_2026" >> ~/max-studio/apps/gateway/.env
```

### Fix 3 — ALLOWED_ORIGINS en EC2 (CORS para Vercel)
```bash
sed -i 's|ALLOWED_ORIGINS=http://localhost:3000|ALLOWED_ORIGINS=http://localhost:3000,https://max-studio-ashy.vercel.app|' ~/max-studio/apps/gateway/.env
```

### Fix 4 — git pull + reiniciar gateway
```bash
cd ~/max-studio && git pull origin main
pkill -f uvicorn
cd ~/max-studio/apps/gateway && source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8003 > gateway.log 2>&1 &
sleep 2 && curl http://localhost:8003/health
```

## Lo que NO debes hacer
- NO commitear archivos .env
- NO usar `supabase-py` — usar el wrapper httpx propio
- NO instalar Radix UI — el proyecto usa @base-ui/react
- NO crear endpoints en main.py — crear módulo propio e importar
- NO modificar tablas de Supabase sin revisar el schema en CLAUDE.md del proyecto
- NO usar `any` en TypeScript sin comentario justificando
- NO crear más de un proyecto activo simultáneo para Juan
