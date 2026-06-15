-- ═══════════════════════════════════════════════════════════════════════
-- OFFICE — Wave B: post-production pipeline + deliverables (incl. CBFC censor)
-- + cast/crew deal memos. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- Who may edit POST tasks: post HODs + director/production-controller + mgmt/founder.
CREATE OR REPLACE FUNCTION public.can_edit_post(p_project UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_founder()
      OR public.user_role() IN ('general_manager','executive_producer')
      OR public.my_project_role(p_project) IN ('director','production_controller','editor','assistant_editor','sound_designer','vfx_director','colorist','music_director');
$$;

-- Post-production tasks (stages: edit, DI/colour, sound, mix, VFX, songs, dubbing, censor…)
CREATE TABLE IF NOT EXISTS project_post_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'edit' CHECK (stage IN
    ('edit','di','sound_design','mix','vfx','songs','bgm','dubbing','final_mix','censor','other')),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','review','done')),
  owner TEXT,
  due_date DATE,
  sort_order INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_ppost_project ON project_post_tasks(project_id, sort_order);

-- Deliverables (DCP/KDM, satellite M&E, OTT specs, censor certificate, audio…)
CREATE TABLE IF NOT EXISTS project_deliverables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT 'general' CHECK (target IN ('theatrical','satellite','ott','audio','censor','general')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','delivered')),
  due_date DATE,
  file_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_pdeliv_project ON project_deliverables(project_id, target);

-- Cast & crew deal memos / contracts.
CREATE TABLE IF NOT EXISTS project_deal_memos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  party_name TEXT NOT NULL,
  party_kind TEXT NOT NULL DEFAULT 'crew' CHECK (party_kind IN ('cast','crew','vendor','other')),
  role_title TEXT,
  fee NUMERIC(15,2),
  advance NUMERIC(15,2),
  tds_percent NUMERIC(5,2),
  terms TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','signed','cancelled')),
  signed_file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_pdeal_project ON project_deal_memos(project_id);

-- ── RLS ──
ALTER TABLE project_post_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_deal_memos ENABLE ROW LEVEL SECURITY;

-- Reads: management app-roles or project members.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['project_post_tasks','project_deliverables','project_deal_memos']) LOOP
    EXECUTE format($f$DROP POLICY IF EXISTS %1$s_read ON %1$s$f$, t);
    EXECUTE format($f$CREATE POLICY %1$s_read ON %1$s FOR SELECT TO authenticated USING (
      public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer')
      OR public.is_project_member(project_id))$f$, t);
  END LOOP;
END $$;

-- Post tasks: post HODs etc.
DROP POLICY IF EXISTS project_post_tasks_write ON project_post_tasks;
CREATE POLICY project_post_tasks_write ON project_post_tasks FOR ALL TO authenticated
  USING (public.can_edit_post(project_id)) WITH CHECK (public.can_edit_post(project_id));

-- Deliverables + deal memos: producers / production controller / director / founder.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['project_deliverables','project_deal_memos']) LOOP
    EXECUTE format($f$DROP POLICY IF EXISTS %1$s_write ON %1$s$f$, t);
    EXECUTE format($f$CREATE POLICY %1$s_write ON %1$s FOR ALL TO authenticated USING (
      public.is_founder() OR public.user_role() IN ('general_manager','executive_producer')
      OR public.my_project_role(project_id) IN ('director','production_controller'))
      WITH CHECK (
      public.is_founder() OR public.user_role() IN ('general_manager','executive_producer')
      OR public.my_project_role(project_id) IN ('director','production_controller'))$f$, t);
  END LOOP;
END $$;
