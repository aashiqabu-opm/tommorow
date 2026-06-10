-- OPM Office - Complete Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- PROFILES (extends Supabase auth.users)
-- ─────────────────────────────────────────────
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'executive_producer'
    CHECK (role IN ('founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer')),
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────────
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'development'
    CHECK (status IN ('active', 'development', 'post_production', 'released', 'on_hold', 'cancelled')),
  description TEXT,
  start_date DATE,
  end_date DATE,
  budget NUMERIC(15, 2),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- PROJECT MEMBERS (role assignments per project)
-- ─────────────────────────────────────────────
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- ─────────────────────────────────────────────
-- CASH ENTRIES
-- ─────────────────────────────────────────────
CREATE TABLE cash_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date DATE NOT NULL,
  opening_cash NUMERIC(15, 2) NOT NULL DEFAULT 0,
  cash_in NUMERIC(15, 2) NOT NULL DEFAULT 0,
  cash_out NUMERIC(15, 2) NOT NULL DEFAULT 0,
  closing_cash NUMERIC(15, 2) NOT NULL DEFAULT 0,
  entered_by UUID NOT NULL REFERENCES profiles(id),
  notes TEXT,
  proof_file_url TEXT,
  proof_file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- LIABILITIES
-- ─────────────────────────────────────────────
CREATE TABLE liabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  party_name TEXT NOT NULL,
  amount_owed NUMERIC(15, 2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
  balance_remaining NUMERIC(15, 2) NOT NULL DEFAULT 0,
  original_date DATE NOT NULL,
  due_date DATE,
  project_id UUID REFERENCES projects(id),
  type TEXT NOT NULL DEFAULT 'other'
    CHECK (type IN ('loan', 'vendor', 'artist', 'technician', 'rent', 'tax', 'personal', 'other')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('urgent', 'normal', 'low')),
  status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'partly_paid', 'cleared', 'disputed')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- LIABILITY PAYMENTS (payment history)
-- ─────────────────────────────────────────────
CREATE TABLE liability_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  liability_id UUID NOT NULL REFERENCES liabilities(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL,
  payment_date DATE NOT NULL,
  paid_by UUID NOT NULL REFERENCES profiles(id),
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- PAYMENT REQUESTS
-- ─────────────────────────────────────────────
CREATE TABLE payment_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  requested_by UUID NOT NULL REFERENCES profiles(id),
  payee TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  purpose TEXT NOT NULL,
  category TEXT,
  due_date DATE,
  bill_url TEXT,
  bill_file_name TEXT,
  -- Verification (Accountant)
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  -- Approval (Founder)
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  -- Payment (Accountant)
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid')),
  paid_by UUID REFERENCES profiles(id),
  paid_at TIMESTAMPTZ,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- DOCUMENTS
-- ─────────────────────────────────────────────
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  document_type TEXT NOT NULL DEFAULT 'other'
    CHECK (document_type IN (
      'movie_agreement', 'artist_contract', 'technician_contract',
      'investor_agreement', 'distribution_agreement', 'ott_agreement',
      'music_rights', 'legal_notice', 'gst_tds', 'invoice', 'bill',
      'censor_document', 'insurance', 'loan_document', 'company_registration', 'other'
    )),
  title TEXT NOT NULL,
  party_name TEXT,
  document_date DATE,
  expiry_date DATE,
  renewal_date DATE,
  amount_linked NUMERIC(15, 2),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'signed', 'active', 'expired', 'disputed')),
  notes TEXT,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  access_level TEXT NOT NULL DEFAULT 'project_team'
    CHECK (access_level IN ('founder_only', 'finance_team', 'project_team', 'all_staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- DOCUMENT FILES (multiple files per document)
-- ─────────────────────────────────────────────
CREATE TABLE document_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- AUDIT LOGS (append-only, no delete)
-- ─────────────────────────────────────────────
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- COMMENTS (on payment requests, documents)
-- ─────────────────────────────────────────────
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- NOTIFICATIONS
-- ─────────────────────────────────────────────
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX idx_cash_entries_date ON cash_entries(entry_date DESC);
CREATE INDEX idx_liabilities_status ON liabilities(status);
CREATE INDEX idx_liabilities_priority ON liabilities(priority);
CREATE INDEX idx_liabilities_due_date ON liabilities(due_date);
CREATE INDEX idx_payment_requests_approval ON payment_requests(approval_status);
CREATE INDEX idx_payment_requests_project ON payment_requests(project_id);
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_documents_expiry ON documents(expiry_date);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- ─────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_projects BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_cash BEFORE UPDATE ON cash_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_liabilities BEFORE UPDATE ON liabilities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_payments BEFORE UPDATE ON payment_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_documents BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Prevent deletion of audit logs
CREATE OR REPLACE FUNCTION prevent_audit_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs cannot be deleted';
END;
$$;

CREATE TRIGGER no_delete_audit_logs
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_delete();
