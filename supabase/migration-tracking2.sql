-- ═════════════════════════════════════════════════════════════
-- Campaign asset tracking (our films) + Malayalam industry briefs
--   • campaign_assets: teaser/trailer/poster/song/promo drops we track
--   • industry_briefs: weekly market digest of other Malayalam releases
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
  ai_summary TEXT,                 -- AI read on reception/performance
  ai_metrics JSONB,                -- {views, likes, sentiment, ...} best-effort
  last_checked TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaign_assets_project ON campaign_assets(project_id, released_on DESC);

-- 2. Weekly Malayalam industry brief -------------------------
CREATE TABLE IF NOT EXISTS industry_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_of DATE NOT NULL DEFAULT CURRENT_DATE,
  headline TEXT,
  summary TEXT,                    -- markdown-ish brief
  items JSONB,                     -- [{film, collection, trend, note, url}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(week_of)
);
CREATE INDEX IF NOT EXISTS idx_industry_briefs_week ON industry_briefs(week_of DESC);

-- 3. RLS -----------------------------------------------------
ALTER TABLE campaign_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_briefs ENABLE ROW LEVEL SECURITY;

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

-- Industry briefs: visible to staff + management (core team market info).
DROP POLICY IF EXISTS "industry_briefs_read" ON industry_briefs;
CREATE POLICY "industry_briefs_read" ON industry_briefs FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "industry_briefs_write" ON industry_briefs;
CREATE POLICY "industry_briefs_write" ON industry_briefs FOR ALL TO authenticated USING (
  public.is_founder()
) WITH CHECK (public.is_founder());
