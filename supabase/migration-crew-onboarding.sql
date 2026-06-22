-- ─────────────────────────────────────────────
-- CREW ONBOARDING + CONSENT (Phase 2)
-- Sign → onboarding link → consent → profile → check-in. Captures explicit,
-- TIMESTAMPED consent (the privacy line: location/data only with consent).
--
-- Two tables:
--   crew_onboarding — one row per person's onboarding (status + token + profile).
--   crew_consents   — APPEND-ONLY consent log (one row per consent action). No
--                     UPDATE policy by design: consent records are immutable.
--
-- RLS mirrors production_reports (operational management). Founder deletes.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crew_onboarding (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_crew_id UUID REFERENCES project_crew(id) ON DELETE SET NULL, -- optional link to the formal crew row
  full_name TEXT NOT NULL,
  role TEXT,
  department TEXT,
  phone TEXT,
  email TEXT,
  emergency_contact TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN (
    'invited', 'link_sent', 'consent_given', 'profile_complete', 'checked_in', 'active', 'declined'
  )),
  token UUID NOT NULL DEFAULT uuid_generate_v4(),  -- onboarding-link token
  invited_at TIMESTAMPTZ,
  consent_at TIMESTAMPTZ,          -- when consent was completed
  checked_in_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crew_onboarding_token_key UNIQUE (token)
);
CREATE INDEX IF NOT EXISTS idx_crew_onboarding_project ON crew_onboarding(project_id, status);

-- Append-only consent log.
CREATE TABLE IF NOT EXISTS crew_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  onboarding_id UUID NOT NULL REFERENCES crew_onboarding(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE, -- denormalised for RLS/queries
  consent_type TEXT NOT NULL CHECK (consent_type IN ('location_tracking', 'data_usage', 'photo_media', 'terms')),
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method TEXT,                     -- how it was captured (pwa / in_person / phone)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crew_consents_onboarding ON crew_consents(onboarding_id);

DROP TRIGGER IF EXISTS set_updated_at_crew_onb ON crew_onboarding;
CREATE TRIGGER set_updated_at_crew_onb BEFORE UPDATE ON crew_onboarding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ──
ALTER TABLE crew_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE crew_consents   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crew_onb_read"   ON crew_onboarding;
DROP POLICY IF EXISTS "crew_onb_insert" ON crew_onboarding;
DROP POLICY IF EXISTS "crew_onb_update" ON crew_onboarding;
DROP POLICY IF EXISTS "crew_onb_delete" ON crew_onboarding;
CREATE POLICY "crew_onb_read"   ON crew_onboarding FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "crew_onb_insert" ON crew_onboarding FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "crew_onb_update" ON crew_onboarding FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "crew_onb_delete" ON crew_onboarding FOR DELETE TO authenticated USING (public.is_founder());

-- Consent log: read + insert for management, NO update (immutable), founder deletes.
DROP POLICY IF EXISTS "crew_consent_read"   ON crew_consents;
DROP POLICY IF EXISTS "crew_consent_insert" ON crew_consents;
DROP POLICY IF EXISTS "crew_consent_delete" ON crew_consents;
CREATE POLICY "crew_consent_read"   ON crew_consents FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "crew_consent_insert" ON crew_consents FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "crew_consent_delete" ON crew_consents FOR DELETE TO authenticated USING (public.is_founder());
