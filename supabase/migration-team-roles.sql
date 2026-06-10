-- ═════════════════════════════════════════════════════════════
-- Migration: Team roles update
--   • Adds "General Manager" role
--   • Removes "Production Manager" (Executive Producer takes over
--     uploads + payment request creation)
--   • Sets roles for Madan AVK (GM), Shiny Harshad (Accountant),
--     Abid Abu (Executive Producer)
-- Run once in Supabase SQL Editor. Safe to re-run.
-- Supersedes migration-general-manager.sql.
-- ═════════════════════════════════════════════════════════════

-- 1. Convert any existing production_manager profiles
UPDATE profiles SET role = 'executive_producer', updated_at = NOW()
WHERE role = 'production_manager';

-- 2. Update the allowed roles and default for new signups
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer'));

ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'executive_producer';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'executive_producer')
  );
  RETURN NEW;
END;
$$;

-- 3. Update RLS policies

DROP POLICY IF EXISTS "payment_requests_insert" ON payment_requests;
CREATE POLICY "payment_requests_insert" ON payment_requests
  FOR INSERT TO authenticated WITH CHECK (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
  );

DROP POLICY IF EXISTS "documents_read" ON documents;
CREATE POLICY "documents_read" ON documents
  FOR SELECT TO authenticated USING (
    public.is_founder()
    OR
    (public.user_role() = 'accountant' AND access_level IN ('founder_only', 'finance_team', 'project_team', 'all_staff'))
    OR
    (public.user_role() IN ('general_manager', 'executive_producer', 'legal_viewer')
      AND access_level IN ('project_team', 'all_staff'))
  );

DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents
  FOR INSERT TO authenticated WITH CHECK (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
  );

DROP POLICY IF EXISTS "documents_update" ON documents;
CREATE POLICY "documents_update" ON documents
  FOR UPDATE TO authenticated USING (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
  );

DROP POLICY IF EXISTS "document_files_insert" ON document_files;
CREATE POLICY "document_files_insert" ON document_files
  FOR INSERT TO authenticated WITH CHECK (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
  );

-- 4. Set team member roles
--    (Create each account first in Authentication > Users, then run.
--     Adjust the emails if theirs are different.)
UPDATE profiles SET role = 'general_manager', full_name = 'Madan AVK', updated_at = NOW()
WHERE email = 'madan@opmcinemas.com';

UPDATE profiles SET role = 'accountant', full_name = 'Shiny Harshad', updated_at = NOW()
WHERE email = 'shiny@opmcinemas.com';

UPDATE profiles SET role = 'executive_producer', full_name = 'Abid Abu', updated_at = NOW()
WHERE email = 'abid@opmcinemas.com';
