-- ─────────────────────────────────────────────
-- EXTRAS MANAGEMENT (Phase 3)
-- 500 extras ≠ crew. Tracked per shoot-day batch, not per person: the day's call,
-- count required vs present, per-head rate, meal count, supervisor sign-off, and
-- the cash disbursed (paid same-day at wrap).
--
-- total_paid is an OPERATIONAL record of cash handed out — it is reconciled against
-- petty cash and is NEVER summed into budget actuals. The actual outflow is the
-- petty-cash expense (coded to a budget head), which already feeds actuals. (one-truth)
--
-- RLS mirrors production_reports (operational management; delete = founder).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS extras_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  call_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'contemporary' CHECK (category IN ('period', 'contemporary', 'specialty', 'other')),
  description TEXT,                    -- scene / purpose
  coordinator TEXT,
  count_required INT NOT NULL DEFAULT 0,
  count_present INT NOT NULL DEFAULT 0,
  rate_per_head NUMERIC(10, 2) NOT NULL DEFAULT 0,
  meals_count INT,                    -- catering count (separate from crew)
  total_paid NUMERIC(12, 2),          -- cash disbursed (reconcile vs petty cash; not a budget actual)
  supervisor_signoff BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'confirmed', 'paid')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_extras_days_project ON extras_days(project_id, call_date DESC);

DROP TRIGGER IF EXISTS set_updated_at_extras ON extras_days;
CREATE TRIGGER set_updated_at_extras BEFORE UPDATE ON extras_days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE extras_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "extras_read"   ON extras_days;
DROP POLICY IF EXISTS "extras_insert" ON extras_days;
DROP POLICY IF EXISTS "extras_update" ON extras_days;
DROP POLICY IF EXISTS "extras_delete" ON extras_days;
CREATE POLICY "extras_read"   ON extras_days FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "extras_insert" ON extras_days FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "extras_update" ON extras_days FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "extras_delete" ON extras_days FOR DELETE TO authenticated USING (public.is_founder());
