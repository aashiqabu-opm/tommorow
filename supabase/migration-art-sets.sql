-- ─────────────────────────────────────────────
-- ART DEPT — SET CONSTRUCTION TRACKER (Phase 2)
-- Each set tracked through its build pipeline: design → materials_sourced →
-- under_construction → set_dressing → ready → struck. Dashboard reads % ready
-- vs days-to-shoot, so no set is unfinished on Day 1.
--
-- Readiness/construction tracker only — no money columns. Art-dept SPEND lives in
-- Procurement (purchase_orders/vendor_advances) and budget_lines (one-truth intact).
--
-- RLS mirrors production_reports (operational management; delete = founder).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS art_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  set_name TEXT NOT NULL,              -- e.g. "Ayyankali's village"
  build_location TEXT,                 -- studio floor / on-location
  status TEXT NOT NULL DEFAULT 'design' CHECK (status IN (
    'design', 'materials_sourced', 'under_construction', 'set_dressing', 'ready', 'struck'
  )),
  assigned_to TEXT,                    -- art director / construction contractor
  start_date DATE,
  deadline DATE,                       -- ready-by date (vs shoot Day 1)
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_art_sets_project ON art_sets(project_id, status);

DROP TRIGGER IF EXISTS set_updated_at_art_sets ON art_sets;
CREATE TRIGGER set_updated_at_art_sets BEFORE UPDATE ON art_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE art_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "art_sets_read"   ON art_sets;
DROP POLICY IF EXISTS "art_sets_insert" ON art_sets;
DROP POLICY IF EXISTS "art_sets_update" ON art_sets;
DROP POLICY IF EXISTS "art_sets_delete" ON art_sets;
CREATE POLICY "art_sets_read"   ON art_sets FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "art_sets_insert" ON art_sets FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "art_sets_update" ON art_sets FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "art_sets_delete" ON art_sets FOR DELETE TO authenticated USING (public.is_founder());
