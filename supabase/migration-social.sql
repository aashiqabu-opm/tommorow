-- ═══════════════════════════════════════════════════════════════════════
-- Social module — company social accounts + a content planner/calendar.
-- Plan, draft, schedule and track posts across OPM's channels. Auto-publish
-- to Meta/YouTube plugs in later via external_ref. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL DEFAULT 'instagram'
    CHECK (platform IN ('instagram','facebook','youtube','x','threads','linkedin','other')),
  name TEXT NOT NULL,
  handle TEXT,
  url TEXT,
  entity TEXT DEFAULT 'OPM Cinemas Proprietorship',  -- which company/brand it belongs to
  followers INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  caption TEXT,
  account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  platform TEXT,                       -- denormalised for quick filtering
  post_type TEXT NOT NULL DEFAULT 'post'
    CHECK (post_type IN ('post','reel','story','short','video','carousel','tweet')),
  status TEXT NOT NULL DEFAULT 'idea'
    CHECK (status IN ('idea','draft','scheduled','published','archived')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  link TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,  -- optional film tie-in
  asset_path TEXT,
  external_ref TEXT,                   -- platform post id once published via API
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status, scheduled_at);

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_accounts_read ON social_accounts;
CREATE POLICY social_accounts_read ON social_accounts FOR SELECT TO authenticated
  USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer','staff'));
DROP POLICY IF EXISTS social_accounts_write ON social_accounts;
CREATE POLICY social_accounts_write ON social_accounts FOR ALL TO authenticated
  USING (public.user_role() IN ('founder','general_manager','executive_producer'))
  WITH CHECK (public.user_role() IN ('founder','general_manager','executive_producer'));

DROP POLICY IF EXISTS social_posts_read ON social_posts;
CREATE POLICY social_posts_read ON social_posts FOR SELECT TO authenticated
  USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer','staff'));
DROP POLICY IF EXISTS social_posts_write ON social_posts;
CREATE POLICY social_posts_write ON social_posts FOR ALL TO authenticated
  USING (public.user_role() IN ('founder','general_manager','executive_producer','staff'))
  WITH CHECK (public.user_role() IN ('founder','general_manager','executive_producer','staff'));

DROP TRIGGER IF EXISTS set_updated_at_social_posts ON social_posts;
CREATE TRIGGER set_updated_at_social_posts BEFORE UPDATE ON social_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
