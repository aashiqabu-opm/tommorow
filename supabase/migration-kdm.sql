-- ─────────────────────────────────────────────
-- KDM MANAGEMENT — theatre-wise DCP + Key Delivery Message tracking
-- Phase 1, step 4. Release-critical: a wrong/expired KDM = theatre goes dark.
-- Tracks DCP delivery + KDM issue + validity window per theatre, so the release
-- desk can see what's live, what's expiring, and what needs re-issue.
-- RLS mirrors production_reports (operational management; delete = founder).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kdm (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  theatre_name TEXT NOT NULL,
  theatre_location TEXT,
  territory TEXT,
  dcp_delivered BOOLEAN NOT NULL DEFAULT FALSE,
  dcp_delivered_date DATE,
  kdm_issued BOOLEAN NOT NULL DEFAULT FALSE,
  kdm_issued_date DATE,
  valid_from DATE,
  valid_to DATE,                       -- expiry window — drives the alert cron
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'dcp_delivered', 'active', 'expiring', 'expired', 'reissue_needed'
  )),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kdm_project ON kdm(project_id);
CREATE INDEX IF NOT EXISTS idx_kdm_valid_to ON kdm(valid_to);

DROP TRIGGER IF EXISTS set_updated_at_kdm ON kdm;
CREATE TRIGGER set_updated_at_kdm BEFORE UPDATE ON kdm
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE kdm ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kdm_read"   ON kdm;
DROP POLICY IF EXISTS "kdm_insert" ON kdm;
DROP POLICY IF EXISTS "kdm_update" ON kdm;
DROP POLICY IF EXISTS "kdm_delete" ON kdm;
CREATE POLICY "kdm_read"   ON kdm FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "kdm_insert" ON kdm FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "kdm_update" ON kdm FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "kdm_delete" ON kdm FOR DELETE TO authenticated USING (public.is_founder());
