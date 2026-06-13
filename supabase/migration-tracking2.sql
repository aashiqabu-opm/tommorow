-- ═════════════════════════════════════════════════════════════
-- Campaign asset tracking (our films) + Malayalam release tracker
--   • campaign_assets: teaser/trailer/poster/song/promo drops we track
--   • industry_films: every new Malayalam release, tracked day 1–7 daily
-- Run once in Supabase SQL Editor. Safe to re-run.
-- Needs migration-project-team.sql (is_project_member) + release_date col.
-- ═════════════════════════════════════════════════════════════

-- 1. Campaign assets we publish and track ---------------------
CREATE TABLE IF NOT EXISTS campaign_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,        -- teaser | trailer | first_look | poster | song | promo | other
  title TEXT NOT NULL,
  url TEXT,
  released_on DATE,
  ai_summary TEXT,
  ai_metrics JSONB,
  last_checked TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_project ON campaign_assets(project_id, released_on DESC);

-- 2. Other Malayalam releases — tracked day 1–7 ---------------
CREATE TABLE IF NOT EXISTS industry_films (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  release_date DATE,
  days JSONB NOT NULL DEFAULT '[]',   -- [{day, date, india_net, worldwide, source}]
  ai_note TEXT,                       -- short trend read
  total_india NUMERIC(15,2),          -- cumulative India net (₹)
  last_checked TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(title, release_date)
);
CREATE INDEX IF NOT EXISTS idx_industry_films_release ON industry_films(release_date DESC);

-- 3. RLS -----------------------------------------------------
ALTER TABLE campaign_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_films ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaign_assets_read" ON campaign_assets;
CREATE POLICY "campaign_assets_read" ON campaign_assets FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer')
  OR public.is_project_member(project_id)
);
DROP POLICY IF EXISTS "campaign_assets_write" ON campaign_assets;
CREATE POLICY "campaign_assets_write" ON campaign_assets FOR ALL TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer')
) WITH CHECK (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer')
);

-- Industry films: visible to all signed-in users (core team market info).
DROP POLICY IF EXISTS "industry_films_read" ON industry_films;
CREATE POLICY "industry_films_read" ON industry_films FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "industry_films_write" ON industry_films;
CREATE POLICY "industry_films_write" ON industry_films FOR ALL TO authenticated USING (
  public.user_role() IN ('founder','general_manager','executive_producer')
) WITH CHECK (
  public.user_role() IN ('founder','general_manager','executive_producer')
);
