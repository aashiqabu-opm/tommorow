-- ═════════════════════════════════════════════════════════════
-- Phase tracker + box-office collections + online monitoring
--   • phase_tasks: per-project milestone checklist across 5 phases
--   • box_office_collections: day-wise theatrical numbers + AI estimates
--   • monitoring_findings: daily piracy / reputation scan results
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ═════════════════════════════════════════════════════════════

-- 1. Phase milestone checklist -------------------------------
CREATE TABLE IF NOT EXISTS phase_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,            -- development | production | post_production | distribution | release
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  done_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_phase_tasks_project ON phase_tasks(project_id, phase, sort_order);

-- 2. Box-office collections (day-wise) -----------------------
CREATE TABLE IF NOT EXISTS box_office_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  day_number INT,                          -- day 1, 2, 3 … of release
  collection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  india_net NUMERIC(15,2),                 -- ₹ India net
  worldwide_gross NUMERIC(15,2),           -- ₹ worldwide gross
  screens INT,
  occupancy NUMERIC(5,2),                  -- %
  source TEXT,                             -- where the number came from
  confirmed BOOLEAN NOT NULL DEFAULT TRUE, -- AI auto-fetched rows arrive unconfirmed
  notes TEXT,
  recorded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, collection_date)
);
CREATE INDEX IF NOT EXISTS idx_collections_project ON box_office_collections(project_id, collection_date);

-- 3. Online monitoring findings ------------------------------
CREATE TABLE IF NOT EXISTS monitoring_findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL,          -- piracy | reputation
  severity TEXT NOT NULL DEFAULT 'low',  -- high | medium | low
  title TEXT NOT NULL,
  detail TEXT,
  url TEXT,
  dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_findings_project ON monitoring_findings(project_id, scan_date DESC);

-- 4. RLS -----------------------------------------------------
ALTER TABLE phase_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_office_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_findings ENABLE ROW LEVEL SECURITY;

-- Phase tasks: project team + management read; management writes.
DROP POLICY IF EXISTS "phase_tasks_read" ON phase_tasks;
CREATE POLICY "phase_tasks_read" ON phase_tasks FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer')
  OR public.is_project_member(project_id)
);
DROP POLICY IF EXISTS "phase_tasks_write" ON phase_tasks;
CREATE POLICY "phase_tasks_write" ON phase_tasks FOR ALL TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer')
) WITH CHECK (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer')
);

-- Collections: team + management read; management writes.
DROP POLICY IF EXISTS "collections_read" ON box_office_collections;
CREATE POLICY "collections_read" ON box_office_collections FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer')
  OR public.is_project_member(project_id)
);
DROP POLICY IF EXISTS "collections_write" ON box_office_collections;
CREATE POLICY "collections_write" ON box_office_collections FOR ALL TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer')
) WITH CHECK (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer')
);

-- Findings: management reads/manages (sensitive). Service role (cron) bypasses RLS.
DROP POLICY IF EXISTS "findings_read" ON monitoring_findings;
CREATE POLICY "findings_read" ON monitoring_findings FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer')
);
DROP POLICY IF EXISTS "findings_write" ON monitoring_findings;
CREATE POLICY "findings_write" ON monitoring_findings FOR ALL TO authenticated USING (
  public.user_role() IN ('founder','general_manager','executive_producer')
) WITH CHECK (
  public.user_role() IN ('founder','general_manager','executive_producer')
);
