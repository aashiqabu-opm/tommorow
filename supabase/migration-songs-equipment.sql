-- ─────────────────────────────────────────────
-- SONG/DANCE SEQUENCES + SPECIAL EQUIPMENT (Phase 4.3, cost engine)
-- The remaining special-sequence trackers (no safety gates — those live in
-- stunt_sequences / animal_usage). Folded into the Special Sequences page.
--
-- special_equipment.daily_rate is a PLANNING estimate (booking forecast), like
-- fuel_estimates — not a budget actual; actual rental spend flows through the
-- payment pipeline (one-truth intact).
--
-- RLS mirrors production_reports (operational management; delete = founder).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS song_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  choreographer TEXT,
  dancers_count INT,
  rehearsal_days INT,
  shoot_days INT,
  location TEXT,
  shoot_date DATE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'rehearsing', 'shot', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_song_sequences_project ON song_sequences(project_id, shoot_date);

CREATE TABLE IF NOT EXISTS special_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- e.g. "Technocrane", "Russian arm"
  vendor TEXT,
  days_required INT NOT NULL DEFAULT 0,
  daily_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,  -- planning estimate; cost = days × rate
  permit_required TEXT,                -- e.g. "DGCA drone"
  operator_included BOOLEAN NOT NULL DEFAULT FALSE,
  shoot_dates TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'booked', 'on_set', 'returned', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_special_equipment_project ON special_equipment(project_id, status);

DROP TRIGGER IF EXISTS set_updated_at_song ON song_sequences;
CREATE TRIGGER set_updated_at_song BEFORE UPDATE ON song_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS set_updated_at_equip ON special_equipment;
CREATE TRIGGER set_updated_at_equip BEFORE UPDATE ON special_equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE song_sequences    ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "song_read"   ON song_sequences;
DROP POLICY IF EXISTS "song_insert" ON song_sequences;
DROP POLICY IF EXISTS "song_update" ON song_sequences;
DROP POLICY IF EXISTS "song_delete" ON song_sequences;
CREATE POLICY "song_read"   ON song_sequences FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "song_insert" ON song_sequences FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "song_update" ON song_sequences FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "song_delete" ON song_sequences FOR DELETE TO authenticated USING (public.is_founder());

DROP POLICY IF EXISTS "equip_read"   ON special_equipment;
DROP POLICY IF EXISTS "equip_insert" ON special_equipment;
DROP POLICY IF EXISTS "equip_update" ON special_equipment;
DROP POLICY IF EXISTS "equip_delete" ON special_equipment;
CREATE POLICY "equip_read"   ON special_equipment FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "equip_insert" ON special_equipment FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "equip_update" ON special_equipment FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "equip_delete" ON special_equipment FOR DELETE TO authenticated USING (public.is_founder());
