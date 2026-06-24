# Website ⇄ Backbone Handoff

> What the **public website session/repo** can consume from the shared OPM
> backbone *today*, and what is not ready yet. Companion to
> [`OPM_ECOSYSTEM.md`](../OPM_ECOSYSTEM.md) and [`OPM_ACCOUNT.md`](./OPM_ACCOUNT.md).
> Generated from the live DB on 2026-06-24.

---

## 0. The one thing to read first
**No table is anonymously readable yet.** Every policy on the public-node tables
(`projects`, `opm_records_*`, `project_deals`, `public_inquiries`) is
`roles = {authenticated}`. So an **anonymous visitor using the anon key cannot
read Films, Records, or Deals.** The *data* exists; the *public-read path* does
not. Building that (curated anon-read views) is the immediate next backbone task
(§4). Do **not** point public pages at `projects`/`opm_records_titles` directly —
they'll return nothing for a logged-out visitor.

## 1. Connection
- **Same Supabase project** as OPM Flash: ref `skarxqynijdnnwowsopg`.
- Website uses `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon, RLS-enforced). Never the service-role key in the browser.
- One backbone = one source of truth. Migrations live in this repo's `supabase/`.

## 2. Identity — the OPM Account
- Public users sign up as **OPM Accounts**, distinct from internal Flash staff.
- **Signup must set `account_type: 'public'` in the auth user metadata.** The `handle_new_user` trigger then creates a `public_profiles` row and **never a `profiles` row** — that absence is the security wall (a public account is denied all internal finance/staff/project data by RLS). If you omit the flag, the user wrongly becomes an *internal* account.
- Optional metadata: `full_name`, `account_kind` ∈ `creator|talent|partner|general`.
- A public account can read/write only its own `public_profiles` row + its own service rows (below).

## 3. What you CAN consume today
| Need | How | Auth context |
|---|---|---|
| **Public account** | `public_profiles` (own row) | logged-in OPM Account |
| **Auditions — browse roles** | `open_calls` (rows where `status='open'`) | logged-in OPM Account |
| **Auditions — talent profile** | `talent_profiles` (own row: create/edit) | logged-in OPM Account |
| **Auditions — apply** | `audition_submissions` (insert own; read own; status is staff-set) | logged-in OPM Account |
| **Knock OPM (contact)** | POST `/api/public/inquiry` (server-side insert; rate-limited; CORS-allowlisted) | anonymous — via the API, **not** direct DB |

So **the Auditions flow is fully wired for logged-in talent**, and **Knock OPM works via the existing API**.

## 4. What is NOT ready (build before the public pages work)
- **Anon-read layer for Films / Records / Deals.** Needed for the homepage, Cinemas Films pages, and OPM Records. Recommended approach (a focused next backbone task in *this* repo):
  - Create **curated views** exposing only *publishable* columns of *released/public* rows — e.g. `public_films` (name, slug, poster, synopsis, release_date, imdb/letterboxd/instagram/facebook URLs — **not** budget/status_reason/internal fields; only `status` in released/upcoming), `public_releases` (OPM Records titles/releases), `public_deals` if any are meant to be shown.
  - Grant `anon` SELECT on the views + an RLS policy scoping to published rows.
  - The website session should **specify exactly which fields each public page needs** so the views expose the minimum.
- **Public signup route + account dashboard** — the UI for §2 (pairs with the website).
- **Awards** — no `awards` table exists yet (net-new).
- **Story Vault / Demo Vault** — blocked on the founder's legal/KYC model (`OPM_ACCOUNT.md` §8). Do not build user-IP intake until that's locked.

## 5. Brand (shared)
- Tokens: OPM Black `#000000`, OPM Gold `#D6B16F`, Graphite `#1A1A1A`, Ivory `#E7E0D0`. Tagline: `ORIGINAL PIXELS IN MOTION` (only one).
- App logo asset in this repo: `public/opm-flash-logo.png` (the gold OPM mark). The website should use the OPM master mark per `OPM_ECOSYSTEM.md` (descriptor changes, symbol fixed).

## 6. Security contract (non-negotiable)
- The browser only ever uses the **anon key**; RLS is the boundary.
- Public accounts are **walled** from all internal data — verified by `supabase/verify-account-wall.sql` (public account → 0 rows on every internal table). Don't add policies that grant public/anon access to internal tables.
- Any new public-read surface = a **curated view of publishable columns**, never raw internal-table exposure.
