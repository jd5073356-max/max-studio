-- MAX Studio — migración aditiva sobre el Supabase de MAX
-- ==========================================================
-- Esta migración NO toca las tablas existentes de MAX:
--   conversations, knowledge, scheduled_tasks, system_logs, tasks, tareas
--
-- Solo CREATE las tablas nuevas que MAX Studio necesita:
--   users, agent_heartbeats, generated_docs, push_subscriptions
--
-- Correr en Supabase SQL editor. Idempotente (seguro re-ejecutar).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (auth MAX Studio — single user, estructura abierta a más)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Heartbeats del agente PC (retención 24h via cleanup function)
CREATE TABLE IF NOT EXISTS agent_heartbeats (
  id bigserial PRIMARY KEY,
  agent_id text NOT NULL,
  received_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_heartbeats_agent_time
  ON agent_heartbeats(agent_id, received_at DESC);

-- Documentos generados (PDF/XLSX/DOCX) desde el chat de MAX Studio
CREATE TABLE IF NOT EXISTS generated_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  mime_type text NOT NULL,
  storage_path text NOT NULL,
  size_bytes int,
  created_at timestamptz DEFAULT now()
);

-- Web Push subscriptions (PWA notifications)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Cleanup heartbeats viejos (ejecutar manualmente o via pg_cron)
CREATE OR REPLACE FUNCTION cleanup_old_heartbeats() RETURNS void AS $$
  DELETE FROM agent_heartbeats WHERE received_at < now() - interval '24 hours';
$$ LANGUAGE sql;

-- =============================================================
-- NOTAS DE INTEGRACIÓN (no es SQL, pero documenta el mapeo):
--
-- conversations (MAX flat log) — MAX Studio lo USA directamente:
--   id, engine, role, content, embedding, created_at
--   Al enviar chat desde PWA: INSERT con engine='pwa', role='user'
--   Respuesta agent: INSERT con role='assistant'
--   Frontend agrupa mensajes consecutivos por gap temporal (> 30min = nuevo hilo visual)
--
-- scheduled_tasks (MAX) — MAX Studio lo USA directamente:
--   id, title, message, hour, minute, days[], status, created_at
--   Frontend form: hora + minuto + checkboxes de días (NO cron string)
--
-- system_logs (MAX) — MAX Studio lo LEE para /system page:
--   id, service, level, message, metadata, created_at
--
-- tasks (MAX) — MAX Studio lo USA para agent jobs:
--   id, title, status, result, scheduled_at, executed_at, service, metadata
--
-- knowledge (MAX) — MAX Studio lo LEE para /memory/knowledge:
--   id, category, content, embedding, created_at
--
-- tareas (MAX) — personal todos, SIN uso por MAX Studio (reservado para dueño).
-- =============================================================
