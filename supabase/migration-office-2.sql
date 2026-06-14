-- Per-project PRESS KIT — posters, high-res stills, logos, publicity materials,
-- assembled before release. Idempotent.
CREATE TABLE IF NOT EXISTS project_press_kit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'poster' CHECK (kind IN ('poster','still','logo','publicity','trailer','press_note','other')),
  title TEXT NOT NULL,
  file_path TEXT,
  link TEXT,
  notes TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_ppress_project ON project_press_kit(project_id, kind);
ALTER TABLE project_press_kit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_press_kit_read ON project_press_kit;
CREATE POLICY project_press_kit_read ON project_press_kit FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer')
  OR public.is_project_member(project_id));
DROP POLICY IF EXISTS project_press_kit_write ON project_press_kit;
CREATE POLICY project_press_kit_write ON project_press_kit FOR ALL TO authenticated USING (
  public.is_founder() OR public.user_role() IN ('general_manager','executive_producer')
  OR public.my_project_role(project_id) IN ('director','associate_director','chief_ad'))
  WITH CHECK (
  public.is_founder() OR public.user_role() IN ('general_manager','executive_producer')
  OR public.my_project_role(project_id) IN ('director','associate_director','chief_ad'));

-- Channels: link the project's / company's YouTube + social pages into the ecosystem.
CREATE TABLE IF NOT EXISTS project_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,  -- null = company-wide channel
  platform TEXT NOT NULL DEFAULT 'youtube' CHECK (platform IN ('youtube','instagram','facebook','x','threads','website','other')),
  handle TEXT,
  url TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_pchan_project ON project_channels(project_id);
ALTER TABLE project_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_channels_read ON project_channels;
CREATE POLICY project_channels_read ON project_channels FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer')
  OR (project_id IS NOT NULL AND public.is_project_member(project_id)));
DROP POLICY IF EXISTS project_channels_write ON project_channels;
CREATE POLICY project_channels_write ON project_channels FOR ALL TO authenticated USING (
  public.is_founder() OR public.user_role() IN ('general_manager','executive_producer'))
  WITH CHECK (public.is_founder() OR public.user_role() IN ('general_manager','executive_producer'));
