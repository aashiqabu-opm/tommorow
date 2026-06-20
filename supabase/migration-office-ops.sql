-- ═══════════════════════════════════════════════════════════════════════
-- OPM Office — internal Operations module (the "virtual office").
-- A coordination hub for the core team (not a film project): office tasks/
-- requisitions and team notices. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- Tasks / requisitions for running the office
CREATE TABLE IF NOT EXISTS office_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general','finance','legal','hr','procurement','it','facilities','compliance')),
  assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','blocked','done')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  due_date DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_office_tasks_status ON office_tasks(status, due_date);

-- Notices / announcements pinned for the core team
CREATE TABLE IF NOT EXISTS office_notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  body TEXT,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE office_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE office_notices ENABLE ROW LEVEL SECURITY;

-- Read: any active staff/core member. Write: management (founder/accountant/GM/EP).
DROP POLICY IF EXISTS office_tasks_read ON office_tasks;
CREATE POLICY office_tasks_read ON office_tasks FOR SELECT TO authenticated
  USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer','staff'));
DROP POLICY IF EXISTS office_tasks_write ON office_tasks;
CREATE POLICY office_tasks_write ON office_tasks FOR ALL TO authenticated
  USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer'))
  WITH CHECK (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));

DROP POLICY IF EXISTS office_notices_read ON office_notices;
CREATE POLICY office_notices_read ON office_notices FOR SELECT TO authenticated
  USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer','staff'));
DROP POLICY IF EXISTS office_notices_write ON office_notices;
CREATE POLICY office_notices_write ON office_notices FOR ALL TO authenticated
  USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer'))
  WITH CHECK (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));

DROP TRIGGER IF EXISTS set_updated_at_office_tasks ON office_tasks;
CREATE TRIGGER set_updated_at_office_tasks BEFORE UPDATE ON office_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
