-- ─────────────────────────────────────────────
-- TAX EXTRAS: explicit TDS section, TDS challan/deposit log, output GST.
-- Run in the Supabase SQL editor.
-- ─────────────────────────────────────────────

-- Record the TDS section on a payment (instead of inferring from category)
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS tds_section TEXT;

-- Output GST collected on revenue (distribution / MG / rights)
ALTER TABLE project_income ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(15, 2);

-- TDS deposited to government (challans) — to reconcile deducted vs deposited
CREATE TABLE IF NOT EXISTS tds_challans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deposit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_month TEXT,                 -- the month the TDS relates to, e.g. '2026-05'
  section TEXT,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  challan_no TEXT,
  bsr_code TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tds_challans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tds_challans_read_finance"   ON tds_challans;
DROP POLICY IF EXISTS "tds_challans_insert_finance" ON tds_challans;
DROP POLICY IF EXISTS "tds_challans_update_finance" ON tds_challans;
DROP POLICY IF EXISTS "tds_challans_delete_finance" ON tds_challans;
CREATE POLICY "tds_challans_read_finance"   ON tds_challans FOR SELECT TO authenticated USING (public.is_finance());
CREATE POLICY "tds_challans_insert_finance" ON tds_challans FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "tds_challans_update_finance" ON tds_challans FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "tds_challans_delete_finance" ON tds_challans FOR DELETE TO authenticated USING (public.is_finance());
