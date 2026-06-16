-- ═══════════════════════════════════════════════════════════════════════
-- OFFICE — Wave D: past projects, project archival vault, and OPM Records
-- ═══════════════════════════════════════════════════════════════════════

-- 1. Alter projects table to track release metadata and liabilities
ALTER TABLE projects ADD COLUMN IF NOT EXISTS production_company TEXT DEFAULT 'OPM Cinemas Proprietorship';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS release_year INT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS has_liabilities BOOLEAN DEFAULT FALSE;

-- 2. Create project archival vault table
CREATE TABLE IF NOT EXISTS project_archival (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('censor_certificate', 'master_copy_log', 'poster', 'award', 'other')),
  title TEXT NOT NULL,
  file_path TEXT, -- path in supabase storage bucket
  file_name TEXT,
  notes TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parch_project ON project_archival(project_id, category);
ALTER TABLE project_archival ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_archival_read ON project_archival;
CREATE POLICY project_archival_read ON project_archival FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer')
  OR public.is_project_member(project_id)
);

DROP POLICY IF EXISTS project_archival_write ON project_archival;
CREATE POLICY project_archival_write ON project_archival FOR ALL TO authenticated USING (
  public.is_founder() OR public.user_role() IN ('general_manager','executive_producer')
  OR public.my_project_role(project_id) IN ('director','associate_director','chief_ad')
) WITH CHECK (
  public.is_founder() OR public.user_role() IN ('general_manager','executive_producer')
  OR public.my_project_role(project_id) IN ('director','associate_director','chief_ad')
);

-- 3. Create OPM Records Tables
CREATE TABLE IF NOT EXISTS opm_records_titles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  album_movie TEXT NOT NULL,
  release_date DATE,
  artists TEXT,
  isrc TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opm_records_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'spotify', 'apple_music', 'instagram', 'facebook', 'other')),
  handle TEXT,
  url TEXT NOT NULL,
  subscriber_count INT DEFAULT 0,
  views_count BIGINT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS opm_records_royalties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title_id UUID REFERENCES opm_records_titles(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('youtube', 'spotify', 'apple_music', 'distrokid', 'other')),
  period TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  streams_count INT,
  payout_status TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'received')),
  statement_file_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orec_royalties_title ON opm_records_royalties(title_id);

ALTER TABLE opm_records_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE opm_records_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE opm_records_royalties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opm_records_titles_all ON opm_records_titles;
CREATE POLICY opm_records_titles_all ON opm_records_titles FOR ALL TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager')
);

DROP POLICY IF EXISTS opm_records_channels_all ON opm_records_channels;
CREATE POLICY opm_records_channels_all ON opm_records_channels FOR ALL TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager')
);

DROP POLICY IF EXISTS opm_records_royalties_all ON opm_records_royalties;
CREATE POLICY opm_records_royalties_all ON opm_records_royalties FOR ALL TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager')
);

-- 4. Seed Past projects
INSERT INTO projects (name, slug, status, description, production_company, release_year, has_liabilities, created_by)
VALUES
  ('Rifle Club', 'rifle-club', 'released', 'Released in 2024. Has liabilities to settle.', 'OPM Cinemas Proprietorship', 2024, TRUE, COALESCE((SELECT id FROM profiles WHERE role = 'founder' LIMIT 1), (SELECT id FROM profiles LIMIT 1))),
  ('Neelavelicham', 'neelavelicham', 'released', 'Released in 2023. Has liabilities to settle.', 'OPM Cinemas Proprietorship', 2023, TRUE, COALESCE((SELECT id FROM profiles WHERE role = 'founder' LIMIT 1), (SELECT id FROM profiles LIMIT 1))),
  ('Bheemante Vazhi', 'bheemante-vazhi', 'released', 'Released in 2021.', 'OPM Cinemas Proprietorship', 2021, FALSE, COALESCE((SELECT id FROM profiles WHERE role = 'founder' LIMIT 1), (SELECT id FROM profiles LIMIT 1))),
  ('Virus', 'virus', 'released', 'Released in 2019.', 'OPM Cinemas Proprietorship', 2019, FALSE, COALESCE((SELECT id FROM profiles WHERE role = 'founder' LIMIT 1), (SELECT id FROM profiles LIMIT 1))),
  ('Halal Love Story', 'halal-love-story', 'released', 'Released in 2020.', 'OPM Cinemas Proprietorship', 2020, FALSE, COALESCE((SELECT id FROM profiles WHERE role = 'founder' LIMIT 1), (SELECT id FROM profiles LIMIT 1))),
  ('Ee.Ma.Yau', 'ee-ma-yau', 'released', 'Released in 2018.', 'OPM Cinemas Proprietorship', 2018, FALSE, COALESCE((SELECT id FROM profiles WHERE role = 'founder' LIMIT 1), (SELECT id FROM profiles LIMIT 1))),
  ('Lovely', 'lovely', 'released', 'Released past project.', 'OPM Cinemas Proprietorship', NULL, FALSE, COALESCE((SELECT id FROM profiles WHERE role = 'founder' LIMIT 1), (SELECT id FROM profiles LIMIT 1))),
  ('Gangster', 'gangster', 'released', 'Released in 2014.', 'OPM Dream Mill Cinemas PVT LTD', 2014, FALSE, COALESCE((SELECT id FROM profiles WHERE role = 'founder' LIMIT 1), (SELECT id FROM profiles LIMIT 1))),
  ('Maheshinte Prathikaaram', 'maheshinte-prathikaaram', 'released', 'Released in 2016.', 'OPM Dream Mill Cinemas PVT LTD', 2016, FALSE, COALESCE((SELECT id FROM profiles WHERE role = 'founder' LIMIT 1), (SELECT id FROM profiles LIMIT 1))),
  ('Mayaanadhi', 'mayaanadhi', 'released', 'Released in 2017.', 'OPM Dream Mill Cinemas PVT LTD', 2017, FALSE, COALESCE((SELECT id FROM profiles WHERE role = 'founder' LIMIT 1), (SELECT id FROM profiles LIMIT 1))),
  ('Aarkkariyam', 'aarkkariyam', 'released', 'Released in 2021.', 'OPM Dream Mill Cinemas PVT LTD', 2021, FALSE, COALESCE((SELECT id FROM profiles WHERE role = 'founder' LIMIT 1), (SELECT id FROM profiles LIMIT 1))),
  ('Naaradan', 'naaradan', 'released', 'Released in 2022.', 'OPM Dream Mill Cinemas PVT LTD', 2022, FALSE, COALESCE((SELECT id FROM profiles WHERE role = 'founder' LIMIT 1), (SELECT id FROM profiles LIMIT 1)))
ON CONFLICT (slug) DO UPDATE SET
  production_company = EXCLUDED.production_company,
  release_year = EXCLUDED.release_year,
  has_liabilities = EXCLUDED.has_liabilities,
  status = EXCLUDED.status;
