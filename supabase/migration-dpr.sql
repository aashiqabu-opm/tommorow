-- ─────────────────────────────────────────────
-- DAILY PRODUCTION REPORT (DPR) — per project, per shoot day
-- Operational, so readable/editable by management (founder, accountant, GM, EP),
-- not finance-only. Run in the Supabase SQL editor.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS production_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  day_number INT,
  location TEXT,
  call_time TEXT,
  wrap_time TEXT,
  scenes_planned INT NOT NULL DEFAULT 0,
  scenes_completed INT NOT NULL DEFAULT 0,
  shots_completed INT,
  cast_present TEXT,
  crew_count INT,
  status TEXT NOT NULL DEFAULT 'on_schedule' CHECK (status IN ('on_schedule', 'ahead', 'behind')),
  weather TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_reports_project ON production_reports(project_id, report_date DESC);

DROP TRIGGER IF EXISTS set_updated_at_dpr ON production_reports;
CREATE TRIGGER set_updated_at_dpr BEFORE UPDATE ON production_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE production_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dpr_read"   ON production_reports;
DROP POLICY IF EXISTS "dpr_insert" ON production_reports;
DROP POLICY IF EXISTS "dpr_update" ON production_reports;
DROP POLICY IF EXISTS "dpr_delete" ON production_reports;
CREATE POLICY "dpr_read"   ON production_reports FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "dpr_insert" ON production_reports FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "dpr_update" ON production_reports FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "dpr_delete" ON production_reports FOR DELETE TO authenticated USING (public.is_founder());
