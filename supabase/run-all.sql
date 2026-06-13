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
-- ─────────────────────────────────────────────
-- PER-PROJECT PETTY CASH FLOATS
-- A float is cash issued to a holder (e.g. production manager) for a project.
-- Transactions: issue (top-up), expense (spend, optionally coded to a budget
-- head), return (cash given back). Finance-only. Run in the Supabase SQL editor.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS petty_cash_floats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  holder_name TEXT NOT NULL,
  holder_user_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS petty_cash_txns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  float_id UUID NOT NULL REFERENCES petty_cash_floats(id) ON DELETE CASCADE,
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('issue', 'expense', 'return')),
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  head TEXT,                                 -- free-text category if no budget head
  budget_line_id UUID REFERENCES budget_lines(id) ON DELETE SET NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_petty_floats_project ON petty_cash_floats(project_id);
CREATE INDEX IF NOT EXISTS idx_petty_txns_float ON petty_cash_txns(float_id);

DROP TRIGGER IF EXISTS set_updated_at_petty ON petty_cash_floats;
CREATE TRIGGER set_updated_at_petty BEFORE UPDATE ON petty_cash_floats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE petty_cash_floats ENABLE ROW LEVEL SECURITY;
ALTER TABLE petty_cash_txns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "petty_floats_read_finance"   ON petty_cash_floats;
DROP POLICY IF EXISTS "petty_floats_insert_finance" ON petty_cash_floats;
DROP POLICY IF EXISTS "petty_floats_update_finance" ON petty_cash_floats;
DROP POLICY IF EXISTS "petty_floats_delete_finance" ON petty_cash_floats;
CREATE POLICY "petty_floats_read_finance"   ON petty_cash_floats FOR SELECT TO authenticated USING (public.is_finance());
CREATE POLICY "petty_floats_insert_finance" ON petty_cash_floats FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "petty_floats_update_finance" ON petty_cash_floats FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "petty_floats_delete_finance" ON petty_cash_floats FOR DELETE TO authenticated USING (public.is_finance());

DROP POLICY IF EXISTS "petty_txns_read_finance"   ON petty_cash_txns;
DROP POLICY IF EXISTS "petty_txns_insert_finance" ON petty_cash_txns;
DROP POLICY IF EXISTS "petty_txns_update_finance" ON petty_cash_txns;
DROP POLICY IF EXISTS "petty_txns_delete_finance" ON petty_cash_txns;
CREATE POLICY "petty_txns_read_finance"   ON petty_cash_txns FOR SELECT TO authenticated USING (public.is_finance());
CREATE POLICY "petty_txns_insert_finance" ON petty_cash_txns FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "petty_txns_update_finance" ON petty_cash_txns FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "petty_txns_delete_finance" ON petty_cash_txns FOR DELETE TO authenticated USING (public.is_finance());
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
-- ─────────────────────────────────────────────
-- DAILY PRODUCTION REPORT (DPR) — per project, per shoot day
-- Operational, so readable/editable by management (founder, accountant, GM, EP),
-- not finance-only. Run in the Supabase SQL editor.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS production_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  day_number INT,
  location TEXT,
  call_time TEXT,
  wrap_time TEXT,
  scenes_planned INT NOT NULL DEFAULT 0,
  scenes_completed INT NOT NULL DEFAULT 0,
  shots_completed INT,
  cast_present TEXT,
  crew_count INT,
  status TEXT NOT NULL DEFAULT 'on_schedule' CHECK (status IN ('on_schedule', 'ahead', 'behind')),
  weather TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_reports_project ON production_reports(project_id, report_date DESC);

DROP TRIGGER IF EXISTS set_updated_at_dpr ON production_reports;
CREATE TRIGGER set_updated_at_dpr BEFORE UPDATE ON production_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE production_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dpr_read"   ON production_reports;
DROP POLICY IF EXISTS "dpr_insert" ON production_reports;
DROP POLICY IF EXISTS "dpr_update" ON production_reports;
DROP POLICY IF EXISTS "dpr_delete" ON production_reports;
CREATE POLICY "dpr_read"   ON production_reports FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "dpr_insert" ON production_reports FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "dpr_update" ON production_reports FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "dpr_delete" ON production_reports FOR DELETE TO authenticated USING (public.is_founder());
