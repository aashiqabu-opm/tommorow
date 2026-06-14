-- Call-sheet distribution log (one row each time a day's call sheet is sent).
CREATE TABLE IF NOT EXISTS call_sheets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  schedule_day_id UUID NOT NULL REFERENCES project_schedule(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  channels TEXT,
  recipients INT DEFAULT 0,
  sent_by UUID REFERENCES profiles(id),
  body TEXT);
CREATE INDEX IF NOT EXISTS idx_callsheets_day ON call_sheets(schedule_day_id, sent_at DESC);
ALTER TABLE call_sheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS call_sheets_read ON call_sheets;
CREATE POLICY call_sheets_read ON call_sheets FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer')
  OR public.is_project_member(project_id));
-- Writes happen via the service-role endpoint after a can_edit_schedule check.
