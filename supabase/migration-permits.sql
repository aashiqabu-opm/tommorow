-- ─────────────────────────────────────────────
-- PERMIT APPLICATION TRACKER (Phase 2)
-- Long-lead, blocking pre-prod item: KSFDC / Forest / Police (Sec 144) / Fire /
-- AWBI (animals) / Traffic / Municipal / Heritage / DGCA (drone) / Railway.
-- Tracks applied → approved with validity windows. `is_legal_gate` flags permits
-- that BLOCK a shoot when missing (AWBI especially) — sets up the Phase 4 gate.
--
-- RLS mirrors production_reports (operational management; delete = founder).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS permits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  permit_type TEXT NOT NULL DEFAULT 'other' CHECK (permit_type IN (
    'ksfdc', 'forest', 'police', 'fire', 'awbi', 'traffic',
    'municipal', 'heritage', 'dgca_drone', 'railway', 'other'
  )),
  authority TEXT,                      -- issuing authority / office
  description TEXT,                    -- what it covers (location, scene, purpose)
  status TEXT NOT NULL DEFAULT 'not_applied' CHECK (status IN (
    'not_applied', 'applied', 'pending', 'approved', 'rejected', 'expired'
  )),
  reference_no TEXT,                   -- application / permit number
  applied_date DATE,
  approved_date DATE,
  valid_from DATE,
  valid_to DATE,                       -- expiry window
  is_legal_gate BOOLEAN NOT NULL DEFAULT FALSE,  -- blocks the shoot when missing
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_permits_project ON permits(project_id, status);
CREATE INDEX IF NOT EXISTS idx_permits_valid_to ON permits(valid_to);

DROP TRIGGER IF EXISTS set_updated_at_permits ON permits;
CREATE TRIGGER set_updated_at_permits BEFORE UPDATE ON permits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE permits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "permits_read"   ON permits;
DROP POLICY IF EXISTS "permits_insert" ON permits;
DROP POLICY IF EXISTS "permits_update" ON permits;
DROP POLICY IF EXISTS "permits_delete" ON permits;
CREATE POLICY "permits_read"   ON permits FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "permits_insert" ON permits FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "permits_update" ON permits FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "permits_delete" ON permits FOR DELETE TO authenticated USING (public.is_founder());
