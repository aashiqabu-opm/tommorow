-- ─────────────────────────────────────────────
-- TEMPLATES LIBRARY — uploaded standard formats the team can download.
-- Readable by all staff; uploaded by management. Run in the SQL editor.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('voucher','agreement','form','hr','other')),
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size BIGINT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "templates_read"   ON templates;
DROP POLICY IF EXISTS "templates_insert" ON templates;
DROP POLICY IF EXISTS "templates_delete" ON templates;
CREATE POLICY "templates_read"   ON templates FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "templates_insert" ON templates FOR INSERT TO authenticated WITH CHECK (public.user_role() IN ('founder','accountant','general_manager','executive_producer'));
CREATE POLICY "templates_delete" ON templates FOR DELETE TO authenticated USING (public.is_founder() OR created_by = auth.uid());
