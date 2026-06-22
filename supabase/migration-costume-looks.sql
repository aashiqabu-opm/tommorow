-- ─────────────────────────────────────────────
-- COSTUME READINESS — per-look fabrication tracker (Phase 2)
-- The urgent Kaali pre-prod gap: 48 principal looks, each custom-fabricated,
-- must be ready before Day 1. Tracks each look through the 8-stage pipeline:
-- research → design → fabric_sourced → in_fabrication → fitting_scheduled →
-- fitting_done → alterations → ready. The dashboard reads % ready vs days-to-shoot.
--
-- This is a READINESS tracker, not a cost ledger — no money columns. Costume cost
-- lives in budget_lines (costume head) and rolls up from the payment pipeline like
-- every other actual. (Keeps the one-truth rule intact.)
--
-- RLS mirrors production_reports (operational management; delete = founder).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS costume_looks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  character TEXT,                      -- which character the look belongs to
  look_name TEXT NOT NULL,             -- e.g. "Ayyankali — court scene"
  look_number INT,                     -- optional ordering
  costume_type TEXT NOT NULL DEFAULT 'custom_fabrication'
    CHECK (costume_type IN ('custom_fabrication', 'purchase', 'rental')),
  status TEXT NOT NULL DEFAULT 'research' CHECK (status IN (
    'research', 'design', 'fabric_sourced', 'in_fabrication',
    'fitting_scheduled', 'fitting_done', 'alterations', 'ready'
  )),
  tailor_name TEXT,                    -- assigned tailor / fabricator
  fitting_date DATE,
  deadline DATE,                       -- ready-by date (vs shoot Day 1)
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_costume_looks_project ON costume_looks(project_id, status);

DROP TRIGGER IF EXISTS set_updated_at_costume ON costume_looks;
CREATE TRIGGER set_updated_at_costume BEFORE UPDATE ON costume_looks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE costume_looks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "costume_read"   ON costume_looks;
DROP POLICY IF EXISTS "costume_insert" ON costume_looks;
DROP POLICY IF EXISTS "costume_update" ON costume_looks;
DROP POLICY IF EXISTS "costume_delete" ON costume_looks;
CREATE POLICY "costume_read"   ON costume_looks FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "costume_insert" ON costume_looks FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "costume_update" ON costume_looks FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "costume_delete" ON costume_looks FOR DELETE TO authenticated USING (public.is_founder());
