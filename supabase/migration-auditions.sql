-- ═══════════════════════════════════════════════════════════════════════
-- AUDITIONS backbone — public talent platform on the shared backbone.
-- First service built on the OPM Account wall (migration-opm-account.sql).
-- Talent = public OPM Accounts (no profiles row → walled from internal data).
-- This is the data layer only; the public frontend lives in the website repo.
-- Idempotent. See docs/OPM_ECOSYSTEM.md §6 (Auditions).
-- ═══════════════════════════════════════════════════════════════════════

-- ── Talent profile: one per public account, owner-scoped ──
CREATE TABLE IF NOT EXISTS talent_profiles (
  account_id  UUID PRIMARY KEY REFERENCES public_profiles(id) ON DELETE CASCADE,
  category    TEXT NOT NULL CHECK (category IN ('actor','model','voice_artist','musician','child')),
  stage_name  TEXT,
  bio         TEXT,
  languages   TEXT[] NOT NULL DEFAULT '{}',
  skills      TEXT[] NOT NULL DEFAULT '{}',
  location    TEXT,
  available   BOOLEAN NOT NULL DEFAULT TRUE,
  media       JSONB NOT NULL DEFAULT '[]',   -- photo/video storage refs
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Open calls: internal-created casting calls; talent can browse the open ones ──
CREATE TABLE IF NOT EXISTS open_calls (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  role_title   TEXT NOT NULL,
  category     TEXT,                          -- target talent category (NULL = any)
  description  TEXT,
  requirements TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closes_on    DATE,
  created_by   UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Submissions: a talent applies to an open call with a self-tape ──
CREATE TABLE IF NOT EXISTS audition_submissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id    UUID NOT NULL REFERENCES public_profiles(id) ON DELETE CASCADE,
  open_call_id  UUID NOT NULL REFERENCES open_calls(id) ON DELETE CASCADE,
  self_tape_ref TEXT,
  note          TEXT,
  status        TEXT NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted','shortlisted','rejected','selected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audition_sub_call ON audition_submissions(open_call_id);
CREATE INDEX IF NOT EXISTS idx_audition_sub_account ON audition_submissions(account_id);

-- ── Grants (RLS still gates rows) ──
GRANT SELECT, INSERT, UPDATE, DELETE ON talent_profiles, open_calls, audition_submissions TO authenticated;

-- ── RLS ──
ALTER TABLE talent_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE audition_submissions ENABLE ROW LEVEL SECURITY;

-- talent_profiles: owner (the public account) manages its own; internal staff read.
DROP POLICY IF EXISTS talent_profiles_owner ON talent_profiles;
CREATE POLICY talent_profiles_owner ON talent_profiles FOR ALL TO authenticated
  USING (account_id = auth.uid()) WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS talent_profiles_internal_read ON talent_profiles;
CREATE POLICY talent_profiles_internal_read ON talent_profiles FOR SELECT TO authenticated
  USING (public.is_internal_user());

-- open_calls: anyone signed in sees OPEN calls; internal staff manage + see all.
DROP POLICY IF EXISTS open_calls_read ON open_calls;
CREATE POLICY open_calls_read ON open_calls FOR SELECT TO authenticated
  USING (status = 'open' OR public.is_internal_user());
DROP POLICY IF EXISTS open_calls_manage ON open_calls;
CREATE POLICY open_calls_manage ON open_calls FOR ALL TO authenticated
  USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());

-- audition_submissions: owner reads + creates its own; status changes are
-- internal-only (owner has no UPDATE policy). Internal staff review all.
DROP POLICY IF EXISTS audition_submissions_owner_read ON audition_submissions;
CREATE POLICY audition_submissions_owner_read ON audition_submissions FOR SELECT TO authenticated
  USING (account_id = auth.uid());
DROP POLICY IF EXISTS audition_submissions_owner_insert ON audition_submissions;
CREATE POLICY audition_submissions_owner_insert ON audition_submissions FOR INSERT TO authenticated
  WITH CHECK (account_id = auth.uid());
DROP POLICY IF EXISTS audition_submissions_internal ON audition_submissions;
CREATE POLICY audition_submissions_internal ON audition_submissions FOR ALL TO authenticated
  USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
