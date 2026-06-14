-- ═══════════════════════════════════════════════════════════════════════
-- PERSONAL — GST capture + receipt snapshots + push-to-accounts
-- GST-eligible transactions (vendor invoices with a GSTIN) get flagged, a small
-- snapshot saved, and can be pushed to a company-side gst_inputs table the
-- accountant sees. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE personal_transactions ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE personal_transactions ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(15,2);
ALTER TABLE personal_transactions ADD COLUMN IF NOT EXISTS taxable_value NUMERIC(15,2);
ALTER TABLE personal_transactions ADD COLUMN IF NOT EXISTS invoice_no TEXT;
ALTER TABLE personal_transactions ADD COLUMN IF NOT EXISTS snapshot_url TEXT;
ALTER TABLE personal_transactions ADD COLUMN IF NOT EXISTS gst_eligible BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE personal_transactions ADD COLUMN IF NOT EXISTS sent_to_accounts BOOLEAN NOT NULL DEFAULT FALSE;

-- Company-side GST input register (finance = founder + accountant).
CREATE TABLE IF NOT EXISTS gst_inputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_owner UUID REFERENCES profiles(id) ON DELETE SET NULL,
  vendor TEXT,
  gstin TEXT,
  invoice_no TEXT,
  invoice_date DATE,
  taxable_value NUMERIC(15,2),
  gst_amount NUMERIC(15,2),
  total NUMERIC(15,2),
  snapshot_url TEXT,
  category TEXT,
  notes TEXT,
  filed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_gst_inputs_filed ON gst_inputs(filed, invoice_date);
ALTER TABLE gst_inputs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gst_inputs_read" ON gst_inputs;
CREATE POLICY "gst_inputs_read" ON gst_inputs FOR SELECT TO authenticated USING (public.is_finance());
DROP POLICY IF EXISTS "gst_inputs_write" ON gst_inputs;
CREATE POLICY "gst_inputs_write" ON gst_inputs FOR ALL TO authenticated USING (public.is_finance()) WITH CHECK (public.is_finance());
