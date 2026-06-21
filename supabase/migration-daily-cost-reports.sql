-- ─────────────────────────────────────────────
-- DAILY COST REPORT (DCR) — the financial twin of the DPR
-- Phase 1, step 1 of the production cost engine.
--
-- ONE-TRUTH / NO-DOUBLE-COUNT RULE (read before changing anything):
--   Budget *actuals* come ONLY from the payment pipeline — paid `payment_requests`,
--   expense `project_transactions`, and `crew_payments` — summed by `budget_line_id`
--   on read. Daily cost reports are a REPORTING/OPERATIONAL layer (burn rate,
--   cost-per-scene, on-set logging). `daily_cost_lines` must NEVER be summed into
--   the computed budget actual. A `budget_line_id` on a cost line is for
--   CATEGORISATION only — it powers "today's spend by head vs that head's ESTIMATE".
--
--   `daily_cost_lines.payment_request_id` is the settlement bridge:
--     NULL  → logged on set, not yet through the formal pipeline (e.g. cash to extras).
--             Surface "logged but unsettled" = SUM(lines WHERE payment_request_id IS NULL).
--     set   → this cost has been formalised; the payment is the actual, the line is provenance.
--   This keeps every rupee counted exactly once (by the payment) while staying reconcilable.
--
-- RLS mirrors production_reports (DPR) verbatim: operational management roles,
-- delete = founder only. Run in the Supabase SQL editor or via the pg client.
-- ─────────────────────────────────────────────

-- ── Header: one cost report per shoot day (stand-alone, optionally linked to a DPR) ──
CREATE TABLE IF NOT EXISTS daily_cost_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Nullable + ON DELETE SET NULL: Accounts can log costs before the AD files the DPR.
  -- UNIQUE so a given DPR maps to at most one cost report (Postgres allows many NULLs).
  production_report_id UUID UNIQUE REFERENCES production_reports(id) ON DELETE SET NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  day_number INT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  notes TEXT,
  prepared_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Not unique on (project_id, report_date): a film can run main + 2nd unit on the same day.
CREATE INDEX IF NOT EXISTS idx_dcr_project ON daily_cost_reports(project_id, report_date DESC);

-- ── Lines: the cost categories (from the Day-1 Kaali simulation) ──
CREATE TABLE IF NOT EXISTS daily_cost_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_cost_report_id UUID NOT NULL REFERENCES daily_cost_reports(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, -- denormalised for RLS/queries
  category TEXT NOT NULL CHECK (category IN (
    'crew', 'equipment', 'location', 'transport', 'fuel', 'catering', 'extras', 'art', 'costume', 'other'
  )),
  -- Categorisation ONLY. Never summed into budget actual (see one-truth rule above).
  budget_line_id UUID REFERENCES budget_lines(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  -- Settlement bridge to the payment pipeline. NULL = logged-but-unsettled.
  payment_request_id UUID REFERENCES payment_requests(id) ON DELETE SET NULL,
  description TEXT,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dcl_report  ON daily_cost_lines(daily_cost_report_id);
CREATE INDEX IF NOT EXISTS idx_dcl_budget  ON daily_cost_lines(budget_line_id);
CREATE INDEX IF NOT EXISTS idx_dcl_payment ON daily_cost_lines(payment_request_id);

-- ── updated_at triggers ──
DROP TRIGGER IF EXISTS set_updated_at_dcr ON daily_cost_reports;
CREATE TRIGGER set_updated_at_dcr BEFORE UPDATE ON daily_cost_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_dcl ON daily_cost_lines;
CREATE TRIGGER set_updated_at_dcl BEFORE UPDATE ON daily_cost_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS — mirrors production_reports (DPR) verbatim ──
ALTER TABLE daily_cost_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_cost_lines   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dcr_read"   ON daily_cost_reports;
DROP POLICY IF EXISTS "dcr_insert" ON daily_cost_reports;
DROP POLICY IF EXISTS "dcr_update" ON daily_cost_reports;
DROP POLICY IF EXISTS "dcr_delete" ON daily_cost_reports;
CREATE POLICY "dcr_read"   ON daily_cost_reports FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "dcr_insert" ON daily_cost_reports FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "dcr_update" ON daily_cost_reports FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "dcr_delete" ON daily_cost_reports FOR DELETE TO authenticated USING (public.is_founder());

DROP POLICY IF EXISTS "dcl_read"   ON daily_cost_lines;
DROP POLICY IF EXISTS "dcl_insert" ON daily_cost_lines;
DROP POLICY IF EXISTS "dcl_update" ON daily_cost_lines;
DROP POLICY IF EXISTS "dcl_delete" ON daily_cost_lines;
CREATE POLICY "dcl_read"   ON daily_cost_lines FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "dcl_insert" ON daily_cost_lines FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "dcl_update" ON daily_cost_lines FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "dcl_delete" ON daily_cost_lines FOR DELETE TO authenticated USING (public.is_founder());
