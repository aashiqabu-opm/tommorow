-- ═══════════════════════════════════════════════════════════════════════
-- OPM ACCOUNT — public-ecosystem identity + RLS wall (foundation).
-- See docs/specs/OPM_ACCOUNT.md. Additive table + helper + one conservative
-- trigger change. Does NOT touch any existing internal table or policy.
--
-- THE WALL: external accounts get a public_profiles row and NEVER a profiles
-- row. The existing internal helpers resolve role from profiles
-- (user_role()/is_finance()/is_founder() → NULL/false for a public account),
-- so every internal RLS policy denies their access by construction. Public
-- access is granted explicitly only on public tables. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- 1. External identity table.
CREATE TABLE IF NOT EXISTS public_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,  -- = auth.uid()
  email           TEXT NOT NULL,
  full_name       TEXT,
  account_kind    TEXT NOT NULL DEFAULT 'general'
                    CHECK (account_kind IN ('creator','talent','partner','general')),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
                    CHECK (verification_status IN ('unverified','email_verified','id_verified')),
  jurisdiction_country TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A public account sees / edits ONLY its own row.
ALTER TABLE public_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_profiles_own ON public_profiles;
CREATE POLICY public_profiles_own ON public_profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 2. Helper to grant access on future public tables (vaults/auditions/etc.).
CREATE OR REPLACE FUNCTION public.is_public_account()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public_profiles WHERE id = auth.uid());
$$;

-- 3. Account-type-aware signup. A public signup (raw_user_meta_data.account_type
--    = 'public') creates a public_profiles row and NEVER a profiles row — that
--    absence is the wall. The ELSE branch is byte-for-byte today's behaviour, so
--    existing internal admin createUser provisioning is completely unaffected.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'account_type' = 'public' THEN
    INSERT INTO public_profiles (id, email, full_name, account_kind)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'account_kind', 'general')
    );
  ELSE
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      COALESCE(NEW.raw_user_meta_data->>'role', 'executive_producer')
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Harden blanket `authenticated USING (true)` policies so they require an
--    INTERNAL user (someone with a profiles row). Without this the wall leaks:
--    a public account passes `true` and could read internal data. The wall test
--    (supabase/verify-account-wall.sql) caught payment_requests, profiles,
--    vendors, project_income, etc. Internal users are UNAFFECTED — they have a
--    profiles row, so is_internal_user() = true and access is unchanged.
CREATE OR REPLACE FUNCTION public.is_internal_user()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid());
$$;

DROP POLICY IF EXISTS payment_requests_read ON payment_requests;
CREATE POLICY payment_requests_read ON payment_requests FOR SELECT TO authenticated USING (public.is_internal_user());

DROP POLICY IF EXISTS profiles_read_authenticated ON profiles;
CREATE POLICY profiles_read_authenticated ON profiles FOR SELECT TO authenticated USING (public.is_internal_user());

DROP POLICY IF EXISTS vendors_read_authenticated ON vendors;
CREATE POLICY vendors_read_authenticated ON vendors FOR SELECT TO authenticated USING (public.is_internal_user());

DROP POLICY IF EXISTS comments_read ON comments;
CREATE POLICY comments_read ON comments FOR SELECT TO authenticated USING (public.is_internal_user());

DROP POLICY IF EXISTS document_files_read ON document_files;
CREATE POLICY document_files_read ON document_files FOR SELECT TO authenticated USING (public.is_internal_user());

DROP POLICY IF EXISTS app_settings_read ON app_settings;
CREATE POLICY app_settings_read ON app_settings FOR SELECT TO authenticated USING (public.is_internal_user());

DROP POLICY IF EXISTS system_status_read ON system_status;
CREATE POLICY system_status_read ON system_status FOR SELECT TO authenticated USING (public.is_internal_user());

DROP POLICY IF EXISTS templates_read ON templates;
CREATE POLICY templates_read ON templates FOR SELECT TO authenticated USING (public.is_internal_user());

DROP POLICY IF EXISTS industry_films_read ON industry_films;
CREATE POLICY industry_films_read ON industry_films FOR SELECT TO authenticated USING (public.is_internal_user());

-- project_income had an ALL policy with qual `true` (any authenticated user could
-- read AND write project income). Harden the wall to internal users; the role
-- looseness (should it be finance-only?) is a separate, flagged decision.
DROP POLICY IF EXISTS "finance can manage project income" ON project_income;
CREATE POLICY "finance can manage project income" ON project_income FOR ALL TO authenticated
  USING (public.is_internal_user()) WITH CHECK (public.is_internal_user());
