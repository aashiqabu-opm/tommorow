-- ═════════════════════════════════════════════════════════════
-- Migration: Per-project core teams + daily check-ins + staff role
--   • Adds "staff" app role (field crew: drivers, cashiers, etc.)
--   • Defines per-project roles on project_members
--   • Adds project_checkins (daily team reporting to producer)
--   • Helper functions + RLS so field staff see only their projects
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ═════════════════════════════════════════════════════════════

-- 1. Add "staff" to the allowed app roles ----------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer', 'staff'));

-- 2. project_members already exists. Make sure project_role is rich.
--    (chief_ad, production_executive, production_manager, cashier,
--     purchase_manager, location_manager, driver, production_assistant, member)
ALTER TABLE project_members ALTER COLUMN project_role SET DEFAULT 'member';
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES profiles(id);
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS title TEXT;       -- free-text designation override

-- 3. Helper functions -----------------------------------------
CREATE OR REPLACE FUNCTION public.is_project_member(p_project UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.my_project_role(p_project UUID)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT project_role FROM project_members
  WHERE project_id = p_project AND user_id = auth.uid()
  LIMIT 1;
$$;

-- 4. Daily check-ins ------------------------------------------
CREATE TABLE IF NOT EXISTS project_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary TEXT NOT NULL,                 -- what I did today
  blockers TEXT,                          -- any issues / needs
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checkins_project ON project_checkins(project_id, checkin_date DESC);

-- 5. RLS ------------------------------------------------------
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_checkins ENABLE ROW LEVEL SECURITY;

-- Management can see/manage all teams; members can see their own teams.
DROP POLICY IF EXISTS "project_members_read" ON project_members;
CREATE POLICY "project_members_read" ON project_members
  FOR SELECT TO authenticated USING (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer')
    OR public.is_project_member(project_id)
  );

DROP POLICY IF EXISTS "project_members_write" ON project_members;
CREATE POLICY "project_members_write" ON project_members
  FOR ALL TO authenticated USING (
    public.user_role() IN ('founder', 'general_manager', 'executive_producer')
  ) WITH CHECK (
    public.user_role() IN ('founder', 'general_manager', 'executive_producer')
  );

-- Check-ins: anyone on the project (or management) can read; the author
-- and project members can post; author/founder can delete.
DROP POLICY IF EXISTS "checkins_read" ON project_checkins;
CREATE POLICY "checkins_read" ON project_checkins
  FOR SELECT TO authenticated USING (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
    OR public.is_project_member(project_id)
  );

DROP POLICY IF EXISTS "checkins_insert" ON project_checkins;
CREATE POLICY "checkins_insert" ON project_checkins
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND (
      public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
      OR public.is_project_member(project_id)
    )
  );

DROP POLICY IF EXISTS "checkins_delete" ON project_checkins;
CREATE POLICY "checkins_delete" ON project_checkins
  FOR DELETE TO authenticated USING (
    author_id = auth.uid() OR public.is_founder()
  );

-- 6. Let staff (and members) read the projects they belong to --
--    Replaces the old "read everything" policy so field staff are
--    scoped to the projects they're assigned to. Management still sees all.
DROP POLICY IF EXISTS "projects_read_all" ON projects;
DROP POLICY IF EXISTS "projects_read_members" ON projects;
CREATE POLICY "projects_read_members" ON projects
  FOR SELECT TO authenticated USING (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer')
    OR public.is_project_member(id)
  );
