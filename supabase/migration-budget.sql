-- ─────────────────────────────────────────────
-- FILM BUDGET + COST REPORT (per project)
-- Head-wise, phase-tagged budget lines. Actuals roll up from payment_requests
-- coded to a budget line. Finance-only. Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS budget_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section TEXT NOT NULL DEFAULT 'below_line'
    CHECK (section IN ('above_line', 'below_line', 'post', 'other')),
  phase TEXT NOT NULL DEFAULT 'production'
    CHECK (phase IN ('development', 'pre', 'production', 'post', 'release')),
  head TEXT NOT NULL,                       -- budget head / department, e.g. "Camera"
  estimated NUMERIC(15, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_lines_project ON budget_lines(project_id);

CREATE TRIGGER set_updated_at_budget BEFORE UPDATE ON budget_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budget_read_finance"   ON budget_lines FOR SELECT TO authenticated USING (public.is_finance());
CREATE POLICY "budget_insert_finance" ON budget_lines FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "budget_update_finance" ON budget_lines FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "budget_delete_finance" ON budget_lines FOR DELETE TO authenticated USING (public.is_finance());

-- Code a payment to a budget head so actuals roll up into the cost report
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS budget_line_id UUID REFERENCES budget_lines(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payment_requests_budget_line ON payment_requests(budget_line_id);
