-- OPM Office v3 Migration
-- Run in Supabase SQL Editor — idempotent

-- ─── FEATURE 1: Vendors ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  gst_number TEXT,
  pan TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  upi_id TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS payee_vendor_id UUID REFERENCES vendors(id);

-- RLS for vendors
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendors_read_authenticated" ON vendors;
CREATE POLICY "vendors_read_authenticated" ON vendors
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "vendors_insert_finance_gm" ON vendors;
CREATE POLICY "vendors_insert_finance_gm" ON vendors
  FOR INSERT TO authenticated WITH CHECK (
    public.user_role() IN ('founder', 'accountant', 'general_manager')
  );

DROP POLICY IF EXISTS "vendors_update_finance_gm" ON vendors;
CREATE POLICY "vendors_update_finance_gm" ON vendors
  FOR UPDATE TO authenticated USING (
    public.user_role() IN ('founder', 'accountant', 'general_manager')
  );

-- updated_at trigger for vendors
DROP TRIGGER IF EXISTS set_updated_at_vendors ON vendors;
CREATE TRIGGER set_updated_at_vendors BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── FEATURE 2: Bank Accounts ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'bank' CHECK (account_type IN ('bank','upi','cash_drawer')),
  account_number TEXT,
  ifsc TEXT,
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS account_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  amount NUMERIC(15,2) NOT NULL,
  description TEXT,
  reference TEXT,
  entity_type TEXT,
  entity_id UUID,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS for bank_accounts
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_accounts_read_finance_gm" ON bank_accounts;
CREATE POLICY "bank_accounts_read_finance_gm" ON bank_accounts
  FOR SELECT TO authenticated USING (
    public.user_role() IN ('founder', 'accountant', 'general_manager')
  );

DROP POLICY IF EXISTS "bank_accounts_write_finance" ON bank_accounts;
CREATE POLICY "bank_accounts_write_finance" ON bank_accounts
  FOR ALL TO authenticated USING (public.is_finance()) WITH CHECK (public.is_finance());

-- RLS for account_transactions
ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "account_transactions_read_finance_gm" ON account_transactions;
CREATE POLICY "account_transactions_read_finance_gm" ON account_transactions
  FOR SELECT TO authenticated USING (
    public.user_role() IN ('founder', 'accountant', 'general_manager')
  );

DROP POLICY IF EXISTS "account_transactions_write_finance" ON account_transactions;
CREATE POLICY "account_transactions_write_finance" ON account_transactions
  FOR ALL TO authenticated USING (public.is_finance()) WITH CHECK (public.is_finance());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_account_transactions_account ON account_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_date ON account_transactions(txn_date DESC);

-- ─── FEATURE 3: GST / TDS on Payment Requests ────────────────────────
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(15,2);
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS tds_percent NUMERIC(5,2);
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(15,2);
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS net_payable NUMERIC(15,2);

-- ─── FEATURE 7: Realtime for notifications ───────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN others THEN NULL;
END $$;

-- ─── FEATURE 10: Payroll ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_salaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_name TEXT NOT NULL,
  role_title TEXT,
  monthly_salary NUMERIC(15,2) NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add 'salary' to liabilities type check (drop and recreate)
ALTER TABLE liabilities DROP CONSTRAINT IF EXISTS liabilities_type_check;
ALTER TABLE liabilities ADD CONSTRAINT liabilities_type_check
  CHECK (type IN ('loan', 'vendor', 'artist', 'technician', 'rent', 'tax', 'personal', 'other', 'salary'));

-- RLS for staff_salaries
ALTER TABLE staff_salaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_salaries_read_finance" ON staff_salaries;
CREATE POLICY "staff_salaries_read_finance" ON staff_salaries
  FOR SELECT TO authenticated USING (public.is_finance());

DROP POLICY IF EXISTS "staff_salaries_write_finance" ON staff_salaries;
CREATE POLICY "staff_salaries_write_finance" ON staff_salaries
  FOR ALL TO authenticated USING (public.is_finance()) WITH CHECK (public.is_finance());

-- updated_at trigger for staff_salaries
DROP TRIGGER IF EXISTS set_updated_at_staff_salaries ON staff_salaries;
CREATE TRIGGER set_updated_at_staff_salaries BEFORE UPDATE ON staff_salaries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
