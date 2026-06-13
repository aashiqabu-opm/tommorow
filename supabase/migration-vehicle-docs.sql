-- ─────────────────────────────────────────────
-- VEHICLE DOCUMENTS + DRIVER/OWNER DETAILS
-- RC, insurance, PUC, permit, fitness, tax — with expiry tracking & alerts.
-- Driver union ID & licence; hired-vehicle owner contact. Run in SQL editor.
-- ─────────────────────────────────────────────

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS owner_phone TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS driver_union_id TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS driver_license_no TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS driver_license_expiry DATE;

CREATE TABLE IF NOT EXISTS vehicle_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL DEFAULT 'other'
    CHECK (doc_type IN ('rc','insurance','puc','permit','fitness','tax','other')),
  doc_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  file_url TEXT,
  file_name TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_docs_vehicle ON vehicle_documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_docs_expiry ON vehicle_documents(expiry_date);

DROP TRIGGER IF EXISTS set_updated_at_vehicle_docs ON vehicle_documents;
CREATE TRIGGER set_updated_at_vehicle_docs BEFORE UPDATE ON vehicle_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vehicle_docs_read"   ON vehicle_documents;
DROP POLICY IF EXISTS "vehicle_docs_write"  ON vehicle_documents;
DROP POLICY IF EXISTS "vehicle_docs_update" ON vehicle_documents;
DROP POLICY IF EXISTS "vehicle_docs_delete" ON vehicle_documents;
CREATE POLICY "vehicle_docs_read"   ON vehicle_documents FOR SELECT TO authenticated USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
CREATE POLICY "vehicle_docs_write"  ON vehicle_documents FOR INSERT TO authenticated WITH CHECK (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
CREATE POLICY "vehicle_docs_update" ON vehicle_documents FOR UPDATE TO authenticated USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
CREATE POLICY "vehicle_docs_delete" ON vehicle_documents FOR DELETE TO authenticated USING (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
