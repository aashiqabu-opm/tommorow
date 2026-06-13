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
