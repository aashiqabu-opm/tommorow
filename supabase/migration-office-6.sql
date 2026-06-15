-- ═══════════════════════════════════════════════════════════════════════
-- OFFICE — Wave C: rights & deals manager (feeds revenue + investor recovery).
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS project_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'theatrical' CHECK (kind IN ('theatrical','satellite','ott','music','audio','overseas','dubbing_rights','other')),
  counterparty TEXT NOT NULL,           -- distributor / channel / platform
  territory TEXT,
  mg_amount NUMERIC(15,2),              -- minimum guarantee / advance
  total_value NUMERIC(15,2),           -- expected total incl. overflow
  overflow_terms TEXT,
  status TEXT NOT NULL DEFAULT 'negotiating' CHECK (status IN ('negotiating','agreed','signed','received','cancelled')),
  received_amount NUMERIC(15,2) DEFAULT 0,
  received_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_pdeals_project ON project_deals(project_id, kind);

ALTER TABLE project_deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_deals_read ON project_deals;
CREATE POLICY project_deals_read ON project_deals FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer')
  OR public.is_project_member(project_id));
DROP POLICY IF EXISTS project_deals_write ON project_deals;
CREATE POLICY project_deals_write ON project_deals FOR ALL TO authenticated USING (
  public.is_founder() OR public.user_role() IN ('accountant','general_manager','executive_producer')
  OR public.my_project_role(project_id) = 'production_controller')
  WITH CHECK (
  public.is_founder() OR public.user_role() IN ('accountant','general_manager','executive_producer')
  OR public.my_project_role(project_id) = 'production_controller');

-- Optional release-planning fields on projects (screens/shows opening).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS release_screens INT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS release_territory TEXT;
