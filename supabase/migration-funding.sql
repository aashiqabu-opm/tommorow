-- ─────────────────────────────────────────────
-- PROJECT FUNDING / CAPITAL STACK
-- Per-project investors, loans (with monthly interest) and OPM's own
-- investment, plus a transaction log for each source.
-- Finance-only (founder + accountant). Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_funding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('investor', 'loan', 'opm')),
  name TEXT NOT NULL,                       -- investor / lender name, or "OPM Cinemas"
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0, -- committed capital / loan principal / OPM investment
  equity_percent NUMERIC(6, 3),             -- investor profit / ownership share (%)
  interest_rate NUMERIC(7, 4),              -- loan interest rate (%)
  interest_basis TEXT DEFAULT 'monthly' CHECK (interest_basis IN ('monthly', 'annual')),
  interest_method TEXT DEFAULT 'simple' CHECK (interest_method IN ('simple', 'reducing')),
  start_date DATE,                          -- onboarding / disbursal / investment date
  tenure_months INT,                        -- optional loan tenure
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

CREATE TRIGGER set_updated_at_funding BEFORE UPDATE ON project_funding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: finance only
ALTER TABLE project_funding ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funding_read_finance"   ON project_funding FOR SELECT TO authenticated USING (public.is_finance());
CREATE POLICY "funding_insert_finance" ON project_funding FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "funding_update_finance" ON project_funding FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "funding_delete_finance" ON project_funding FOR DELETE TO authenticated USING (public.is_finance());

CREATE POLICY "funding_txn_read_finance"   ON funding_transactions FOR SELECT TO authenticated USING (public.is_finance());
CREATE POLICY "funding_txn_insert_finance" ON funding_transactions FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "funding_txn_update_finance" ON funding_transactions FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "funding_txn_delete_finance" ON funding_transactions FOR DELETE TO authenticated USING (public.is_finance());
