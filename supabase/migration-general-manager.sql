-- ═════════════════════════════════════════════════════════════
-- Migration: Add "General Manager" role
-- Run this once in Supabase SQL Editor (your live database).
-- Safe to re-run.
-- ═════════════════════════════════════════════════════════════

-- 1. Allow the new role in the profiles table
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('founder', 'accountant', 'general_manager', 'executive_producer', 'production_manager', 'legal_viewer'));

-- 2. Update RLS policies to include general_manager

-- Payment requests: GM can create
DROP POLICY IF EXISTS "payment_requests_insert" ON payment_requests;
CREATE POLICY "payment_requests_insert" ON payment_requests
  FOR INSERT TO authenticated WITH CHECK (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer', 'production_manager')
  );

-- Documents: GM can read project/staff docs, upload and update
DROP POLICY IF EXISTS "documents_read" ON documents;
CREATE POLICY "documents_read" ON documents
  FOR SELECT TO authenticated USING (
    public.is_founder()
    OR
    (public.user_role() = 'accountant' AND access_level IN ('founder_only', 'finance_team', 'project_team', 'all_staff'))
    OR
    (public.user_role() IN ('general_manager', 'executive_producer', 'production_manager', 'legal_viewer')
      AND access_level IN ('project_team', 'all_staff'))
  );

DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents
  FOR INSERT TO authenticated WITH CHECK (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'production_manager')
  );

DROP POLICY IF EXISTS "documents_update" ON documents;
CREATE POLICY "documents_update" ON documents
  FOR UPDATE TO authenticated USING (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'production_manager')
  );

DROP POLICY IF EXISTS "document_files_insert" ON document_files;
CREATE POLICY "document_files_insert" ON document_files
  FOR INSERT TO authenticated WITH CHECK (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'production_manager')
  );

-- 3. Set Madan AVK as General Manager
--    (Create his account first in Authentication > Users, then this
--     updates his profile. Adjust the email if his is different.)
UPDATE profiles
SET role = 'general_manager', full_name = 'Madan AVK', updated_at = NOW()
WHERE email = 'madan@opmcinemas.com';
