-- ═══════════════════════════════════════════════════════════════════════
-- OPM Records — Release pipeline. Turns the label into an end-to-end release
-- operation: each release moves draft → metadata → assets → QC → scheduled →
-- live, with a readiness checklist and the distributor hand-off tracked.
-- API hooks (Believe etc.) plug in later via distributor_ref. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS opm_records_releases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  release_type TEXT NOT NULL DEFAULT 'single'
    CHECK (release_type IN ('single','ep','album','compilation')),
  primary_artist TEXT,
  label TEXT DEFAULT 'OPM Records',
  upc TEXT,
  release_date DATE,
  distributor TEXT DEFAULT 'Believe',
  territory TEXT DEFAULT 'Worldwide',
  stage TEXT NOT NULL DEFAULT 'draft'
    CHECK (stage IN ('draft','metadata','assets','qc','scheduled','submitted','live','takedown')),
  -- readiness checklist
  art_ready BOOLEAN NOT NULL DEFAULT FALSE,
  audio_ready BOOLEAN NOT NULL DEFAULT FALSE,
  metadata_ready BOOLEAN NOT NULL DEFAULT FALSE,
  lyrics_ready BOOLEAN NOT NULL DEFAULT FALSE,
  rights_cleared BOOLEAN NOT NULL DEFAULT FALSE,
  cover_art_path TEXT,
  distributor_ref TEXT,            -- external release id once submitted (Believe etc.)
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orec_releases_stage ON opm_records_releases(stage, release_date);

-- Link tracks to their release
ALTER TABLE opm_records_titles ADD COLUMN IF NOT EXISTS release_id UUID REFERENCES opm_records_releases(id) ON DELETE SET NULL;

ALTER TABLE opm_records_releases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS opm_records_releases_all ON opm_records_releases;
CREATE POLICY opm_records_releases_all ON opm_records_releases FOR ALL TO authenticated
  USING (public.user_role() IN ('founder','accountant','general_manager'))
  WITH CHECK (public.user_role() IN ('founder','accountant','general_manager'));

DROP TRIGGER IF EXISTS set_updated_at_orec_releases ON opm_records_releases;
CREATE TRIGGER set_updated_at_orec_releases BEFORE UPDATE ON opm_records_releases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
