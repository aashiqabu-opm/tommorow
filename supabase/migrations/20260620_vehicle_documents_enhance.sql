-- Add missing columns to vehicle_documents
ALTER TABLE vehicle_documents
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
    CHECK (status IN ('active','expired','expiring_soon'));
ALTER TABLE vehicle_documents
  ADD COLUMN IF NOT EXISTS extracted_data JSONB DEFAULT '{}';
ALTER TABLE vehicle_documents
  ADD COLUMN IF NOT EXISTS ai_extracted BOOLEAN DEFAULT false;
-- Widen doc_type enum
ALTER TABLE vehicle_documents DROP CONSTRAINT IF EXISTS vehicle_documents_doc_type_check;
ALTER TABLE vehicle_documents ADD CONSTRAINT vehicle_documents_doc_type_check
  CHECK (doc_type IN ('rc','insurance','puc','permit','permit_all_india','fitness','road_tax','tax','driver_licence','other'));
