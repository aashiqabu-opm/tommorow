-- ─────────────────────────────────────────────
-- RECEIVABLES + ENCUMBRANCES (Phase 5.1)
-- Extends the existing project_deals (kinds: theatrical/satellite/ott/music/
-- audio/overseas/dubbing_rights/other) with an expected-inflow date, and adds an
-- ENCUMBRANCE ledger: portions of a receivable legally claimed by a creditor
-- (garnishee order, loan repayment tied to release, assignment of receivable).
-- This lets the cash-flow forecast separate FREE cash from money already spoken for
-- (e.g. BetterInvest garnishee on Netflix receivables, JM Infotainment repayment).
--
-- Money truth unchanged: realized revenue is still project_income + deals.received;
-- encumbrances reduce *free* receivable, they are not income or actuals.
-- project_deals keeps its own RLS (only adding a column). RLS for the new table
-- mirrors the procurement pattern: read = management, write = finance, delete = founder.
-- ─────────────────────────────────────────────

ALTER TABLE project_deals
  ADD COLUMN IF NOT EXISTS expected_date DATE;

CREATE TABLE IF NOT EXISTS receivable_encumbrances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES project_deals(id) ON DELETE SET NULL, -- which receivable (null = general)
  creditor TEXT NOT NULL,              -- JM Infotainment / BetterInvest / TRU Stories
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('garnishee', 'assignment', 'loan_repayment', 'lien', 'other')),
  claimed_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  reason TEXT,
  reference TEXT,                      -- court order no. / agreement ref
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'settled')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_encumbrances_project ON receivable_encumbrances(project_id, status);
CREATE INDEX IF NOT EXISTS idx_encumbrances_deal ON receivable_encumbrances(deal_id);

DROP TRIGGER IF EXISTS set_updated_at_encumbrances ON receivable_encumbrances;
CREATE TRIGGER set_updated_at_encumbrances BEFORE UPDATE ON receivable_encumbrances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE receivable_encumbrances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "enc_read"   ON receivable_encumbrances;
DROP POLICY IF EXISTS "enc_insert" ON receivable_encumbrances;
DROP POLICY IF EXISTS "enc_update" ON receivable_encumbrances;
DROP POLICY IF EXISTS "enc_delete" ON receivable_encumbrances;
CREATE POLICY "enc_read"   ON receivable_encumbrances FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "enc_insert" ON receivable_encumbrances FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "enc_update" ON receivable_encumbrances FOR UPDATE TO authenticated USING (public.is_finance());
CREATE POLICY "enc_delete" ON receivable_encumbrances FOR DELETE TO authenticated USING (public.is_founder());
