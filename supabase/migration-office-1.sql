-- ═══════════════════════════════════════════════════════════════════════
-- OFFICE — per-project film-production suite: characters/casting, auditions,
-- shooting schedule, documents (screenplay/charts/PDF) with role-gated editing.
-- Idempotent. Uses existing helpers user_role(), my_project_role(), is_project_member().
-- ═══════════════════════════════════════════════════════════════════════

-- Who may EDIT project documents: founder, or the project's director /
-- screenwriter / assistant directors (chief_ad, associate_director).
CREATE OR REPLACE FUNCTION public.can_edit_project_docs(p_project UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_founder()
      OR public.my_project_role(p_project) IN ('director','screenwriter','chief_ad','associate_director');
$$;

-- Characters / roles for the casting process.
CREATE TABLE IF NOT EXISTS project_characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  age_range TEXT,
  gender TEXT,
  importance TEXT DEFAULT 'supporting',   -- lead | supporting | cameo | extra
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','casting','cast','on_hold')),
  cast_actor TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_pchar_project ON project_characters(project_id);

-- Auditions for a project / character.
CREATE TABLE IF NOT EXISTS project_auditions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  character_id UUID REFERENCES project_characters(id) ON DELETE SET NULL,
  applicant_name TEXT NOT NULL,
  contact TEXT,
  age TEXT,
  location TEXT,
  photo_url TEXT,
  video_url TEXT,
  ai_score INT,
  ai_notes TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','shortlist','maybe','pass','callback','cast')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_paud_project ON project_auditions(project_id, status);

-- Shooting schedule.
CREATE TABLE IF NOT EXISTS project_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shoot_date DATE NOT NULL,
  end_date DATE,
  location TEXT,
  scenes TEXT,
  call_time TEXT,
  unit TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','confirmed','done','cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_psched_project ON project_schedule(project_id, shoot_date);

-- Project documents: screenplay, charts, PDFs. AI reads → ai_summary + ai_data.
CREATE TABLE IF NOT EXISTS project_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'other' CHECK (doc_type IN ('screenplay','chart','pdf','reference','other')),
  file_path TEXT,
  file_name TEXT,
  ai_summary TEXT,
  ai_data JSONB,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_pdocs_project ON project_documents(project_id, created_at DESC);

-- ── RLS ──
ALTER TABLE project_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_auditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

-- Read: management app-roles or anyone on the project. Write: founder + director/AD/screenwriter
-- (for docs, gated by can_edit_project_docs; for casting/schedule, same edit group + casting_director).
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['project_characters','project_auditions','project_schedule','project_documents']) LOOP
    EXECUTE format($f$DROP POLICY IF EXISTS %1$s_read ON %1$s$f$, t);
    EXECUTE format($f$CREATE POLICY %1$s_read ON %1$s FOR SELECT TO authenticated USING (
      public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer')
      OR public.is_project_member(project_id))$f$, t);
  END LOOP;
END $$;

-- Documents: edit limited to director/screenwriter/ADs + founder.
DROP POLICY IF EXISTS project_documents_write ON project_documents;
CREATE POLICY project_documents_write ON project_documents FOR ALL TO authenticated
  USING (public.can_edit_project_docs(project_id)) WITH CHECK (public.can_edit_project_docs(project_id));

-- Characters / auditions / schedule: editable by founder, director/ADs/screenwriter, casting_director.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['project_characters','project_auditions','project_schedule']) LOOP
    EXECUTE format($f$DROP POLICY IF EXISTS %1$s_write ON %1$s$f$, t);
    EXECUTE format($f$CREATE POLICY %1$s_write ON %1$s FOR ALL TO authenticated USING (
      public.is_founder() OR public.user_role() IN ('general_manager','executive_producer')
      OR public.my_project_role(project_id) IN ('director','screenwriter','chief_ad','associate_director','casting_director'))
      WITH CHECK (public.is_founder() OR public.user_role() IN ('general_manager','executive_producer')
      OR public.my_project_role(project_id) IN ('director','screenwriter','chief_ad','associate_director','casting_director'))$f$, t);
  END LOOP;
END $$;
