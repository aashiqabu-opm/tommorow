# OPM Account — Identity & RLS Wall (spec)

> Spec for the gated foundation in [`docs/OPM_ECOSYSTEM.md`](../OPM_ECOSYSTEM.md) decision (b).
> **Spec only — no migration applied.** This unblocks Auditions, Story Vault, Demo Vault,
> Distribution, and Partnership submissions. Lock this (merge) before building any of them.

---

## 0. Purpose & non-goals
- **One external identity** — the "OPM Account" — used across Story Vault, Demo Vault, Auditions, Distribution, and Partnership. One login, many services (the blueprint's "Phase 2").
- **Hard-walled** from all internal staff / finance / personal / project data.
- **Non-goals (separate specs):** the vault/auditions service tables; the public-site frontend; internal staff auth (unchanged). This spec is *only* the account + the wall.

## 1. Two populations, one Supabase Auth
- `auth.users` is shared (one Supabase project). The internal-vs-public distinction lives at the **profile layer**, not the auth layer.
- A user is **either internal or public — disjoint, never both:**
  - **Internal** (staff): existing `profiles` row + role (`founder/accountant/general_manager/executive_producer/legal_viewer/staff`).
  - **Public** (creators/talent/partners): new `public_profiles` row. **No `profiles` row.**
- Keeping them disjoint is what makes the wall trivially safe (see §2).

## 2. The wall — secure *by construction*, not by blocklist
The existing internal RLS helpers resolve a user's role from `profiles`:
```sql
-- supabase/rls.sql (existing)
user_role() := SELECT role FROM profiles WHERE id = auth.uid();   -- NULL if no row
is_finance() := SELECT role IN ('founder','accountant') FROM profiles WHERE id = auth.uid();
is_founder() := SELECT role = 'founder' FROM profiles WHERE id = auth.uid();
```
A **public account has no `profiles` row**, so for it: `user_role()` → `NULL`, `is_finance()`/`is_founder()` → `false`. **Every internal policy that gates on these therefore denies** — finance, personal, projects, payments, everything. The wall is the *absence of a profiles row*, enforced by default-deny RLS. No per-table blocklist to maintain.

Public access is then **granted explicitly** on public tables only, via a new helper:
```sql
CREATE OR REPLACE FUNCTION public.is_public_account()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public_profiles WHERE id = auth.uid());
$$;
```

## 3. Data model (illustrative — not applied)
```sql
CREATE TABLE public_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,  -- = auth.uid()
  email           TEXT NOT NULL,
  full_name       TEXT,
  account_kind    TEXT NOT NULL DEFAULT 'general'
                    CHECK (account_kind IN ('creator','talent','partner','general')),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
                    CHECK (verification_status IN ('unverified','email_verified','id_verified')),
  jurisdiction_country TEXT,         -- needed by Story Vault
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public_profiles ENABLE ROW LEVEL SECURITY;
-- A public account sees/edits ONLY its own row.
CREATE POLICY public_profiles_own ON public_profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
```
The account holds **identity only**. Per-service data (vault submissions, audition profiles) lives in service tables that FK to `public_profiles.id` (§5).

## 4. Signup & provisioning
- **Public signup** is a **separate route** from internal `/login` (e.g. a public-site `/account` flow) → creates a `public_profiles` row, never a `profiles` row.
- **`handle_new_user` trigger must become account-type-aware.** Today it auto-creates a `profiles` row from `raw_user_meta_data`. Change: it creates a `profiles` row **only** for internal invites (metadata flag), and creates a `public_profiles` row (or lets the app create it) for public signups. **A public signup must never receive a `profiles` row** — that's the whole wall.
- **Internal users** stay on the existing admin `createUser` invite flow — unchanged.

## 5. One identity, many services
Every public-facing submission table FKs to the account and is owner-scoped:
```
story_vault_submissions.account_id  → public_profiles.id     (RLS: account_id = auth.uid())
demo_vault_submissions.account_id   → public_profiles.id
audition_profiles.account_id        → public_profiles.id
partnership_requests.account_id     → public_profiles.id (nullable; Knock can be anon)
```
(These tables are out of scope here — defined in their own specs.)

## 6. The wall test (non-negotiable — ships with the build)
A test that authenticates as a public account and asserts:
- **CANNOT** read: `bank_accounts`, `account_transactions`, `payment_requests`, `cash_entries`, `liabilities`, `personal_*`, internal `projects`, `profiles`.
- **CAN** read/write only its own `public_profiles` row and its own service rows.
Same discipline as the EP/GM redaction test — the boundary is proven, not assumed.

## 7. Migration plan (when locked)
1. `public_profiles` table + own-row RLS.
2. `is_public_account()` helper.
3. **Default-deny audit:** a script asserting that for a user with no `profiles` row, every internal table returns zero rows (proves the wall before any public account exists).
4. Account-type-aware `handle_new_user` trigger.
5. The wall test (§6).
6. *(Later, separate)* public signup route + minimal account dashboard.

## 8. Open items — founder / legal
- **Identity verification level** for Story Vault creators (KYC depth) — **legal call.** Affects `verification_status` states + proof storage.
- **Email verification required before submission?** Recommend **yes**.
- **Can an internal staffer also hold a public OPM Account?** Recommend **no** (disjoint populations keep the wall trivially safe; use a separate email if ever needed). Flag.
- **Account deletion / data-rights** (creator can delete account + submissions) — needed for a public IP platform.

## 9. Why this is the next stone
It's the gate for Auditions, Story Vault, Demo Vault, and Partnership submissions — none can be built safely before the identity wall exists. Recommended build order after this locks: **Auditions** (lowest legal risk) → **Story Vault** (gated on §8 legal).
