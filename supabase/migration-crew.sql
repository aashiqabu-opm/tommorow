-- ─────────────────────────────────────────────
-- PER-PROJECT CREW & CAST LEDGER
-- Each artist/technician: agreed fee, TDS, advances paid, balance due.
-- Optionally coded to a budget head so payments feed the cost report.
-- Finance-only. Run in the Supabase SQL editor.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_crew (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_title TEXT,                            -- e.g. "Cinematographer", "Lead Actor"
  agreed_fee NUMERIC(15, 2) NOT NULL DEFAULT 0,
  tds_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  budget_line_id UUID REFERENCES budget_lines(id) ON DELETE SET NULL,
  phone TEXT,
  email TEXT,
  pan TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crew_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  crew_id UUID NOT NULL REFERENCES project_crew(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL DEFAULT 'advance' CHECK (type IN ('advance', 'payment', 'final')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_crew_project ON project_crew(project_id);
CREATE INDEX IF NOT EXISTS idx_crew_payments_crew ON crew_payments(crew_id);

DROP TRIGGER IF EXISTS set_updated_at_crew ON project_crew;
CREATE TRIGGER set_updated_at_crew BEFORE UPDATE ON project_crew
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE project_crew ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crew_read_finance"   ON project_crew;
DROP POLICY IF EXISTS "crew_insert_finance" ON project_crew;
DROP POLICY IF EXISTS "crew_update_finance" ON project_crew;
DROP POLICY IF EXISTS "crew_delete_finance" ON project_crew;
CREATE POLICY "crew_read_finance"   ON project_crew FOR SELECT TO authenticated USING (public.is_finance());
CREATE POLICY "crew_insert_finance" ON project_crew FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "crew_update_finance" ON project_crew FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "crew_delete_finance" ON project_crew FOR DELETE TO authenticated USING (public.is_finance());

DROP POLICY IF EXISTS "crew_pay_read_finance"   ON crew_payments;
DROP POLICY IF EXISTS "crew_pay_insert_finance" ON crew_payments;
DROP POLICY IF EXISTS "crew_pay_update_finance" ON crew_payments;
DROP POLICY IF EXISTS "crew_pay_delete_finance" ON crew_payments;
CREATE POLICY "crew_pay_read_finance"   ON crew_payments FOR SELECT TO authenticated USING (public.is_finance());
CREATE POLICY "crew_pay_insert_finance" ON crew_payments FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "crew_pay_update_finance" ON crew_payments FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "crew_pay_delete_finance" ON crew_payments FOR DELETE TO authenticated USING (public.is_finance());
