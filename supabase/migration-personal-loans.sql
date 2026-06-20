-- Personal Loans tracker (founder-private, RLS to owner)
-- Tracks auto/home/personal loans: EMI, outstanding, rate, tenure, debit account.
CREATE TABLE IF NOT EXISTS personal_loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lender TEXT NOT NULL,
  loan_type TEXT NOT NULL DEFAULT 'other'
    CHECK (loan_type IN ('auto','auto_topup','home','personal','business','gold','education','loan_against_property','overdraft','other')),
  account_no TEXT,
  asset TEXT,                          -- collateral / financed asset (e.g. Volvo XC90)
  sanctioned_amount NUMERIC(15,2),
  outstanding NUMERIC(15,2),
  emi_amount NUMERIC(15,2),
  interest_rate NUMERIC(6,3),
  tenure_months INT,
  emis_paid INT,
  emi_day INT,                         -- day of month EMI is debited
  debit_account TEXT,                  -- account the EMI auto-debits from
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','closed','foreclosed','overdue')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE personal_loans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY personal_loans_read ON personal_loans
    FOR SELECT USING (can_view_personal(owner_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY personal_loans_write ON personal_loans
    FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
