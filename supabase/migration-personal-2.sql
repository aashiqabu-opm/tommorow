-- ═══════════════════════════════════════════════════════════════════════
-- PERSONAL / FOUNDER MODULE — Phase 2 (tax engine, film income, legal vault)
-- Same privacy model as Phase 1: public.personal_* tables, owner-only writes,
-- read via can_view_personal(owner_id). Requires migration-personal.sql first.
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Tax engine (India) ──
CREATE TABLE IF NOT EXISTS personal_tax_profile (
  owner_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  pan TEXT,
  regime TEXT NOT NULL DEFAULT 'new' CHECK (regime IN ('old','new')),
  fy TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());

CREATE TABLE IF NOT EXISTS personal_tax_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'advance_tax' CHECK (kind IN ('advance_tax','self_assessment','tds','itr')),
  label TEXT NOT NULL,
  fy TEXT,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','filed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_ptax_items_owner ON personal_tax_items(owner_id, due_date);

CREATE TABLE IF NOT EXISTS personal_deductions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  section TEXT NOT NULL DEFAULT '80C',
  label TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  fy TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_pded_owner ON personal_deductions(owner_id);

CREATE TABLE IF NOT EXISTS personal_capital_gains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset TEXT NOT NULL,
  buy_date DATE,
  buy_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  sell_date DATE,
  sell_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  gain_type TEXT CHECK (gain_type IN ('LTCG','STCG')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_pcg_owner ON personal_capital_gains(owner_id);

-- ── Film income ──
CREATE TABLE IF NOT EXISTS personal_film_stakes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  film TEXT NOT NULL,
  entity TEXT,
  ownership_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  investment NUMERIC(15,2) NOT NULL DEFAULT 0,
  profit_share_terms TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_pfs_owner ON personal_film_stakes(owner_id);

CREATE TABLE IF NOT EXISTS personal_royalties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  film TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'satellite' CHECK (source IN ('satellite','ott','music','theatrical','other')),
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  expected_date DATE,
  received_date DATE,
  status TEXT NOT NULL DEFAULT 'expected' CHECK (status IN ('expected','received','overdue')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_proy_owner ON personal_royalties(owner_id, status);

-- ── Legal vault ──
CREATE TABLE IF NOT EXISTS personal_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'other',
  file_path TEXT,
  file_name TEXT,
  ai_summary TEXT,
  key_dates JSONB,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_pdoc_owner ON personal_documents(owner_id, expiry_date);

-- ── RLS (read = can_view_personal, write = owner) ──
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'personal_tax_profile','personal_tax_items','personal_deductions','personal_capital_gains',
    'personal_film_stakes','personal_royalties','personal_documents']) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_read', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.can_view_personal(owner_id))', t||'_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_write', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())', t||'_write', t);
  END LOOP;
END $$;
