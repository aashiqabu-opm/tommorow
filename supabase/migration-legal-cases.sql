-- ═══════════════════════════════════════════════════════════════════════
-- Personal module — Legal Cases tracker (court cases, disputes, obligations)
-- Owner-only privacy, same model as the rest of the personal vault.
-- Requires migration-personal.sql (can_view_personal). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS personal_legal_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  case_type TEXT NOT NULL DEFAULT 'civil'
    CHECK (case_type IN ('civil','criminal','arbitration','recovery','cheque_bounce','company','ip_copyright','labour','tax','other')),
  our_role TEXT NOT NULL DEFAULT 'petitioner'
    CHECK (our_role IN ('petitioner','plaintiff','complainant','respondent','defendant','accused','third_party')),
  opposing_party TEXT,
  related_entity TEXT,                 -- e.g. OPM Cinemas Proprietorship / OPM Dream Mill Cinemas Pvt Ltd / Personal
  related_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  court TEXT,
  case_number TEXT,
  jurisdiction TEXT,
  amount_involved NUMERIC(15,2),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','on_hold','won','lost','settled','closed')),
  filing_date DATE,
  next_hearing_date DATE,
  lawyer_name TEXT,
  lawyer_contact TEXT,
  ai_summary TEXT,
  ai_key_dates JSONB,
  notes TEXT,
  file_path TEXT,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_cases_owner ON personal_legal_cases(owner_id, status);

ALTER TABLE personal_legal_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personal_legal_cases_read ON personal_legal_cases;
CREATE POLICY personal_legal_cases_read ON personal_legal_cases
  FOR SELECT TO authenticated USING (public.can_view_personal(owner_id));

DROP POLICY IF EXISTS personal_legal_cases_write ON personal_legal_cases;
CREATE POLICY personal_legal_cases_write ON personal_legal_cases
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP TRIGGER IF EXISTS set_updated_at_legal_cases ON personal_legal_cases;
CREATE TRIGGER set_updated_at_legal_cases BEFORE UPDATE ON personal_legal_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
