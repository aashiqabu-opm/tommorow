-- ─────────────────────────────────────────────
-- ATTENDANCE + GEOFENCES (Phase 3)
-- Crew attendance with geofence + QR + manual methods. Location capture is
-- CONSENT-GATED: each log records consent_ok (was location_tracking consent on
-- record for that person at capture time). Manual time-cards don't need GPS.
--
-- geofences      — named work zones (lat/lng + radius) for auto check-in.
-- attendance_logs — per person per day: check-in/out, method, optional captured
--                   point, consent flag. Links to crew_onboarding (the person).
--
-- RLS mirrors production_reports (operational management; delete = founder).
-- Personal location data — kept management-only.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS geofences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  radius_m INT NOT NULL DEFAULT 200,   -- geofence radius in metres
  active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_geofences_project ON geofences(project_id);

CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  onboarding_id UUID REFERENCES crew_onboarding(id) ON DELETE SET NULL, -- the person
  crew_name TEXT,                      -- denormalised label (manual entries / display)
  geofence_id UUID REFERENCES geofences(id) ON DELETE SET NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  method TEXT NOT NULL DEFAULT 'manual' CHECK (method IN ('geofence', 'qr', 'manual')),
  consent_ok BOOLEAN NOT NULL DEFAULT FALSE,  -- location consent on record at capture
  latitude NUMERIC(9, 6),              -- captured point (consented GPS only)
  longitude NUMERIC(9, 6),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_project ON attendance_logs(project_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_person ON attendance_logs(onboarding_id);

DROP TRIGGER IF EXISTS set_updated_at_geofences ON geofences;
CREATE TRIGGER set_updated_at_geofences BEFORE UPDATE ON geofences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE geofences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "geofence_read"   ON geofences;
DROP POLICY IF EXISTS "geofence_insert" ON geofences;
DROP POLICY IF EXISTS "geofence_update" ON geofences;
DROP POLICY IF EXISTS "geofence_delete" ON geofences;
CREATE POLICY "geofence_read"   ON geofences FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "geofence_insert" ON geofences FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "geofence_update" ON geofences FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "geofence_delete" ON geofences FOR DELETE TO authenticated USING (public.is_founder());

DROP POLICY IF EXISTS "attendance_read"   ON attendance_logs;
DROP POLICY IF EXISTS "attendance_insert" ON attendance_logs;
DROP POLICY IF EXISTS "attendance_update" ON attendance_logs;
DROP POLICY IF EXISTS "attendance_delete" ON attendance_logs;
CREATE POLICY "attendance_read"   ON attendance_logs FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "attendance_insert" ON attendance_logs FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "attendance_update" ON attendance_logs FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "attendance_delete" ON attendance_logs FOR DELETE TO authenticated USING (public.is_founder());
