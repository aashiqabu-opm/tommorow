-- ═══════════════════════════════════════════════════════════════════════
-- OPM OFFICE — CONSOLIDATED SETUP (2026-06)
-- Run top-to-bottom in the Supabase SQL editor. Order matters (helpers first).
-- Idempotent: safe to re-run. Assumes the base schema + rls.sql are already in
-- place (projects, profiles, payment_requests, project_income, cash_entries,
-- bank_accounts, vendors, budget_lines, and the helper fns is_finance(),
-- is_founder(), user_role(), plus uuid_generate_v4()).
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────── 1. PER-PROJECT TEAMS, CHECK-INS, STAFF ROLE ─────────────
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('founder','accountant','general_manager','executive_producer','legal_viewer','staff'));

ALTER TABLE project_members ALTER COLUMN project_role SET DEFAULT 'member';
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES profiles(id);
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS title TEXT;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM project_members WHERE project_id = p_project AND user_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.my_project_role(p_project UUID)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT project_role FROM project_members WHERE project_id = p_project AND user_id = auth.uid() LIMIT 1;
$$;

CREATE TABLE IF NOT EXISTS project_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary TEXT NOT NULL, blockers TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_checkins_project ON project_checkins(project_id, checkin_date DESC);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_members_read" ON project_members;
CREATE POLICY "project_members_read" ON project_members FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer') OR public.is_project_member(project_id));
DROP POLICY IF EXISTS "project_members_write" ON project_members;
CREATE POLICY "project_members_write" ON project_members FOR ALL TO authenticated
  USING (public.user_role() IN ('founder','general_manager','executive_producer'))
  WITH CHECK (public.user_role() IN ('founder','general_manager','executive_producer'));
DROP POLICY IF EXISTS "checkins_read" ON project_checkins;
CREATE POLICY "checkins_read" ON project_checkins FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer') OR public.is_project_member(project_id));
DROP POLICY IF EXISTS "checkins_insert" ON project_checkins;
CREATE POLICY "checkins_insert" ON project_checkins FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND (public.user_role() IN ('founder','accountant','general_manager','executive_producer') OR public.is_project_member(project_id)));
DROP POLICY IF EXISTS "checkins_delete" ON project_checkins;
CREATE POLICY "checkins_delete" ON project_checkins FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_founder());
DROP POLICY IF EXISTS "projects_read_all" ON projects;
DROP POLICY IF EXISTS "projects_read_members" ON projects;
CREATE POLICY "projects_read_members" ON projects FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer') OR public.is_project_member(id));

-- ───────────── 2. AI PROJECT STAGES + RELEASE DATE ─────────────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_status_reason TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_status_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS release_date DATE;
UPDATE projects SET status='post_production', ai_status_reason='Shoot wrapped — moved to post-production.', ai_status_at=NOW(), updated_at=NOW()
WHERE name ILIKE '%aja sundari%' AND status NOT IN ('released','cancelled');

-- ───────────── 3. PHASE TRACKER, COLLECTIONS, MONITORING ─────────────
CREATE TABLE IF NOT EXISTS phase_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase TEXT NOT NULL, title TEXT NOT NULL, done BOOLEAN NOT NULL DEFAULT FALSE, done_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0, created_by UUID REFERENCES profiles(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_phase_tasks_project ON phase_tasks(project_id, phase, sort_order);
CREATE TABLE IF NOT EXISTS box_office_collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  day_number INT, collection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  india_net NUMERIC(15,2), worldwide_gross NUMERIC(15,2), screens INT, occupancy NUMERIC(5,2),
  source TEXT, confirmed BOOLEAN NOT NULL DEFAULT TRUE, notes TEXT, recorded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(project_id, collection_date));
CREATE INDEX IF NOT EXISTS idx_collections_project ON box_office_collections(project_id, collection_date);
CREATE TABLE IF NOT EXISTS monitoring_findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scan_date DATE NOT NULL DEFAULT CURRENT_DATE, category TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'low',
  title TEXT NOT NULL, detail TEXT, url TEXT, dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_findings_project ON monitoring_findings(project_id, scan_date DESC);
ALTER TABLE phase_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_office_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "phase_tasks_read" ON phase_tasks;
CREATE POLICY "phase_tasks_read" ON phase_tasks FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer') OR public.is_project_member(project_id));
DROP POLICY IF EXISTS "phase_tasks_write" ON phase_tasks;
CREATE POLICY "phase_tasks_write" ON phase_tasks FOR ALL TO authenticated
  USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer'))
  WITH CHECK (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
DROP POLICY IF EXISTS "collections_read" ON box_office_collections;
CREATE POLICY "collections_read" ON box_office_collections FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer') OR public.is_project_member(project_id));
DROP POLICY IF EXISTS "collections_write" ON box_office_collections;
CREATE POLICY "collections_write" ON box_office_collections FOR ALL TO authenticated
  USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer'))
  WITH CHECK (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
DROP POLICY IF EXISTS "findings_read" ON monitoring_findings;
CREATE POLICY "findings_read" ON monitoring_findings FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
DROP POLICY IF EXISTS "findings_write" ON monitoring_findings;
CREATE POLICY "findings_write" ON monitoring_findings FOR ALL TO authenticated
  USING (public.user_role() IN ('founder','general_manager','executive_producer'))
  WITH CHECK (public.user_role() IN ('founder','general_manager','executive_producer'));

-- ───────────── 4. CAMPAIGN ASSETS + MALAYALAM RELEASE TRACKER ─────────────
CREATE TABLE IF NOT EXISTS campaign_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL, title TEXT NOT NULL, url TEXT, released_on DATE,
  ai_summary TEXT, ai_metrics JSONB, last_checked TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_campaign_assets_project ON campaign_assets(project_id, released_on DESC);
CREATE TABLE IF NOT EXISTS industry_films (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL, release_date DATE, days JSONB NOT NULL DEFAULT '[]',
  ai_note TEXT, total_india NUMERIC(15,2), last_checked TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(title, release_date));
CREATE INDEX IF NOT EXISTS idx_industry_films_release ON industry_films(release_date DESC);
ALTER TABLE campaign_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_films ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaign_assets_read" ON campaign_assets;
CREATE POLICY "campaign_assets_read" ON campaign_assets FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer','legal_viewer') OR public.is_project_member(project_id));
DROP POLICY IF EXISTS "campaign_assets_write" ON campaign_assets;
CREATE POLICY "campaign_assets_write" ON campaign_assets FOR ALL TO authenticated
  USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer'))
  WITH CHECK (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
DROP POLICY IF EXISTS "industry_films_read" ON industry_films;
CREATE POLICY "industry_films_read" ON industry_films FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "industry_films_write" ON industry_films;
CREATE POLICY "industry_films_write" ON industry_films FOR ALL TO authenticated
  USING (public.user_role() IN ('founder','general_manager','executive_producer'))
  WITH CHECK (public.user_role() IN ('founder','general_manager','executive_producer'));

-- ───────────── 5. SYSTEM STATUS (AI health banner) ─────────────
CREATE TABLE IF NOT EXISTS system_status (
  key TEXT PRIMARY KEY, message TEXT, detail TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_status_read" ON system_status;
CREATE POLICY "system_status_read" ON system_status FOR SELECT TO authenticated USING (TRUE);

-- ───────────── 6. TALLY LEDGERS & VOUCHERS (+ source link) ─────────────
CREATE TABLE IF NOT EXISTS ledgers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, parent TEXT NOT NULL DEFAULT 'Suspense A/c',
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0, created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_type TEXT NOT NULL, voucher_date DATE NOT NULL DEFAULT CURRENT_DATE,
  voucher_number TEXT, narration TEXT, created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS source_id UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_vouchers_source ON vouchers(source_type, source_id) WHERE source_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(voucher_date DESC);
CREATE TABLE IF NOT EXISTS voucher_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  ledger_name TEXT NOT NULL, dr BOOLEAN NOT NULL, amount NUMERIC(15,2) NOT NULL, sort_order INT NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_voucher_entries_voucher ON voucher_entries(voucher_id);
ALTER TABLE ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ledgers_all_finance" ON ledgers;
CREATE POLICY "ledgers_all_finance" ON ledgers FOR ALL TO authenticated USING (public.is_finance()) WITH CHECK (public.is_finance());
DROP POLICY IF EXISTS "vouchers_all_finance" ON vouchers;
CREATE POLICY "vouchers_all_finance" ON vouchers FOR ALL TO authenticated USING (public.is_finance()) WITH CHECK (public.is_finance());
DROP POLICY IF EXISTS "voucher_entries_all_finance" ON voucher_entries;
CREATE POLICY "voucher_entries_all_finance" ON voucher_entries FOR ALL TO authenticated USING (public.is_finance()) WITH CHECK (public.is_finance());
INSERT INTO ledgers (name, parent) VALUES
  ('Cash','Cash-in-Hand'),('Input CGST','Duties & Taxes'),('Input SGST','Duties & Taxes'),
  ('Input IGST','Duties & Taxes'),('Output CGST','Duties & Taxes'),('Output SGST','Duties & Taxes'),
  ('Output IGST','Duties & Taxes'),('TDS Payable','Duties & Taxes'),('Round Off','Indirect Expenses'),
  ('Production Expenses','Direct Expenses'),('Salary & Wages','Indirect Expenses'),('Rent','Indirect Expenses')
ON CONFLICT (name) DO NOTHING;

-- ───────────── 7. BANK RECONCILIATION ─────────────
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL,
  txn_date DATE NOT NULL, description TEXT, reference TEXT,
  amount NUMERIC(15,2) NOT NULL, matched_type TEXT, matched_id UUID,
  created_by UUID REFERENCES profiles(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_bank_txn_account ON bank_transactions(account_id, txn_date DESC);
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bank_txn_all_finance" ON bank_transactions;
CREATE POLICY "bank_txn_all_finance" ON bank_transactions FOR ALL TO authenticated USING (public.is_finance()) WITH CHECK (public.is_finance());

-- ───────────── 8. HARDENING: SETTINGS, PERIOD LOCK, AI USAGE (LAST) ─────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_read" ON app_settings;
CREATE POLICY "app_settings_read" ON app_settings FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "app_settings_write" ON app_settings;
CREATE POLICY "app_settings_write" ON app_settings FOR ALL TO authenticated USING (public.is_founder()) WITH CHECK (public.is_founder());

CREATE OR REPLACE FUNCTION public.locked_through()
RETURNS DATE LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT NULLIF((SELECT value FROM app_settings WHERE key = 'books_locked_through'), '')::date;
$$;
CREATE OR REPLACE FUNCTION public.enforce_period_lock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lt DATE; d DATE; col TEXT := TG_ARGV[0];
BEGIN
  lt := public.locked_through();
  IF lt IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF TG_OP = 'DELETE' THEN d := (row_to_json(OLD) ->> col)::date;
  ELSE d := (row_to_json(NEW) ->> col)::date; END IF;
  IF d IS NOT NULL AND d <= lt THEN
    RAISE EXCEPTION 'Books are locked through %. This entry falls in a closed period — unlock it in Settings to change it.', to_char(lt, 'DD-Mon-YYYY');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DO $$ BEGIN
  IF to_regclass('public.project_income') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS lock_project_income ON project_income;
    CREATE TRIGGER lock_project_income BEFORE INSERT OR UPDATE OR DELETE ON project_income FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock('income_date');
  END IF;
  IF to_regclass('public.cash_entries') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS lock_cash_entries ON cash_entries;
    CREATE TRIGGER lock_cash_entries BEFORE INSERT OR UPDATE OR DELETE ON cash_entries FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock('entry_date');
  END IF;
  IF to_regclass('public.vouchers') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS lock_vouchers ON vouchers;
    CREATE TRIGGER lock_vouchers BEFORE INSERT OR UPDATE OR DELETE ON vouchers FOR EACH ROW EXECUTE FUNCTION public.enforce_period_lock('voucher_date');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), feature TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at);
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_usage_read" ON ai_usage;
CREATE POLICY "ai_usage_read" ON ai_usage FOR SELECT TO authenticated USING (public.is_finance());

-- ───────────── 9. DEFAULT PROJECT MEMBERS (Abid EP, Madan GM) ─────────────
CREATE OR REPLACE FUNCTION public.add_default_project_members()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT id, email FROM profiles WHERE lower(email) IN ('abid@opmcinemas.com','madan@opmcinemas.com') LOOP
    INSERT INTO project_members (project_id, user_id, project_role)
    VALUES (NEW.id, p.id,
      CASE WHEN lower(p.email) = 'abid@opmcinemas.com' THEN 'executive_producer' ELSE 'general_manager' END)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_default_project_members ON projects;
CREATE TRIGGER trg_default_project_members AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION public.add_default_project_members();
INSERT INTO project_members (project_id, user_id, project_role)
SELECT pr.id, pf.id,
  CASE WHEN lower(pf.email) = 'abid@opmcinemas.com' THEN 'executive_producer' ELSE 'general_manager' END
FROM projects pr CROSS JOIN profiles pf
WHERE lower(pf.email) IN ('abid@opmcinemas.com','madan@opmcinemas.com')
ON CONFLICT (project_id, user_id) DO NOTHING;

-- ───────────── 10. CREW TEAMS — contact-based members, groups, channel ─────────────
-- Supersedes migration-crew-contacts.sql. Contact-only members (name/email/
-- mobile) grouped into Pre/Production/Post; invited crew match by email; per-
-- project channel.
ALTER TABLE project_members ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS member_name TEXT;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS member_email TEXT;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS member_phone TEXT;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS team_group TEXT NOT NULL DEFAULT 'production';
  -- team_group: 'pre_production' | 'production' | 'post_production'

-- Project access also matches the logged-in user's EMAIL (invited crew get
-- access on first sign-in, no user_id backfill needed).
CREATE OR REPLACE FUNCTION public.is_project_member(p_project UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project
      AND (user_id = auth.uid() OR lower(member_email) = lower(auth.email()))
  );
$$;

CREATE TABLE IF NOT EXISTS project_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_project_messages ON project_messages(project_id, created_at);
ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "project_messages_read" ON project_messages;
CREATE POLICY "project_messages_read" ON project_messages FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder','accountant','general_manager','executive_producer') OR public.is_project_member(project_id));
DROP POLICY IF EXISTS "project_messages_insert" ON project_messages;
CREATE POLICY "project_messages_insert" ON project_messages FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND (public.user_role() IN ('founder','accountant','general_manager','executive_producer') OR public.is_project_member(project_id)));
DROP POLICY IF EXISTS "project_messages_delete" ON project_messages;
CREATE POLICY "project_messages_delete" ON project_messages FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_founder());

-- ───────────── 11. Abid display name ─────────────
UPDATE profiles SET full_name = 'Abid Abu' WHERE lower(email) = 'abid@opmcinemas.com';

-- ═══════════════════════════════════════════════════════════════════════
-- Done. Expect "Success. No rows returned."
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────── 12. ERROR MONITORING LOG (lib/monitoring.ts) ─────────────
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  context TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "error_logs_read" ON error_logs;
CREATE POLICY "error_logs_read" ON error_logs FOR SELECT TO authenticated USING (public.is_founder());

-- ───────────── 13. WHATSAPP INBOUND RATE LIMIT (lib/rate-limit.ts) ─────────────
CREATE TABLE IF NOT EXISTS wa_rate_limit (
  phone TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE wa_rate_limit ENABLE ROW LEVEL SECURITY;

-- ───────────── 14. PERSONAL / FOUNDER MODULE (Phase 1) ─────────────
-- See migration-personal.sql for the full block (tables, can_view_personal(),
-- owner-only RLS, private storage bucket). Run that file as part of setup.

-- ───────────── 15. PERSONAL MODULE PHASE 2 (tax/film/legal) ─────────────
-- See migration-personal-2.sql (tax_profile, tax_items, deductions,
-- capital_gains, film_stakes, royalties, documents; owner-only RLS). Run it.

-- ───────────── 16. PERSONAL MODULE PHASE 3 TRACKERS ─────────────
-- See migration-personal-3.sql (recurring, vehicles, health_policies, cards,
-- transactions; owner-only RLS). Run it.

-- ───────────── 17. PERSONAL txn ingestion/reconciliation cols ─────────────
-- See migration-personal-4.sql (origin, dup_of, reconciled + fingerprint idx).

-- ───────────── 18. PERSONAL GST capture + snapshots + company gst_inputs ─────────────
-- See migration-personal-5.sql.
