-- ─────────────────────────────────────────────
-- FUEL ESTIMATES (Phase 3)
-- Planning/forecast for fuel: vehicles per-km, generators per-hour. Estimated cost
-- = units × rate_per_unit (computed on read — no stored derived figure).
--
-- This is a FORECAST, not an actual. Actual fuel spend lives in vehicle logs and the
-- payment pipeline and is what feeds budget actuals — fuel_estimates is never summed
-- into actuals (one-truth intact).
--
-- RLS mirrors production_reports (operational management; delete = founder).
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fuel_estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'vehicle' CHECK (source_type IN ('vehicle', 'generator', 'other')),
  label TEXT NOT NULL,                 -- e.g. "Camera truck" / "Generator 250kVA"
  basis TEXT NOT NULL DEFAULT 'per_km' CHECK (basis IN ('per_km', 'per_hour', 'per_day', 'flat')),
  units NUMERIC(12, 2) NOT NULL DEFAULT 0,        -- km / hours / days
  rate_per_unit NUMERIC(10, 2) NOT NULL DEFAULT 0, -- ₹ fuel cost per unit
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fuel_estimates_project ON fuel_estimates(project_id, source_type);

DROP TRIGGER IF EXISTS set_updated_at_fuel ON fuel_estimates;
CREATE TRIGGER set_updated_at_fuel BEFORE UPDATE ON fuel_estimates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE fuel_estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fuel_read"   ON fuel_estimates;
DROP POLICY IF EXISTS "fuel_insert" ON fuel_estimates;
DROP POLICY IF EXISTS "fuel_update" ON fuel_estimates;
DROP POLICY IF EXISTS "fuel_delete" ON fuel_estimates;
CREATE POLICY "fuel_read"   ON fuel_estimates FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "fuel_insert" ON fuel_estimates FOR INSERT TO authenticated WITH CHECK (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "fuel_update" ON fuel_estimates FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "fuel_delete" ON fuel_estimates FOR DELETE TO authenticated USING (public.is_founder());
