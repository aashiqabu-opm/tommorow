-- ─────────────────────────────────────────────
-- MEDIA ASSET REGISTER — drives / cards / cloud / archive register
-- Phase 1, step 5. Footage lives on 240+ camera cards across 80 shoot days;
-- this is the register of every drive/card and where it is. Populated either
-- manually or by DIT CSV batch import (source = 'dit_import').
-- RLS mirrors production_reports (operational management; delete = founder).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL DEFAULT 'drive' CHECK (asset_type IN ('drive', 'card', 'cloud', 'archive')),
  label TEXT NOT NULL,                 -- drive name / card id
  capacity_tb NUMERIC(10, 2),
  used_tb NUMERIC(10, 2),
  contents TEXT,                       -- scene numbers / dates covered
  shoot_date DATE,
  location TEXT,                       -- physical shelf / cloud bucket
  copies INT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'missing', 'retired')),
  health_checked_date DATE,            -- last S.M.A.R.T / health check
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'dit_import')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_assets_project ON media_assets(project_id, status);

DROP TRIGGER IF EXISTS set_updated_at_media ON media_assets;
CREATE TRIGGER set_updated_at_media BEFORE UPDATE ON media_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "media_read"   ON media_assets;
DROP POLICY IF EXISTS "media_insert" ON media_assets;
DROP POLICY IF EXISTS "media_update" ON media_assets;
DROP POLICY IF EXISTS "media_delete" ON media_assets;
CREATE POLICY "media_read"   ON media_assets FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "media_insert" ON media_assets FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "media_update" ON media_assets FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "media_delete" ON media_assets FOR DELETE TO authenticated USING (public.is_founder());
