-- Bank reconciliation: imported bank statement lines, matched to app
-- payments / income. Run once. Safe to re-run. Finance only.
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  txn_date DATE NOT NULL,
  description TEXT,
  reference TEXT,
  amount NUMERIC(15,2) NOT NULL,        -- + deposit (money in), - withdrawal (money out)
  matched_type TEXT,                    -- 'payment' | 'income' | 'manual' | NULL
  matched_id UUID,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bank_txn_account ON bank_transactions(account_id, txn_date DESC);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_txn_all_finance" ON bank_transactions;
CREATE POLICY "bank_txn_all_finance" ON bank_transactions FOR ALL TO authenticated
  USING (public.is_finance()) WITH CHECK (public.is_finance());
