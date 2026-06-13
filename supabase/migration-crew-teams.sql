-- ═════════════════════════════════════════════════════════════
-- Crew teams: contact-based core team (name/email/mobile), grouped into
-- Pre-Production / Production / Post-Production; invited crew log in (scoped
-- to their project) and match by email; per-project communication channel.
-- Run once. Safe to re-run. (Supersedes migration-crew-contacts.sql.)
-- ═════════════════════════════════════════════════════════════

-- 1. Contact-only members + which team they're on
ALTER TABLE project_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS member_name TEXT;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS member_email TEXT;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS member_phone TEXT;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS team_group TEXT NOT NULL DEFAULT 'production';
  -- team_group: 'pre_production' | 'production' | 'post_production'

-- 2. Project access also matches the logged-in user's EMAIL, so an invited
--    crew member gets access the moment they sign in (no user_id backfill).
CREATE OR REPLACE FUNCTION public.is_project_member(p_project UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project
      AND (user_id = auth.uid() OR lower(member_email) = lower(auth.email()))
  );
$$;

-- 3. Per-project communication channel
CREATE TABLE IF NOT EXISTS project_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_project_messages ON project_messages(project_id, created_at);
ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_messages_read" ON project_messages;
CREATE POLICY "project_messages_read" ON project_messages FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer') OR public.is_project_member(project_id));
DROP POLICY IF EXISTS "project_messages_insert" ON project_messages;
CREATE POLICY "project_messages_insert" ON project_messages FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND (public.user_role() IN ('founder','accountant','general_manager','executive_producer') OR public.is_project_member(project_id)));
DROP POLICY IF EXISTS "project_messages_delete" ON project_messages;
CREATE POLICY "project_messages_delete" ON project_messages FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_founder());
