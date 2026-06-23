-- ═══════════════════════════════════════════════════════════════════════
-- ROLE BRIEFS — cached executive briefs for the leadership team (accountant,
-- executive_producer, general_manager). The founder keeps its own private
-- founder_briefs table; this one is per-role. Each role reads only its own
-- audience. Idempotent.
--
-- NOTE: the EP/GM finance section is computed server-side into an already-
-- redacted oversight summary (liabilities + aggregate totals, NEVER bank
-- balances or row-level entries) before it is stored here, so the rows a
-- non-finance role can read never contain a balance. RLS below adds the
-- per-role isolation on top.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS role_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audience TEXT NOT NULL CHECK (audience IN ('accountant','executive_producer','general_manager')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot JSONB,
  content JSONB,
  model TEXT,
  tokens_used INT,
  triggered_by TEXT NOT NULL DEFAULT 'manual' CHECK (triggered_by IN ('cron','manual','refresh')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_role_briefs_aud_gen ON role_briefs(audience, generated_at DESC);

-- ── RLS: each role reads/writes only its own audience. Reuses user_role(). ──
ALTER TABLE role_briefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_briefs_own ON role_briefs;
CREATE POLICY role_briefs_own ON role_briefs FOR ALL TO authenticated
  USING (audience = public.user_role()) WITH CHECK (audience = public.user_role());
