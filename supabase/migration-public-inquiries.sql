-- ─────────────────────────────────────────────
-- PUBLIC INQUIRIES (Website ecosystem)
-- Intake from public, UNAUTHENTICATED website forms (line-production inquiries,
-- general contact, casting/general). Careers go to the existing job_applications
-- table; this captures everything else.
--
-- SECURITY: there is intentionally NO public/insert RLS policy. All inserts happen
-- server-side via the service-role client behind /api/public/* (validated +
-- honeypot), so the public never gets a direct write path into the database.
-- Management reads/triages; founder deletes.
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('line_production', 'contact', 'casting', 'general')),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  subject TEXT,
  message TEXT,
  project_ref TEXT,                    -- film / project the inquiry is about, if any
  source TEXT,                         -- which form / page it came from
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'in_progress', 'closed')),
  assigned_to UUID REFERENCES profiles(id),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_public_inquiries_status ON public_inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_inquiries_kind ON public_inquiries(kind);

DROP TRIGGER IF EXISTS set_updated_at_public_inquiries ON public_inquiries;
CREATE TRIGGER set_updated_at_public_inquiries BEFORE UPDATE ON public_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public_inquiries ENABLE ROW LEVEL SECURITY;
-- NO insert policy by design — inserts are service-role only (via /api/public/*).
DROP POLICY IF EXISTS "inq_read"   ON public_inquiries;
DROP POLICY IF EXISTS "inq_update" ON public_inquiries;
DROP POLICY IF EXISTS "inq_delete" ON public_inquiries;
CREATE POLICY "inq_read"   ON public_inquiries FOR SELECT TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "inq_update" ON public_inquiries FOR UPDATE TO authenticated USING (
  public.user_role() IN ('founder', 'accountant', 'general_manager', 'executive_producer')
);
CREATE POLICY "inq_delete" ON public_inquiries FOR DELETE TO authenticated USING (public.is_founder());
