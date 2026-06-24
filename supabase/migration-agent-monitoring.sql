-- ═══════════════════════════════════════════════════════════════════════
-- OPM AGENT SYSTEM — PHASE 1 (watchdog: monitoring + escalation)
-- Two new tables. Reuses the existing error_logs + system_status + alert
-- channels rather than duplicating them. Run once. Idempotent (safe to re-run).
-- Assumes the base schema + helper fn public.is_founder() and uuid_generate_v4()
-- are already in place (they are — see run-all-latest.sql).
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────── 1. INCIDENTS — stateful lifecycle of anything red ─────────────
-- One row per distinct problem (deduped by fingerprint while open). Drives the
-- WhatsApp escalation + Aashiq's 1/2/3 reply, and feeds the morning briefing.
CREATE TABLE IF NOT EXISTS agent_incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_type TEXT NOT NULL,                  -- 'uptime' | 'ssl' | 'storage' | 'build' | 'db' | 'twilio' | ...
  service TEXT NOT NULL,                         -- 'opm_office' | 'opm_website' | 'supabase' | 'vercel' | 'twilio' | 'github'
  severity TEXT NOT NULL DEFAULT 'medium'        -- 'low' | 'medium' | 'high' | 'critical'
    CHECK (severity IN ('low','medium','high','critical')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open'             -- lifecycle below
    CHECK (status IN ('open','self_healed','escalated','acknowledged','resolved')),
  fingerprint TEXT NOT NULL,                      -- "service:incident_type" — one open incident per fingerprint
  aashiq_notified BOOLEAN NOT NULL DEFAULT FALSE,
  aashiq_response TEXT,                           -- raw reply: '1' | '2' | '3' (+ free text)
  last_notified_at TIMESTAMPTZ,                   -- for the alert cooldown
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one OPEN/ESCALATED incident per fingerprint, so a flapping service
-- updates the same row instead of spawning duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_incident_open_fingerprint
  ON agent_incidents (fingerprint)
  WHERE status IN ('open','escalated','acknowledged');
CREATE INDEX IF NOT EXISTS idx_agent_incidents_created ON agent_incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_incidents_status ON agent_incidents (status);

ALTER TABLE agent_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_incidents_read" ON agent_incidents;
CREATE POLICY "agent_incidents_read" ON agent_incidents
  FOR SELECT TO authenticated USING (public.is_founder());
-- Writes happen via the service-role admin client (bypasses RLS); no write policy needed.

-- ───────────── 2. HEALTH SNAPSHOTS — rolling green/yellow/red picture ─────────────
-- One row per monitor tick. Powers a status dashboard and the briefing rollup.
CREATE TABLE IF NOT EXISTS agent_health_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opm_office_status TEXT,
  opm_website_status TEXT,
  supabase_status TEXT,
  vercel_status TEXT,
  twilio_status TEXT,
  github_status TEXT,
  overall_health TEXT                              -- 'green' | 'yellow' | 'red'
    CHECK (overall_health IN ('green','yellow','red')),
  details JSONB
);
CREATE INDEX IF NOT EXISTS idx_agent_snapshots_time ON agent_health_snapshots (snapshot_time DESC);

ALTER TABLE agent_health_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_health_snapshots_read" ON agent_health_snapshots;
CREATE POLICY "agent_health_snapshots_read" ON agent_health_snapshots
  FOR SELECT TO authenticated USING (public.is_founder());
-- Writes via service-role admin client.
