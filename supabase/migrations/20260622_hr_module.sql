-- ─────────────────────────────────────────────
-- HR MODULE (Phase 4.3) — OPM Office internal hiring
-- job_positions + job_applications. Core team manages (Madan = general_manager);
-- founder handles escalations.
--
-- Adapted to live conventions (the draft assumed a non-existent 'core_team' role
-- and gen_random_uuid/auth.users): uses uuid_generate_v4(), profiles FKs, the
-- existing user_role() helper, and the actual management roles. is_founder()
-- untouched; no existing tables/policies modified.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS job_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  department TEXT,
  type TEXT NOT NULL CHECK (type IN ('permanent', 'project', 'freelance')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'on_hold')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  position_id UUID REFERENCES job_positions(id) ON DELETE CASCADE,
  applicant_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  portfolio_url TEXT,
  cover_note TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'shortlisted', 'rejected', 'escalated')),
  assigned_to UUID REFERENCES profiles(id),
  founder_notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_applications_position ON job_applications(position_id, status);

DROP TRIGGER IF EXISTS set_updated_at_job_positions ON job_positions;
CREATE TRIGGER set_updated_at_job_positions BEFORE UPDATE ON job_positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_job_applications ON job_applications;
CREATE TRIGGER set_updated_at_job_applications BEFORE UPDATE ON job_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: core team (management roles) full access; delete restricted to founder.
ALTER TABLE job_positions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobpos_read"   ON job_positions;
DROP POLICY IF EXISTS "jobpos_insert" ON job_positions;
DROP POLICY IF EXISTS "jobpos_update" ON job_positions;
DROP POLICY IF EXISTS "jobpos_delete" ON job_positions;
CREATE POLICY "jobpos_read"   ON job_positions FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "jobpos_insert" ON job_positions FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "jobpos_update" ON job_positions FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "jobpos_delete" ON job_positions FOR DELETE TO authenticated USING (public.is_founder());

DROP POLICY IF EXISTS "jobapp_read"   ON job_applications;
DROP POLICY IF EXISTS "jobapp_insert" ON job_applications;
DROP POLICY IF EXISTS "jobapp_update" ON job_applications;
DROP POLICY IF EXISTS "jobapp_delete" ON job_applications;
CREATE POLICY "jobapp_read"   ON job_applications FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "jobapp_insert" ON job_applications FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "jobapp_update" ON job_applications FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "jobapp_delete" ON job_applications FOR DELETE TO authenticated USING (public.is_founder());
