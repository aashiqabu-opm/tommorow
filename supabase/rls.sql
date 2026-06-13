-- OPM Office - Row Level Security Policies
-- Run AFTER schema.sql

-- Helper function to get current user role
-- (created in public schema — hosted Supabase does not allow new functions in the auth schema)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_founder()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role = 'founder' FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_finance()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role IN ('founder', 'accountant') FROM profiles WHERE id = auth.uid();
$$;

-- ─────────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read profiles (for showing names)
CREATE POLICY "profiles_read_authenticated" ON profiles
  FOR SELECT TO authenticated USING (TRUE);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- Founder can update any profile (role management)
CREATE POLICY "profiles_update_founder" ON profiles
  FOR UPDATE TO authenticated USING (public.is_founder());

-- ─────────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_read_all" ON projects
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "projects_insert_founder" ON projects
  FOR INSERT TO authenticated WITH CHECK (public.is_founder());

CREATE POLICY "projects_update_founder" ON projects
  FOR UPDATE TO authenticated USING (public.is_founder());

-- Founder only soft-deletes (no hard delete without founder visibility)
CREATE POLICY "projects_delete_founder" ON projects
  FOR DELETE TO authenticated USING (public.is_founder());

-- ─────────────────────────────────────────────
-- PROJECT MEMBERS
-- ─────────────────────────────────────────────
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_members_read" ON project_members
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "project_members_write_founder" ON project_members
  FOR ALL TO authenticated USING (public.is_founder());

-- ─────────────────────────────────────────────
-- CASH ENTRIES (Finance only)
-- ─────────────────────────────────────────────
ALTER TABLE cash_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_read_finance" ON cash_entries
  FOR SELECT TO authenticated USING (public.is_finance());

CREATE POLICY "cash_insert_finance" ON cash_entries
  FOR INSERT TO authenticated WITH CHECK (public.is_finance());

CREATE POLICY "cash_update_finance" ON cash_entries
  FOR UPDATE TO authenticated USING (public.is_finance());

-- Finance roles (founder + accountant) can delete cash entries; the deletion
-- is always recorded in audit_logs, so history is preserved either way.
CREATE POLICY "cash_delete_finance" ON cash_entries
  FOR DELETE TO authenticated USING (public.is_finance());

-- ─────────────────────────────────────────────
-- PROJECT INCOME / REVENUE (Finance only)
-- ─────────────────────────────────────────────
ALTER TABLE project_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "income_read_finance" ON project_income
  FOR SELECT TO authenticated USING (public.is_finance());

CREATE POLICY "income_insert_finance" ON project_income
  FOR INSERT TO authenticated WITH CHECK (public.is_finance());

CREATE POLICY "income_update_finance" ON project_income
  FOR UPDATE TO authenticated USING (public.is_finance());

CREATE POLICY "income_delete_finance" ON project_income
  FOR DELETE TO authenticated USING (public.is_finance());

-- ─────────────────────────────────────────────
-- LIABILITIES (Finance only)
-- ─────────────────────────────────────────────
ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "liabilities_read_finance" ON liabilities
  FOR SELECT TO authenticated USING (public.is_finance());

CREATE POLICY "liabilities_insert_finance" ON liabilities
  FOR INSERT TO authenticated WITH CHECK (public.is_finance());

CREATE POLICY "liabilities_update_finance" ON liabilities
  FOR UPDATE TO authenticated USING (public.is_finance());

CREATE POLICY "liabilities_delete_founder" ON liabilities
  FOR DELETE TO authenticated USING (public.is_founder());

-- ─────────────────────────────────────────────
-- LIABILITY PAYMENTS (Finance only)
-- ─────────────────────────────────────────────
ALTER TABLE liability_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "liability_payments_read_finance" ON liability_payments
  FOR SELECT TO authenticated USING (public.is_finance());

CREATE POLICY "liability_payments_insert_finance" ON liability_payments
  FOR INSERT TO authenticated WITH CHECK (public.is_finance());

CREATE POLICY "liability_payments_delete_founder" ON liability_payments
  FOR DELETE TO authenticated USING (public.is_founder());

-- ─────────────────────────────────────────────
-- PAYMENT REQUESTS
-- ─────────────────────────────────────────────
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- All staff can see payment requests (but not finance details in liabilities)
CREATE POLICY "payment_requests_read" ON payment_requests
  FOR SELECT TO authenticated USING (TRUE);

-- Production staff + finance can create
CREATE POLICY "payment_requests_insert" ON payment_requests
  FOR INSERT TO authenticated WITH CHECK (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
  );

-- Finance can update (verify, approve, mark paid)
CREATE POLICY "payment_requests_update_finance" ON payment_requests
  FOR UPDATE TO authenticated USING (public.is_finance());

-- Only founder can delete
CREATE POLICY "payment_requests_delete_founder" ON payment_requests
  FOR DELETE TO authenticated USING (public.is_founder());

-- ─────────────────────────────────────────────
-- DOCUMENTS
-- ─────────────────────────────────────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_read" ON documents
  FOR SELECT TO authenticated USING (
    -- Founder sees all
    public.is_founder()
    OR
    -- Finance team sees finance-tagged docs
    (public.user_role() = 'accountant' AND access_level IN ('founder_only', 'finance_team', 'project_team', 'all_staff'))
    OR
    -- Others see project_team and all_staff docs
    (public.user_role() IN ('general_manager', 'executive_producer', 'legal_viewer')
      AND access_level IN ('project_team', 'all_staff'))
  );

CREATE POLICY "documents_insert" ON documents
  FOR INSERT TO authenticated WITH CHECK (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
  );

CREATE POLICY "documents_update" ON documents
  FOR UPDATE TO authenticated USING (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
  );

CREATE POLICY "documents_delete_founder" ON documents
  FOR DELETE TO authenticated USING (public.is_founder());

-- ─────────────────────────────────────────────
-- DOCUMENT FILES
-- ─────────────────────────────────────────────
ALTER TABLE document_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_files_read" ON document_files
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "document_files_insert" ON document_files
  FOR INSERT TO authenticated WITH CHECK (
    public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
  );

CREATE POLICY "document_files_delete_founder" ON document_files
  FOR DELETE TO authenticated USING (public.is_founder());

-- ─────────────────────────────────────────────
-- AUDIT LOGS (append-only, read by finance+)
-- ─────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_read_finance" ON audit_logs
  FOR SELECT TO authenticated USING (public.is_finance() OR public.is_founder());

CREATE POLICY "audit_logs_insert_authenticated" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- NO DELETE policy — audit logs are append-only (also enforced by trigger)

-- ─────────────────────────────────────────────
-- COMMENTS
-- ─────────────────────────────────────────────
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_read" ON comments
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "comments_insert" ON comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_read_own" ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notifications_insert_authenticated" ON notifications
  FOR INSERT TO authenticated WITH CHECK (TRUE);

-- ─────────────────────────────────────────────
-- STORAGE BUCKET POLICIES
-- ─────────────────────────────────────────────
-- Run these in Storage settings or via SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Allow authenticated users to upload
-- CREATE POLICY "documents_upload" ON storage.objects
--   FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');

-- Allow authenticated users to read (RLS on documents table controls access)
-- CREATE POLICY "documents_read" ON storage.objects
--   FOR SELECT TO authenticated USING (bucket_id = 'documents');

-- Only founder can delete files
-- CREATE POLICY "documents_delete_founder" ON storage.objects
--   FOR DELETE TO authenticated USING (
--     bucket_id = 'documents' AND
--     (SELECT role FROM profiles WHERE id = auth.uid()) = 'founder'
--   );
