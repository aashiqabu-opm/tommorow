-- ═════════════════════════════════════════════════════════════
-- Tally-style accounting: ledgers (chart of accounts) + vouchers
-- with Dr/Cr entries, so finance can enter data exactly like Tally
-- and export it 1:1 as Tally XML. Run once. Safe to re-run.
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ledgers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  parent TEXT NOT NULL DEFAULT 'Suspense A/c',  -- Tally group
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_type TEXT NOT NULL,                    -- Payment | Receipt | Contra | Journal | Sales | Purchase
  voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
  voucher_number TEXT,
  narration TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(voucher_date DESC);

CREATE TABLE IF NOT EXISTS voucher_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  ledger_name TEXT NOT NULL,
  dr BOOLEAN NOT NULL,                           -- true = Debit, false = Credit
  amount NUMERIC(15,2) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_voucher_entries_voucher ON voucher_entries(voucher_id);

-- RLS: finance only (founder + accountant)
ALTER TABLE ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledgers_all_finance" ON ledgers;
CREATE POLICY "ledgers_all_finance" ON ledgers FOR ALL TO authenticated USING (public.is_finance()) WITH CHECK (public.is_finance());
DROP POLICY IF EXISTS "vouchers_all_finance" ON vouchers;
CREATE POLICY "vouchers_all_finance" ON vouchers FOR ALL TO authenticated USING (public.is_finance()) WITH CHECK (public.is_finance());
DROP POLICY IF EXISTS "voucher_entries_all_finance" ON voucher_entries;
CREATE POLICY "voucher_entries_all_finance" ON voucher_entries FOR ALL TO authenticated USING (public.is_finance()) WITH CHECK (public.is_finance());

-- Seed a starter chart of accounts (common Tally ledgers). Skips existing.
INSERT INTO ledgers (name, parent) VALUES
  ('Cash', 'Cash-in-Hand'),
  ('Input CGST', 'Duties & Taxes'),
  ('Input SGST', 'Duties & Taxes'),
  ('Input IGST', 'Duties & Taxes'),
  ('Output CGST', 'Duties & Taxes'),
  ('Output SGST', 'Duties & Taxes'),
  ('Output IGST', 'Duties & Taxes'),
  ('TDS Payable', 'Duties & Taxes'),
  ('Round Off', 'Indirect Expenses'),
  ('Production Expenses', 'Direct Expenses'),
  ('Salary & Wages', 'Indirect Expenses'),
  ('Rent', 'Indirect Expenses')
ON CONFLICT (name) DO NOTHING;
