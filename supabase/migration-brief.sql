-- ═══════════════════════════════════════════════════════════════════════
-- FOUNDER BRIEF — cached executive intelligence briefs. Founder-only.
-- One row per generation; the app reads the most recent. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS founder_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot JSONB,                       -- the BriefingSnapshot the brief was built from
  content JSONB,                        -- { decisions, risks, opportunities, company_health, cash_runway_weeks, headline }
  model TEXT,
  tokens_used INT,
  triggered_by TEXT NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('cron','manual','refresh')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_founder_briefs_generated ON founder_briefs(generated_at DESC);

-- ── RLS: founder only, no policies for any other role ──
ALTER TABLE founder_briefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS founder_briefs_all ON founder_briefs;
CREATE POLICY founder_briefs_all ON founder_briefs FOR ALL TO authenticated
  USING (public.is_founder()) WITH CHECK (public.is_founder());
