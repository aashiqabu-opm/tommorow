-- ─────────────────────────────────────────────
-- VEHICLE LOG & REGISTER
-- Company-owned + hired production vehicles, with trip / fuel / service logs.
-- Management-visible (founder, accountant, GM, EP). Run in the SQL editor.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reg_number TEXT NOT NULL,
  name TEXT,                                  -- model / description, e.g. "Toyota Innova"
  vehicle_type TEXT NOT NULL DEFAULT 'car'
    CHECK (vehicle_type IN ('car','van','bus','truck','camera_vehicle','generator','bike','other')),
  ownership TEXT NOT NULL DEFAULT 'owned' CHECK (ownership IN ('owned','hired')),
  owner_name TEXT,                            -- hirer / vendor for hired vehicles
  hire_rate NUMERIC(12, 2),
  hire_basis TEXT CHECK (hire_basis IN ('day','km','month','trip')),
  driver_name TEXT,
  driver_phone TEXT,
  project_id UUID REFERENCES projects(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL DEFAULT 'trip' CHECK (type IN ('trip','fuel','service')),
  odometer_start NUMERIC(10, 1),
  odometer_end NUMERIC(10, 1),
  km NUMERIC(10, 1),
  fuel_litres NUMERIC(8, 2),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,   -- ₹: fuel cost / service cost
  purpose TEXT,                               -- route / reason / description
  driver_name TEXT,
  project_id UUID REFERENCES projects(id),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_logs_vehicle ON vehicle_logs(vehicle_id, log_date DESC);

DROP TRIGGER IF EXISTS set_updated_at_vehicles ON vehicles;
CREATE TRIGGER set_updated_at_vehicles BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicles_read" ON vehicles;
DROP POLICY IF EXISTS "vehicles_write" ON vehicles;
DROP POLICY IF EXISTS "vehicles_update" ON vehicles;
DROP POLICY IF EXISTS "vehicles_delete" ON vehicles;
CREATE POLICY "vehicles_read"   ON vehicles FOR SELECT TO authenticated USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
CREATE POLICY "vehicles_write"  ON vehicles FOR INSERT TO authenticated WITH CHECK (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
CREATE POLICY "vehicles_update" ON vehicles FOR UPDATE TO authenticated USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
CREATE POLICY "vehicles_delete" ON vehicles FOR DELETE TO authenticated USING (public.is_founder());

DROP POLICY IF EXISTS "vehicle_logs_read" ON vehicle_logs;
DROP POLICY IF EXISTS "vehicle_logs_write" ON vehicle_logs;
DROP POLICY IF EXISTS "vehicle_logs_update" ON vehicle_logs;
DROP POLICY IF EXISTS "vehicle_logs_delete" ON vehicle_logs;
CREATE POLICY "vehicle_logs_read"   ON vehicle_logs FOR SELECT TO authenticated USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
CREATE POLICY "vehicle_logs_write"  ON vehicle_logs FOR INSERT TO authenticated WITH CHECK (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
CREATE POLICY "vehicle_logs_update" ON vehicle_logs FOR UPDATE TO authenticated USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
CREATE POLICY "vehicle_logs_delete" ON vehicle_logs FOR DELETE TO authenticated USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
