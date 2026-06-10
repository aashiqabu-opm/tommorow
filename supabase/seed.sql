-- OPM Office - Seed Data
-- Run AFTER schema.sql and rls.sql
-- NOTE: First create users via Supabase Auth (Dashboard > Authentication > Users)
-- Then set the founder user's role to 'founder' manually or via this seed.

-- ─────────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────────
INSERT INTO projects (name, slug, status, description, created_by)
SELECT
  p.name, p.slug, p.status::TEXT, p.description,
  (SELECT id FROM profiles LIMIT 1)  -- Replace with actual founder user ID
FROM (VALUES
  ('OPM Office', 'opm-office', 'active', 'Internal company operations project'),
  ('Aja Sundari', 'aja-sundari', 'post_production', 'Tamil feature film - post production stage'),
  ('Downtrodden', 'downtrodden', 'development', 'Malayalam feature film in development'),
  ('Mayavi', 'mayavi', 'development', 'Tamil thriller feature film'),
  ('Rifle Club 2', 'rifle-club-2', 'active', 'Malayalam action sequel - principal photography'),
  ('TOMORROW', 'tomorrow', 'active', 'OPM Cinemas flagship project'),
  ('Other', 'other', 'active', 'Miscellaneous projects and operations')
) AS p(name, slug, status, description)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────
-- SAMPLE LIABILITIES (replace created_by with actual user IDs)
-- ─────────────────────────────────────────────
-- INSERT INTO liabilities (party_name, amount_owed, amount_paid, balance_remaining, original_date, due_date, type, priority, status, created_by)
-- VALUES
--   ('Vendor A - Equipment Rental', 500000, 200000, 300000, '2025-01-15', '2026-05-15', 'vendor', 'urgent', 'partly_paid', '<founder-id>'),
--   ('Artist Fee - Main Lead', 1500000, 750000, 750000, '2025-03-01', '2026-06-01', 'artist', 'normal', 'partly_paid', '<founder-id>'),
--   ('Studio Rent', 120000, 120000, 0, '2025-06-01', NULL, 'rent', 'low', 'cleared', '<founder-id>'),
--   ('Bank Loan - Production Finance', 5000000, 1000000, 4000000, '2025-01-01', '2027-01-01', 'loan', 'normal', 'partly_paid', '<founder-id>'),
--   ('GST Arrears', 85000, 0, 85000, '2025-04-01', '2026-04-30', 'tax', 'urgent', 'unpaid', '<founder-id>');

-- ─────────────────────────────────────────────
-- Update profiles role — set founder role
-- Run after creating your first user via Auth:
-- UPDATE profiles SET role = 'founder' WHERE email = 'your-founder@email.com';
-- ─────────────────────────────────────────────

-- ─────────────────────────────────────────────
-- Create storage bucket (if not done via dashboard)
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  FALSE,
  52428800,  -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies on storage.objects.
-- Wrapped in a DO block: on some hosted Supabase projects the SQL editor cannot
-- create policies on storage.objects — in that case create the same policies via
-- Dashboard > Storage > documents bucket > Policies instead.
DO $$
BEGIN
  CREATE POLICY "documents_bucket_upload" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
  CREATE POLICY "documents_bucket_read" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'documents');
  CREATE POLICY "documents_bucket_delete_founder" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'documents' AND public.is_founder());
EXCEPTION WHEN insufficient_privilege OR duplicate_object THEN
  RAISE NOTICE 'Storage policies skipped — create them via Dashboard > Storage > Policies';
END $$;
