-- ═══════════════════════════════════════════════════════════════════════
-- PERSONAL / FOUNDER MODULE — Phase 3 trackers
-- Recurring bills, vehicles, health policies, credit cards, transactions.
-- Same privacy model (owner-only writes, can_view_personal reads). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- Recurring monthly commitments (rent, utilities, subscriptions, EMIs).
CREATE TABLE IF NOT EXISTS personal_recurring (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('rent','utility','subscription','emi','maintenance','insurance','other')),
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  due_day INT,                       -- day of month (1-31)
  autopay BOOLEAN NOT NULL DEFAULT FALSE,
  last_paid_month TEXT,              -- 'YYYY-MM' of the last month marked paid
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_precur_owner ON personal_recurring(owner_id);

-- Vehicles with the common renewal dates inline.
CREATE TABLE IF NOT EXISTS personal_vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  reg_number TEXT,
  vtype TEXT NOT NULL DEFAULT 'car' CHECK (vtype IN ('car','bike','suv','van','other')),
  insurance_expiry DATE,
  road_tax_expiry DATE,
  puc_expiry DATE,
  fitness_expiry DATE,
  registration_expiry DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_pveh_owner ON personal_vehicles(owner_id);

-- Health (and other) insurance policies.
CREATE TABLE IF NOT EXISTS personal_health_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  insurer TEXT NOT NULL,
  policy_number TEXT,
  kind TEXT NOT NULL DEFAULT 'health' CHECK (kind IN ('health','life','term','vehicle','other')),
  sum_insured NUMERIC(15,2),
  premium NUMERIC(15,2),
  renewal_date DATE,
  members TEXT,
  nominee TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_php_owner ON personal_health_policies(owner_id, renewal_date);

-- Credit cards.
CREATE TABLE IF NOT EXISTS personal_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  issuer TEXT NOT NULL,
  last4 TEXT,
  card_limit NUMERIC(15,2),
  statement_day INT,
  due_day INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_pcard_owner ON personal_cards(owner_id);

-- Transactions (manual now; Gmail-fed later via email_ref dedupe).
CREATE TABLE IF NOT EXISTS personal_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'card' CHECK (source IN ('card','bank')),
  account_label TEXT,
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  merchant TEXT,
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  direction TEXT NOT NULL DEFAULT 'debit' CHECK (direction IN ('debit','credit')),
  category TEXT,
  notes TEXT,
  email_ref TEXT,                    -- Gmail message id, for dedupe when email-fed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_ptxn_owner ON personal_transactions(owner_id, txn_date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ptxn_emailref ON personal_transactions(owner_id, email_ref) WHERE email_ref IS NOT NULL;

-- RLS (read = can_view_personal, write = owner) for all five.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['personal_recurring','personal_vehicles','personal_health_policies','personal_cards','personal_transactions']) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_read', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (public.can_view_personal(owner_id))', t||'_read', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_write', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())', t||'_write', t);
  END LOOP;
END $$;
