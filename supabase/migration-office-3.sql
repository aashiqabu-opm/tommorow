-- ═══════════════════════════════════════════════════════════════════════
-- OFFICE — Production Scheduling Phase 1 (cinema-grade): locations, script
-- breakdown (scenes + elements), shoot days with scene assignment, per-day
-- requirements + checklist. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- Who may EDIT scheduling: AD dept (director, chief_ad, associate_director,
-- production_controller) + founder / EP / GM.
CREATE OR REPLACE FUNCTION public.can_edit_schedule(p_project UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_founder()
      OR public.user_role() IN ('general_manager','executive_producer')
      OR public.my_project_role(p_project) IN ('director','chief_ad','associate_director','production_controller');
$$;

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  map_link TEXT,
  contact TEXT,
  permit_status TEXT DEFAULT 'pending',
  nearest_hospital TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_loc_project ON locations(project_id);

CREATE TABLE IF NOT EXISTS scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_no TEXT NOT NULL,
  int_ext TEXT DEFAULT 'INT' CHECK (int_ext IN ('INT','EXT','INT/EXT')),
  day_night TEXT DEFAULT 'DAY' CHECK (day_night IN ('DAY','NIGHT','DAWN','DUSK')),
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  set_name TEXT,
  page_eighths INT DEFAULT 0,            -- script length in 1/8 pages
  synopsis TEXT,
  status TEXT NOT NULL DEFAULT 'unscheduled' CHECK (status IN ('unscheduled','scheduled','shot','omitted')),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_scene_project ON scenes(project_id, sort_order);

CREATE TABLE IF NOT EXISTS scene_elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'prop' CHECK (category IN
    ('cast','junior_artists','technician','prop','wardrobe','makeup','special_makeup',
     'equipment','vehicle','stunt','vfx','sfx','animal','sound','set_dressing','other')),
  label TEXT NOT NULL,
  qty INT DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_selem_scene ON scene_elements(scene_id);
CREATE INDEX IF NOT EXISTS idx_selem_project ON scene_elements(project_id, category);

-- Upgrade the existing shoot-day table with pro fields.
ALTER TABLE project_schedule ADD COLUMN IF NOT EXISTS day_number INT;
ALTER TABLE project_schedule ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE project_schedule ADD COLUMN IF NOT EXISTS est_wrap TEXT;
ALTER TABLE project_schedule ADD COLUMN IF NOT EXISTS weather TEXT;
ALTER TABLE project_schedule ADD COLUMN IF NOT EXISTS sunrise TEXT;
ALTER TABLE project_schedule ADD COLUMN IF NOT EXISTS sunset TEXT;

CREATE TABLE IF NOT EXISTS schedule_day_scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_day_id UUID NOT NULL REFERENCES project_schedule(id) ON DELETE CASCADE,
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  UNIQUE(schedule_day_id, scene_id));
CREATE INDEX IF NOT EXISTS idx_sds_day ON schedule_day_scenes(schedule_day_id, sort_order);

CREATE TABLE IF NOT EXISTS day_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_day_id UUID NOT NULL REFERENCES project_schedule(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'equipment',
  label TEXT NOT NULL,
  qty INT DEFAULT 1,
  dept TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','arranged','done')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_dayreq_day ON day_requirements(schedule_day_id);

CREATE TABLE IF NOT EXISTS day_checklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_day_id UUID NOT NULL REFERENCES project_schedule(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  owner_dept TEXT,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_daychk_day ON day_checklist(schedule_day_id);

-- ── RLS ── read = team/mgmt; write = can_edit_schedule. Child tables join project via parent.
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_day_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_checklist ENABLE ROW LEVEL SECURITY;

-- Project-scoped tables (have project_id): standard read + can_edit_schedule write.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['locations','scenes','scene_elements']) LOOP
    EXECUTE format($f$DROP POLICY IF EXISTS %1$s_read ON %1$s$f$, t);
    EXECUTE format($f$CREATE POLICY %1$s_read ON %1$s FOR SELECT TO authenticated USING (
      public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer')
      OR public.is_project_member(project_id))$f$, t);
    EXECUTE format($f$DROP POLICY IF EXISTS %1$s_write ON %1$s$f$, t);
    EXECUTE format($f$CREATE POLICY %1$s_write ON %1$s FOR ALL TO authenticated
      USING (public.can_edit_schedule(project_id)) WITH CHECK (public.can_edit_schedule(project_id))$f$, t);
  END LOOP;
END $$;

-- Child tables of a schedule day: gate via the parent day's project.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['schedule_day_scenes','day_requirements','day_checklist']) LOOP
    EXECUTE format($f$DROP POLICY IF EXISTS %1$s_read ON %1$s$f$, t);
    EXECUTE format($f$CREATE POLICY %1$s_read ON %1$s FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM project_schedule d WHERE d.id = schedule_day_id AND (
        public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer')
        OR public.is_project_member(d.project_id))))$f$, t);
    EXECUTE format($f$DROP POLICY IF EXISTS %1$s_write ON %1$s$f$, t);
    EXECUTE format($f$CREATE POLICY %1$s_write ON %1$s FOR ALL TO authenticated USING (
      EXISTS (SELECT 1 FROM project_schedule d WHERE d.id = schedule_day_id AND public.can_edit_schedule(d.project_id)))
      WITH CHECK (
      EXISTS (SELECT 1 FROM project_schedule d WHERE d.id = schedule_day_id AND public.can_edit_schedule(d.project_id)))$f$, t);
  END LOOP;
END $$;
