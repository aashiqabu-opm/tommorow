-- ═══════════════════════════════════════════════════════════════════════
-- PERSONAL / FOUNDER MODULE — Phase 1 (foundation + founder↔company)
-- Private to each owner (the founder). Privacy is enforced by RLS keyed to the
-- owner's user id, plus an optional read-only delegate. Tables live in `public`
-- (so the existing browser client + PostgREST reach them) but are prefixed
-- `personal_` and locked down. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- Delegates: an owner may grant ONE+ trusted users read access to their data.
CREATE TABLE IF NOT EXISTS personal_delegates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delegate_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  can_view BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_id, delegate_user_id));

-- Access helper: the owner themselves, or a granted delegate.
CREATE OR REPLACE FUNCTION public.can_view_personal(p_owner UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_owner = auth.uid()
      OR EXISTS (SELECT 1 FROM personal_delegates d
                 WHERE d.owner_id = p_owner AND d.delegate_user_id = auth.uid() AND d.can_view);
$$;

-- Founder ↔ company ledger (the bridge). direction:
--   'to_company'   = you funded the company (loan/capital) → company owes you
--   'from_company' = company paid you (drawing/dividend/repayment) → reduces it
-- kind: loan | capital | drawing | dividend | repayment | reimbursement
CREATE TABLE IF NOT EXISTS personal_company_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity TEXT NOT NULL DEFAULT 'OPM Cinemas',
  direction TEXT NOT NULL CHECK (direction IN ('to_company','from_company')),
  kind TEXT NOT NULL DEFAULT 'loan',
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_personal_ledger_owner ON personal_company_ledger(owner_id, txn_date DESC);

-- Personal guarantees (exposure). status: active | released
CREATE TABLE IF NOT EXISTS personal_guarantees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lender TEXT NOT NULL,
  borrower TEXT NOT NULL DEFAULT 'OPM Cinemas',
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  start_date DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','released')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_personal_guarantees_owner ON personal_guarantees(owner_id, status);

-- Personal accounts (cash/bank position for the landing dashboard).
CREATE TABLE IF NOT EXISTS personal_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bank' CHECK (type IN ('bank','cash','wallet','investment')),
  balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_personal_accounts_owner ON personal_accounts(owner_id);

-- ───────────── RLS: read = owner or delegate; write = owner only ─────────────
ALTER TABLE personal_delegates ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_company_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_guarantees ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pdel_read" ON personal_delegates;
CREATE POLICY "pdel_read" ON personal_delegates FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR delegate_user_id = auth.uid());
DROP POLICY IF EXISTS "pdel_write" ON personal_delegates;
CREATE POLICY "pdel_write" ON personal_delegates FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "pledger_read" ON personal_company_ledger;
CREATE POLICY "pledger_read" ON personal_company_ledger FOR SELECT TO authenticated
  USING (public.can_view_personal(owner_id));
DROP POLICY IF EXISTS "pledger_write" ON personal_company_ledger;
CREATE POLICY "pledger_write" ON personal_company_ledger FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "pguar_read" ON personal_guarantees;
CREATE POLICY "pguar_read" ON personal_guarantees FOR SELECT TO authenticated
  USING (public.can_view_personal(owner_id));
DROP POLICY IF EXISTS "pguar_write" ON personal_guarantees;
CREATE POLICY "pguar_write" ON personal_guarantees FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "pacct_read" ON personal_accounts;
CREATE POLICY "pacct_read" ON personal_accounts FOR SELECT TO authenticated
  USING (public.can_view_personal(owner_id));
DROP POLICY IF EXISTS "pacct_write" ON personal_accounts;
CREATE POLICY "pacct_write" ON personal_accounts FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- ───────────── Private storage bucket (legal vault, used from Phase 2) ─────────────
INSERT INTO storage.buckets (id, name, public) VALUES ('personal','personal', false)
  ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "personal_objects_owner" ON storage.objects;
CREATE POLICY "personal_objects_owner" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'personal' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'personal' AND owner = auth.uid());
