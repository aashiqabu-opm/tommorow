-- ─────────────────────────────────────────────
-- VFX SHOTS — production→post bridge (Phase 4)
-- ONE continuous record per shot: on-set reference capture → data handover → post
-- pipeline (in progress → first pass → revisions → approved). Carries the on-set
-- reference checklist so production hands clean data to the VFX house.
--
-- No money columns here — per-shot VFX COST/revisions billing is Phase 5; VFX spend
-- flows through the budget/payment pipeline (one-truth intact). revisions is a count.
--
-- RLS mirrors production_reports (operational management; delete = founder).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vfx_shots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shot_code TEXT NOT NULL,             -- e.g. VFX_001
  scene TEXT,
  description TEXT,
  vendor TEXT,                         -- VFX house
  complexity TEXT NOT NULL DEFAULT 'medium' CHECK (complexity IN ('low', 'medium', 'high')),
  shoot_date DATE,
  -- continuous pipeline across production + post
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned', 'reference_captured', 'data_handover', 'in_progress', 'first_pass', 'revision', 'approved', 'rejected'
  )),
  revisions INT NOT NULL DEFAULT 0,
  -- on-set reference checklist (production side)
  ref_hdri BOOLEAN NOT NULL DEFAULT FALSE,
  ref_clean_plate BOOLEAN NOT NULL DEFAULT FALSE,
  ref_chrome_grey_ball BOOLEAN NOT NULL DEFAULT FALSE,
  ref_tracking_markers BOOLEAN NOT NULL DEFAULT FALSE,
  ref_set_measurements BOOLEAN NOT NULL DEFAULT FALSE,
  ref_witness_camera BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vfx_shots_project ON vfx_shots(project_id, status);

DROP TRIGGER IF EXISTS set_updated_at_vfx ON vfx_shots;
CREATE TRIGGER set_updated_at_vfx BEFORE UPDATE ON vfx_shots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE vfx_shots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vfx_read"   ON vfx_shots;
DROP POLICY IF EXISTS "vfx_insert" ON vfx_shots;
DROP POLICY IF EXISTS "vfx_update" ON vfx_shots;
DROP POLICY IF EXISTS "vfx_delete" ON vfx_shots;
CREATE POLICY "vfx_read"   ON vfx_shots FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "vfx_insert" ON vfx_shots FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "vfx_update" ON vfx_shots FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "vfx_delete" ON vfx_shots FOR DELETE TO authenticated USING (public.is_founder());
