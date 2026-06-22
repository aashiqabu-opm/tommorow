-- ─────────────────────────────────────────────
-- SPECIAL SEQUENCES — SAFETY & LEGAL GATES (Phase 4)
-- These are not just trackers — they are GATES that block a shoot day.
--
-- stunt_sequences — ACTION gate: a stunt day is BLOCKED unless ALL of:
--   medical_standby, safety_equipment_ok, risk_assessment_signed, insurance_rider_active.
-- animal_usage    — ANIMAL legal gate (mandatory in India): BLOCKED unless
--   awbi_permission AND vet_standby AND (welfare officer present if required).
--
-- The gate state is DERIVED from these booleans (computed in the app), so it can
-- never silently drift. status is the workflow state (planned/completed/cancelled).
-- No money columns — sequence SPEND flows through the budget/payment pipeline.
--
-- RLS mirrors production_reports (operational management; delete = founder).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stunt_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scenes TEXT,                         -- which scenes / shoot days
  shoot_date DATE,
  coordinator TEXT,                    -- stunt coordinator
  performers_count INT,
  risk_level TEXT NOT NULL DEFAULT 'high' CHECK (risk_level IN ('low', 'medium', 'high')),
  description TEXT,
  -- GATE conditions (ALL must be true to clear the action day)
  medical_standby BOOLEAN NOT NULL DEFAULT FALSE,        -- ambulance + doctor confirmed
  safety_equipment_ok BOOLEAN NOT NULL DEFAULT FALSE,    -- safety checklist complete
  risk_assessment_signed BOOLEAN NOT NULL DEFAULT FALSE,
  insurance_rider_active BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stunt_sequences_project ON stunt_sequences(project_id, shoot_date);

CREATE TABLE IF NOT EXISTS animal_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scenes TEXT,
  shoot_date DATE,
  animals TEXT,                        -- e.g. "3 elephants, 2 bullocks"
  handler TEXT,                        -- mahout / handler
  description TEXT,
  -- LEGAL gate conditions (mandatory in India)
  awbi_permission BOOLEAN NOT NULL DEFAULT FALSE,        -- AWBI certificate obtained
  vet_standby BOOLEAN NOT NULL DEFAULT FALSE,
  welfare_officer_required BOOLEAN NOT NULL DEFAULT FALSE,
  welfare_officer_present BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_animal_usage_project ON animal_usage(project_id, shoot_date);

DROP TRIGGER IF EXISTS set_updated_at_stunt ON stunt_sequences;
CREATE TRIGGER set_updated_at_stunt BEFORE UPDATE ON stunt_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_animal ON animal_usage;
CREATE TRIGGER set_updated_at_animal BEFORE UPDATE ON animal_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE stunt_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_usage    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stunt_read"   ON stunt_sequences;
DROP POLICY IF EXISTS "stunt_insert" ON stunt_sequences;
DROP POLICY IF EXISTS "stunt_update" ON stunt_sequences;
DROP POLICY IF EXISTS "stunt_delete" ON stunt_sequences;
CREATE POLICY "stunt_read"   ON stunt_sequences FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "stunt_insert" ON stunt_sequences FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "stunt_update" ON stunt_sequences FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "stunt_delete" ON stunt_sequences FOR DELETE TO authenticated USING (public.is_founder());

DROP POLICY IF EXISTS "animal_read"   ON animal_usage;
DROP POLICY IF EXISTS "animal_insert" ON animal_usage;
DROP POLICY IF EXISTS "animal_update" ON animal_usage;
DROP POLICY IF EXISTS "animal_delete" ON animal_usage;
CREATE POLICY "animal_read"   ON animal_usage FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "animal_insert" ON animal_usage FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "animal_update" ON animal_usage FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "animal_delete" ON animal_usage FOR DELETE TO authenticated USING (public.is_founder());
