-- ============================================================
-- OPM Office — catch-up migration bundle
-- Idempotent: safe to run as many times as you like. Select all
-- (Cmd+A) in the Supabase SQL editor and Run once.
-- ============================================================

-- ── Cash: allow accountants (not just founder) to delete ──
DROP POLICY IF EXISTS "cash_delete_founder" ON cash_entries;
DROP POLICY IF EXISTS "cash_delete_finance" ON cash_entries;
CREATE POLICY "cash_delete_finance" ON cash_entries FOR DELETE TO authenticated USING (public.is_finance());

-- ── Revenue: lock project_income to finance roles ──
ALTER TABLE project_income ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "income_read_finance"   ON project_income;
DROP POLICY IF EXISTS "income_insert_finance" ON project_income;
DROP POLICY IF EXISTS "income_update_finance" ON project_income;
DROP POLICY IF EXISTS "income_delete_finance" ON project_income;
CREATE POLICY "income_read_finance"   ON project_income FOR SELECT TO authenticated USING (public.is_finance());
CREATE POLICY "income_insert_finance" ON project_income FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "income_update_finance" ON project_income FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "income_delete_finance" ON project_income FOR DELETE TO authenticated USING (public.is_finance());

-- ── Documents: open read to GM & Executive Producer ──
DROP POLICY IF EXISTS "documents_read" ON documents;
CREATE POLICY "documents_read" ON documents FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
  OR (public.user_role() = 'legal_viewer' AND access_level IN ('project_team', 'all_staff'))
);

-- ── Documents: AI analysis columns ──
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_analysis JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;

-- ── Funding & Capital Stack ──
CREATE TABLE IF NOT EXISTS project_funding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('investor', 'loan', 'opm')),
  name TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  equity_percent NUMERIC(6, 3),
  interest_rate NUMERIC(7, 4),
  interest_basis TEXT DEFAULT 'monthly' CHECK (interest_basis IN ('monthly', 'annual')),
  interest_method TEXT DEFAULT 'simple' CHECK (interest_method IN ('simple', 'reducing')),
  start_date DATE,
  tenure_months INT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS funding_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  funding_id UUID NOT NULL REFERENCES project_funding(id) ON DELETE CASCADE,
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('capital_in', 'payout', 'interest_paid', 'principal_repaid', 'other')),
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_funding_project ON project_funding(project_id);
CREATE INDEX IF NOT EXISTS idx_funding_transactions_funding ON funding_transactions(funding_id);
DROP TRIGGER IF EXISTS set_updated_at_funding ON project_funding;
CREATE TRIGGER set_updated_at_funding BEFORE UPDATE ON project_funding FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE project_funding ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "funding_read_finance"   ON project_funding;
DROP POLICY IF EXISTS "funding_insert_finance" ON project_funding;
DROP POLICY IF EXISTS "funding_update_finance" ON project_funding;
DROP POLICY IF EXISTS "funding_delete_finance" ON project_funding;
CREATE POLICY "funding_read_finance"   ON project_funding FOR SELECT TO authenticated USING (public.is_finance());
CREATE POLICY "funding_insert_finance" ON project_funding FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "funding_update_finance" ON project_funding FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "funding_delete_finance" ON project_funding FOR DELETE TO authenticated USING (public.is_finance());
DROP POLICY IF EXISTS "funding_txn_read_finance"   ON funding_transactions;
DROP POLICY IF EXISTS "funding_txn_insert_finance" ON funding_transactions;
DROP POLICY IF EXISTS "funding_txn_update_finance" ON funding_transactions;
DROP POLICY IF EXISTS "funding_txn_delete_finance" ON funding_transactions;
CREATE POLICY "funding_txn_read_finance"   ON funding_transactions FOR SELECT TO authenticated USING (public.is_finance());
CREATE POLICY "funding_txn_insert_finance" ON funding_transactions FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "funding_txn_update_finance" ON funding_transactions FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "funding_txn_delete_finance" ON funding_transactions FOR DELETE TO authenticated USING (public.is_finance());

-- ── Film Budget & Cost Report ──
CREATE TABLE IF NOT EXISTS budget_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  section TEXT NOT NULL DEFAULT 'below_line' CHECK (section IN ('above_line','below_line','post','other')),
  phase TEXT NOT NULL DEFAULT 'production' CHECK (phase IN ('development','pre','production','post','release')),
  head TEXT NOT NULL,
  estimated NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_budget_lines_project ON budget_lines(project_id);
DROP TRIGGER IF EXISTS set_updated_at_budget ON budget_lines;
CREATE TRIGGER set_updated_at_budget BEFORE UPDATE ON budget_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE budget_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "budget_read_finance"   ON budget_lines;
DROP POLICY IF EXISTS "budget_insert_finance" ON budget_lines;
DROP POLICY IF EXISTS "budget_update_finance" ON budget_lines;
DROP POLICY IF EXISTS "budget_delete_finance" ON budget_lines;
CREATE POLICY "budget_read_finance"   ON budget_lines FOR SELECT TO authenticated USING (public.is_finance());
CREATE POLICY "budget_insert_finance" ON budget_lines FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "budget_update_finance" ON budget_lines FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "budget_delete_finance" ON budget_lines FOR DELETE TO authenticated USING (public.is_finance());
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS budget_line_id UUID REFERENCES budget_lines(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payment_requests_budget_line ON payment_requests(budget_line_id);
