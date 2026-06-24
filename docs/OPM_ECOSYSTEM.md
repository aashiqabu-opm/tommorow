# OPM Ecosystem — Locked Blueprint

> Single source of truth for the **OPM digital headquarters**. Both builds — the
> public ecosystem (separate website repo) and **OPM Flash** (this repo) — build
> against this document. Locked 2026-06-24. Supersedes ad-hoc plans; update here
> first when the architecture changes.

---

## 0. Locked decisions
1. **Shared Supabase backbone — YES.** The public ecosystem and OPM Flash run on the **same Supabase project** (`skarxqynijdnnwowsopg`) as a single source of truth. Public *reads* go through dedicated read-only views / anon-RLS policies; public *writes* (vault & auditions submissions) land in **isolated public-submission tables**. Migrations stay additive.
2. **OPM Account — YES, one external identity in a separate realm inside the same Supabase Auth.** One account spans Story Vault, Demo Vault, Auditions, Distribution, and Partnership. It is **hard-walled from all internal staff / finance / personal data by default-deny RLS** — a public account is provably scoped to public tables only. Internal Flash staff logins remain a distinct population. (This is "Phase 2: Single OPM Account" — it is actually Phase 0, because the vaults and auditions depend on it.)

These two decisions are the spine. Nothing in the identity/vault layer may be built before they are honoured.

---

## 1. Brand architecture
- **Parent:** **OPM** — *Original Pixels in Motion.* An independent creative company across Film, Music, and Production Services.
- **Tagline (only one):** `ORIGINAL PIXELS IN MOTION`.
- **Architecture:**
  ```
  OPM
  ├── OPM Cinemas   (movie production company)
  ├── OPM Records   (record label)
  ├── OPM Studios   (line-production services)
  └── OPM Flash     (internal operating system — not publicly navigated)
  ```
- **Invariant:** the OPM symbol never changes; only the descriptor changes.

## 2. Design language — "OPM Brutalist Premium"
Influences: A24, MUBI, Monocle, Apple, Are.na, Frieze. **Not:** Netflix, startup SaaS, agency portfolios, generic entertainment sites.
Characteristics: huge click targets · minimal copy · strong grids · large type · black space · gold accents · high contrast · fast loading.

### Color system (canonical tokens — shared by ALL properties)
| Token | Hex |
|---|---|
| OPM Black | `#000000` |
| OPM Gold | `#D6B16F` |
| Graphite | `#1A1A1A` |
| Ivory | `#E7E0D0` |

> ⚠️ **Flash brand drift to fix:** OPM Flash currently uses bg `#0a0a0f` + amber accent `#f5b301` — **not** the canonical gold `#D6B16F`. To make Flash "belong to the same institution," migrate its accent/bg to these tokens. Tracked as the first build task (§7).

The tokens must live as a **shared design-token source** consumed by both the public ecosystem and Flash.

---

## 3. System map — who builds what, where
| Layer | Repo / property | Owns |
|---|---|---|
| **Public ecosystem** | website repo (separate) | Homepage + Cinemas / Records / Studios presentation; Story Vault, Demo Vault, Auditions, Knock OPM, Distribution **frontends** |
| **OPM Flash** | this repo (`tommorow`, opmoffice.vercel.app) | Internal OS; **the shared Supabase backbone**; public-read views/APIs; public-submission **backends** (vaults, auditions, knock) |
| **Data** | one Supabase project | Single source of truth for both |

Both consume the same brand tokens and the same Supabase. That is what makes nine surfaces feel like one institution.

---

## 4. Data backbone contract
**Already exists in this Supabase (public nodes read these):**
| Public node | Backing tables |
|---|---|
| Cinemas → Films | `projects` (+ imdb/letterboxd/instagram/facebook URLs, release fields) |
| Cinemas → Distribution | `project_deals` |
| Cinemas → Auditions (seed) | `project_auditions`, `job_positions`, `job_applications` |
| Cinemas → Archives (seed) | `project_archival`, `project_documents` |
| Records | `opm_records_titles / releases / royalties / channels` |
| Knock OPM | `public_inquiries` |

**Net-new (no data yet — must be designed):**
- `story_vault_*` (submissions, audit/access/download logs, certificates)
- `demo_vault_*` (audio equivalent)
- `awards` (institution-wide archive — **no table exists today**)
- public-account identity tables (`public_profiles` or equivalent)

**Read pattern:** public surfaces read via **read-only views or anon-key RLS** scoped to publishable columns only — never authenticated access to internal tables.
**Write pattern:** public submissions write **only** to the isolated `*_vault_*` / auditions / knock tables, under public-account RLS.

---

## 5. Identity & security — non-negotiable
- **Two populations, one project:** internal staff (`profiles.role` ∈ founder/accountant/general_manager/executive_producer/legal_viewer/staff) vs. external **OPM Accounts** (public creators/talent/partners). Distinct namespace.
- **Default-deny RLS.** A public OPM Account has grants **only** on its own vault/audition/knock rows and on publishable read-views. It can never reach finance, personal, or internal-project tables. This wall is **verified by a test** (same discipline as the EP/GM brief redaction).
- **Story Vault / Demo Vault = IP-grade, not forms.** Each submission gets: content **hash**, immutable **timestamp**, and tamper-evident **audit / access / download logs**. Legal stance, shown to every creator: **OPM never claims ownership; submission ≠ rights transfer; rights transfer requires a separate agreement.** This model needs **legal review before any build.**
- **Blast radius:** because the backbone is shared, every migration can affect the live Flash app *and* the live website — additive-only, RLS-first, test the wall.

---

## 6. Node specs (condensed from the founder blueprint)
- **Homepage:** single screen, no scroll, one job — route visitors. `OPM / Original Pixels in Motion / [Cinemas][Records][Studios] / Knock OPM`. Hover reveals each descriptor. Motion: logo assembly, ambient movement, hover expansion, fades — never flashy.
- **OPM Cinemas** (largest node — IMDb + studio archive + business portal): Films (Released/Upcoming/Development) with full film pages (hero, cast/crew, awards, reviews & ratings, trivia, gallery, videos, timeline); Awards; Archives (OPM Museum); Story Vault; Auditions; Distribution; About.
- **OPM Records:** Artists, Releases, Videos, Publishing, **Demo Vault**, About.
- **OPM Studios:** Line Production (core business), Services, Locations (searchable Kerala/South India/India library), Partners, Case Studies (Rifle Club, Ajasundari, …), About.
- **OPM Flash** (this repo): internal OS — Operations, Finance, Approvals, Projects, Reports, Founder Brief, Role Briefs. Separate login; not publicly navigated.
- **Knock OPM:** universal contact hub; dynamic forms by intent (Film Project / Story / Audition / Music / Line Production / Partnership / Media / Other).

---

## 7. Build sequence (locked order)
1. **Brand tokens (shared) + Flash accent migration** to `#D6B16F` / `#000000`. Foundation; safe to build now.
2. **OPM Account identity + RLS wall + wall test.** Unblocks everything below.
3. **Public read layer** — homepage + Cinemas Films / Records / Studios / Awards / Archives off existing data. Safe to build in parallel with (1).
4. **Knock OPM** — already backed by `public_inquiries`.
5. **Auditions** — talent registry + open calls (partial data exists).
6. **Story Vault** — strategic priority but **gated on the §5 legal/security spec**.
7. **Demo Vault** — mirrors Story Vault for audio.

"Safe to build ahead now": §7 steps 1, 3, 4. "Hold until decisions/legal": steps 2, 5, 6, 7's security model.

---

## 8. Open items still requiring founder / legal sign-off
- **Story Vault & Demo Vault legal model** (ownership disclaimer, hash/timestamp/audit, jurisdiction handling) — legal review before build.
- **Domain architecture** — `opm.in` homepage routing, the `flash.*` internal subdomain, and how today's `tommorow.in` landing (this repo's `index.html`/`CNAME`) retires into it.
- **Awards data** — net-new `awards` table + an entry workflow (likely seeded from `project_archival`/film records).

---

## 9. Success test (carried from the blueprint)
A visitor understands OPM in **under 10 seconds**. A filmmaker knows where to submit a story. A musician knows where to submit music. A producer knows where to request line production. An actor knows where to register. A partner knows how to reach OPM. **And every page feels like it belongs to the same institution.**
