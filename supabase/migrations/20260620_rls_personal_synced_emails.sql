-- Enable RLS on personal_synced_emails (the only table missing it).
-- Owner-only policy matching every other personal_* table.
-- NOTE: the column is `owner_id` (not user_id) — consistent with personal_* tables.
ALTER TABLE personal_synced_emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner only" ON personal_synced_emails;
CREATE POLICY "Owner only" ON personal_synced_emails
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
