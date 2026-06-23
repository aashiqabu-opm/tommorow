# OPM Flash — Claude Code Workspace

Internal operating platform for OPM Cinemas. Maintained with **Claude Code** (terminal agent). Live at **opmoffice.vercel.app**.

## Tech Stack & Commands
- **Framework:** Next.js 15 (App Router, TypeScript)
- **Styling:** Tailwind CSS v4 (dark-mode-first)
- **Backend:** Supabase (Auth, PostgreSQL, Storage)
- **Dev:** `npm run dev` · **Lint:** `npm run lint` · **Build:** `npm run build`
- Build gotcha: if `next build` fails with `Cannot find module for page: /<x>`, it's a stale cache — `rm -rf .next` and rebuild.

## Project Structure
- `app/` — routes; protected app under `app/(app)/` (dashboard, payments, cash, liabilities, documents, projects, personal, reports, users, settings, …); APIs under `app/api/` (incl. `cron/`, `alerts/`, `notify/`, `monitoring/`, `whatsapp/`).
- `components/` — shared UI (`ui/`, `layout/`)
- `lib/` — Supabase clients, types, utilities (`audit.ts`, `alerts/`, `mailer.ts`, `monitoring.ts`, …)
- `supabase/` — schema, RLS, seed and migration SQL

## Deploy Pipeline
- Repo: `github.com/aashiqabu-opm/tommorow` (gh authed as `aashiqabu-opm`; commit email `aashiqabu-opm@users.noreply.github.com`).
- **Push to `main` → Vercel auto-deploys** (project "tommorow", team `opm-cinemas-projects`, Pro plan). Deploys are automatic — never use a browser to deploy.
- **Workflow:** work on a `claude/<topic>` branch → `tsc --noEmit` + `npm run build` clean → push the branch explicitly (`git push origin HEAD:<branch>`) → open a PR → **the user merges** (Claude never merges to `main`). Keep financial values (amounts, account numbers) out of commit/PR text.
- **Every PR must end its report with the direct merge URL in this exact format** (applies to every PR opened in this repo, no exceptions):

  🔀 Merge here: https://github.com/aashiqabu-opm/tommorow/pull/[NUMBER]
- ⚠️ The **same repo also serves the `tommorow.in` landing page** via GitHub Pages from `index.html` + `CNAME` at the repo root.

## Protected — never delete, commit, or casually edit
- `index.html`, `CNAME` — the live landing page
- `.env`, `.env.local`, `.env.db`, `.env.production`, `.env.twilio` — live secrets (gitignored; never print or commit their contents)
- `vercel.json` — production cron schedule · `middleware.ts` — auth gating · `supabase/run-all-latest.sql` — canonical DB setup
- `firebase.json` / `.firebaserc`, `OPM Cinemas Logo.png`

## Database (Supabase)
- Hosted, project ref `skarxqynijdnnwowsopg`.
- Browser client → **anon key, RLS enforced**. Server/admin/cron → `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS — admin use only).
- Direct Postgres for migrations/verification: there's **no `psql`** on this Mac — use the `pg` node client with creds from `.env.db`. Schema/RLS live in `supabase/*.sql`, applied via `pg` or the Supabase SQL editor.
- **RLS:** finance tables (cash, liabilities, payments) are restricted to **Founder + Accountant**. Respect it.

## Code Style & Rules
- Modern React/TS; prefer server components/actions; keep client components minimal; follow the existing Tailwind v4 dark-mode patterns.
- **Audit:** every change to payments, cash, documents, or settings must log an entry via `lib/audit.ts`.
- **AI extractors:** use prompt-based JSON parsing — the Anthropic `output_config` structured-output param throws at runtime; don't reintroduce it.
- **Email:** all outbound email goes through `lib/alerts/channels.ts` (`sendEmail`) — Gmail SMTP primary, Resend fallback. `lib/mailer.ts` re-exports it.

## Verify, don't guess
- Email + WhatsApp: open `GET /api/alerts/test` while signed in → per-channel status + which email path is live.
- Error monitoring: `GET /api/monitoring/test`.
- Never claim a channel/feature/migration "works" — hit its test endpoint or query the DB to confirm.

## Secrets & credentials
- Every live key lives in a gitignored `.env*` file (and in Vercel for prod). Document each var as a placeholder in `.env.example`.
- When a task needs a credential Claude can't obtain itself (an OAuth login, a key behind a dashboard), **pause and ask the user** — state the exact value needed and the exact page to get it from.

## Browser (Claude in Chrome) — last resort only
Reach for MCP → CLI → API → terminal first. Use Chrome **only** for browser-locked flows with no programmatic path (e.g. Meta/WhatsApp Business verification, a dashboard with no API). Never for deploys or anything scriptable.
