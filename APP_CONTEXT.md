# APP_CONTEXT.md — OPM Office (single source of truth)

> Shared context for the planning (chat) agent and the executing (Claude Code) agent.
> Last refreshed: 2026-06-20. Keep this current after structural changes.

---

## 1. App identity

- **Name:** OPM Office ("OPM Control Center" in the UI).
- **Purpose:** Internal operating platform for **OPM Cinemas** (Malayalam film production house, founder **Aashiq Abu**). Runs the company's finances, film projects (pre-production → release), the founder's private financial/legal workspace, the OPM Records music label, an internal operations office, and social/comms.
- **Users / roles:** `founder` (Aashiq — full access incl. Personal & Ask OPM), `accountant` (Shiny), `general_manager` (Madan AVK), `executive_producer` (Abid Abu), `legal_viewer`, `staff` (project crew, project-scoped logins). Founder + Accountant are the finance roles.
- **Stage:** Live, in active daily build-out. v3.x era (login screen shows a version string).
- **URLs:** Prod **https://opmoffice.vercel.app** (Vercel). The **same repo also serves the `tommorow.in` landing page** via GitHub Pages from root `index.html` + `CNAME`. No separate staging.
- **Repo layout:**
  - `app/` — Next.js App Router. Protected app under `app/(app)/`; APIs under `app/api/` (incl. `cron/`, `alerts/`, `notify/`, `monitoring/`, `whatsapp/`, `records/`, `tax/`, `personal/`, `projects/`).
  - `components/` — shared UI (`ui/`, `layout/`).
  - `lib/` — Supabase clients, types, helpers (`audit.ts`, `auth.ts`, `mailer.ts`, `monitoring.ts`, `alerts/`, `ai/`, `supabase/`).
  - `supabase/` — schema, RLS, seed & migration SQL (`migration-*.sql`, `run-all-latest.sql`).
  - Root: `index.html` + `CNAME` (landing page — **protected**), `vercel.json` (crons), `middleware.ts` (auth), `CLAUDE.md`, this file.

---

## 2. Tech stack

**Frontend**
- **Next.js 15** (App Router, React 19, TypeScript), **Tailwind CSS v4** (dark-mode-first; tokens: bg `#0a0a0f`, panels `#13131a`/`#1a1a24`, borders `#2a2a3a`, muted `#8888aa`, amber accent `#f5b301`).
- UI libs: `lucide-react` (icons), `clsx` + `tailwind-merge`, `date-fns`.
- Shared components: `PageHeader, StatCard, StatusBadge, Modal, Button, Input/Select/Textarea, MoneyInput, FilePicker, Toast, ProgressBar, BarChart, FloatingAssistant, AiHealthBanner, WhatsAppNudge`; layout: `AppShell, Sidebar, Header, NotificationsBell`.

**Backend**
- Next.js **route handlers** (`app/api/**/route.ts`) + **server components**. `middleware.ts` gates auth (redirects unauthenticated → `/login`; excludes `api/cron`, `api/whatsapp`).
- Two Supabase clients: browser (anon key, **RLS enforced**) and admin (`SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS — server/cron only, `lib/supabase/admin.ts`).
- AI via `@anthropic-ai/sdk` (model `claude-opus-4-8` default, `claude-haiku-4-5-20251001` for high-volume). **Note:** the `output_config` structured-output param throws at runtime — all extractors use **prompt-based JSON parsing** instead.
- Email: Gmail SMTP via `nodemailer` (primary, `lib/mailer.ts`), Resend fallback (`lib/alerts/channels.ts`). IMAP read via `imapflow` + `mailparser`. PDF via `mupdf` (WASM, `serverExternalPackages`).

**Database — Supabase (Postgres)**
- Project ref `skarxqynijdnnwowsopg`. **118 tables.** No `psql` on the Mac → migrations/verification via the `pg` node client with `.env.db` creds, or the Supabase SQL editor. Schema/RLS in `supabase/*.sql`.
- **Core finance:** `payment_requests` (33 cols — approval/verify/paid workflow, TDS/GST fields, `budget_line_id`), `cash_entries`, `liabilities`, `liability_payments`, `project_income`, `vendors`, `budget_lines`, `vouchers`+`voucher_entries`, `ledgers`, `tds_challans`, `gst_inputs`, `bank_accounts`, `bank_transactions`, `account_transactions`, `petty_cash_floats`/`petty_cash_txns`, `crew_payments`, `staff_salaries`, `payroll`/`financial_reports`.
- **Projects (films):** `projects` (+`is_operations`, `production_company`, `release_year`, `has_liabilities`), `project_members`, `project_crew`, `project_funding`, `project_income`, `project_documents`/`document_files`, `project_checkins`, `project_messages`/`project_channels`, `phase_tasks`/`project_tasks`/`project_post_tasks`, `project_deliverables`, `project_deals`/`project_deal_memos`, `project_archival`, `project_characters`/`project_auditions`/`project_press_kit`, `project_schedule`/`call_sheets`/`scenes`/`scene_elements`/`schedule_day_scenes`/`day_checklist`/`day_requirements`/`locations`, `production_reports`, `box_office_collections`, `campaign_assets`, `industry_films`, `monitoring_findings`.
- **Personal (founder-only, owner-RLS):** `personal_company_ledger, personal_guarantees, personal_accounts, personal_tax_profile, personal_tax_items, personal_deductions, personal_capital_gains, personal_film_stakes, personal_royalties, personal_documents, personal_legal_cases, personal_loans, personal_recurring, personal_vehicles, personal_health_policies, personal_cards, personal_transactions, personal_delegates, personal_synced_emails`.
- **OPM Records:** `opm_records_titles` (rights: ISRC/UPC/ownership/splits/content_id/sync), `opm_records_releases` (pipeline stages), `opm_records_royalties` (per period/platform, statement files), `opm_records_channels`.
- **Office (virtual office):** `office_tasks` (department, assigned_role, recurrence, rolled), `office_notices`.
- **Social:** `social_accounts`, `social_posts`.
- **System:** `profiles`, `audit_logs`, `notifications`, `ai_usage`, `app_settings`, `system_status`, `error_logs`, `wa_rate_limit`, `thread_summaries`, `templates`, `vehicles`/`vehicle_logs`/`vehicle_documents` (company), `conversations`/`messages`/`conversation_members`, `comments`.
- **⚠️ Orphan tables from Antigravity's removed modules (no app code — review/drop):** `BelieveCatalogTakeover, MusicTitles, OfficeLedger, RevenueCutoverAudit, RevenueSync, SocialAccount, StaffClearance, TalentSubmission, TrackMetadata, WorkspaceAccount, pipelines, releases, tracks, royalty_splits, raw_earning_line_items, artist_payout_ledger, artists, takeover_compliance, scheduled_tasks`.

**RLS model:** finance tables → founder + accountant; personal → owner only (`can_view_personal`/owner_id); helpers `user_role()`, `is_founder()`, `is_finance()`, `is_project_member()`, `my_project_role()`. Browser client always RLS-scoped; service-role admin only server-side.

**Auth:** Supabase Auth (email + password). New users provisioned via admin `createUser` with a temp password emailed over Gmail (not Supabase invite email — that wasn't delivering). `handle_new_user` trigger auto-creates a `profiles` row (role from metadata). Session via `@supabase/ssr` cookies; `middleware.ts` enforces.

**External services:** Anthropic (AI), Gmail (SMTP send + IMAP read, app-password auth), Resend (email fallback), Twilio (WhatsApp — sandbox sender; bill→payment channel + alerts), YouTube Data API (channel stats), Supabase (DB/Auth/Storage). Distributor **Believe** (music — manual CSV import today; API later).

---

## 3. Current features — every module

| Module | Route / files | DB tables | APIs |
|---|---|---|---|
| **Dashboard** | `app/(app)/dashboard` | aggregates many | — |
| **Ask OPM (AI)** | `assistant/`, `FloatingAssistant.tsx` | reads via RLS | `/api/assistant` (founder-only) |
| **OPM Office (ops)** | `office/OfficeClient.tsx` | `office_tasks`, `office_notices`, reads ops project finances | `/api/cron/office-recurring` (recurrence engine) |
| **Projects (films)** | `projects/`, `projects/[id]/*Section.tsx` | `projects`(excl. `is_operations`), members, crew, funding, income, budget_lines, payments, schedule, archival, deals, deliverables, characters, auditions, press_kit, checkins, channels, box_office, campaign | `/api/projects/[id]/team`, `/intel`, `/callsheet`, `/analyze-doc` |
| **Payments** | `payments/PaymentsClient.tsx` | `payment_requests`, `vendors`, `budget_lines`, `vouchers` | confirm-paid flow; `/api/vouchers/sync` |
| **Cash / Accounts / Reconcile** | `cash`, `accounts`, `reconcile` | `cash_entries`, `bank_accounts`, `bank_transactions`, `account_transactions` | — |
| **Liabilities / Payroll / Revenue / Forecast** | resp. dirs | `liabilities`, `staff_salaries`/`crew_payments`, `project_income`, forecasts | — |
| **Tax & Compliance** | `compliance/ComplianceClient.tsx` | `tds_challans`, payments TDS/GST | `/api/tax/draft-tds-challans` (PR #4), `/api/tax/ingest-shiny-reply` |
| **GST Inputs** | `gst-inputs/GstInputsClient.tsx` | `gst_inputs` | `/api/tax/ingest-shiny-reply` (import button) |
| **Vouchers / Statements / Tally** | resp. | `vouchers`/`voucher_entries`, `ledgers` | `/api/vouchers/sync` |
| **Documents / Templates** | `documents`, `templates` | `documents`/`document_files`, `templates` | `/api/analyze-document` |
| **Vehicles** | `vehicles` | `vehicles`/`vehicle_logs`/`vehicle_documents` | `/api/analyze-vehicle-doc` |
| **OPM Records** | `records/RecordsClient.tsx` | `opm_records_titles/releases/royalties/channels` | `/api/records/import-statement` (Believe CSV), `/refresh-youtube` |
| **Social** | `social/SocialClient.tsx` | `social_accounts`, `social_posts` | — |
| **Personal (founder)** | `personal/*Tab.tsx` | all `personal_*` | `/api/personal/analyze-doc`, `/analyze-legal` |
| **Users** | `users/UsersClient.tsx` | `profiles`, `project_members` | `/api/users/invite` (founder/GM/EP/accountant) |
| **Audit / Settings / Search / Market / Reports** | resp. | `audit_logs`, `app_settings`, `industry_films` | `/api/market/refresh` |
| **WhatsApp channel** | — | `wa_rate_limit`, payments | `/api/whatsapp/inbound` (Twilio webhook) |
| **Crons** | `app/api/cron/*` | various | ai-briefing, weekly-report, project-stages, crew-access, release-watch, gmail-sync, **office-recurring**, daily-digest, industry-tracker |

---

## 4. Deploy pipeline

- **Repo:** `github.com/aashiqabu-opm/tommorow` (gh authed as `aashiqabu-opm`; commit email `aashiqabu-opm@users.noreply.github.com`).
- **Vercel:** project **`tommorow`**, team **`opm-cinemas-projects`**, **Pro** plan. Prod alias **opmoffice.vercel.app**.
- **Trigger:** **push/merge to `main` → Vercel auto-deploys.** Do NOT `vercel deploy` from CLI or a browser. Crons defined in `vercel.json`.
- **Branch strategy (adopted):** work on `claude/<topic>` → `tsc --noEmit` + `npm run build` clean → push branch (`git push origin HEAD:<branch>`) → open PR → **Aashiq merges**. Build gotcha: `Cannot find module for page` ⇒ stale cache, `rm -rf .next` and rebuild.
- **Build:** `next build` (was temporarily `prisma generate && next build` — Prisma fully removed).

---

## 5. Active agents writing to this repo

- **Claude Code (terminal)** — primary executor (this agent). Now on `claude/<topic>` branches → PRs.
- **Background/cloud Claude agents** — create `claude/<topic>` branches **in this same local clone**, which moves local HEAD between turns (root cause of earlier "branch hijack"). **Fix: run them in isolated git worktrees.**
- **Google Antigravity** — previously edited this repo; introduced a parallel Prisma data layer + Social/Office/Workspace pages (since removed) and several PascalCase + orphan tables (still in DB). No longer the workflow.
- **Direct-to-main commits (history, pre-workflow):** earlier this session several feature commits + a Vercel-side cleanup landed straight on `main` (OPM Office ops, Records pipeline, Social, office task system, recurrence cron, Believe import, financial cleanup). All by Claude Code. **Going forward: none — PRs only.**
- Remote branches live now: `main`, `claude/tds-challan-autodraft` (PR #4), `claude/claude-md-rewrite` (PR #3), plus stale `claude/fix-alert-email-unify`, `claude/personal-loans-section`, `claude/monitoring-selftest-2026-06-14`, `claude/opm-office-dashboard-It5Q9`.

---

## 6. Known issues / WIP

- **Open PRs:** **#4** Tax: auto-draft TDS challans (`claude/tds-challan-autodraft`); **#3** Docs: rewrite CLAUDE.md (`claude/claude-md-rewrite`).
- **Orphan DB tables** (section 2) from removed Antigravity modules — safe to drop after review.
- **Social auto-posting & Believe API** — not wired (need Meta/YouTube OAuth approval + Believe API creds). Hooks left: `social_posts.external_ref`, `opm_records_releases.distributor_ref`.
- **YouTube live stats** — working for OPM Records channel (190K subs) via `YOUTUBE_API_KEY`; uploads would need OAuth.
- **TDS/GST data gaps** — 129 payments have TDS amounts but no section; `gst_inputs` mostly empty. Email sent to Shiny (CSV) requesting sections + GSTIN/invoice/taxable; reply ingested via `/api/tax/ingest-shiny-reply` → then `/api/tax/draft-tds-challans` (PR #4).
- **WhatsApp** — Twilio **sandbox** sender only (recipients must join sandbox); production sender pending Meta verification.
- **Stale local branches** — `backup_fixes`, `claude/personal-loans-section` not fully merged.

---

## 7. Secrets / credentials map (NAMES ONLY)

App reads (`process.env.*`): `ANTHROPIC_API_KEY`, `CRON_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_PDF_NAME`, `GMAIL_PDF_DOB`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_TEMPLATE_NEW_BILL_SID`, `TWILIO_TEMPLATE_REJECTED_SID`, `YOUTUBE_API_KEY`.

- **`.env.local`** (app runtime, local): Supabase URL/anon, Twilio, (Gmail/Anthropic where set). Gitignored.
- **`.env.db`** (migrations only): `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE` (direct Postgres). Gitignored.
- **`.env.twilio`**: Twilio creds. Gitignored.
- **Vercel (production) — must be set there:** `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_PDF_NAME`, `GMAIL_PDF_DOB`, `RESEND_API_KEY`, `RESEND_FROM`, `TWILIO_*`, `YOUTUBE_API_KEY`.
- **Not set / placeholder:** `DATABASE_URL` (was for the removed Prisma layer — gone); `NEXT_PUBLIC_APP_URL` (falls back to `opmoffice.vercel.app`); Believe API + Meta/YouTube OAuth creds (future).
- **All values are gitignored; document each as a placeholder in `.env.example`. Never print or commit values.** (Note: the Supabase `service_role` key was pasted into a chat earlier — rotation recommended.)

---

## 8. Workflow going forward

- **Chat (planning agent)** plans and directs; holds product context; decides priorities. **One active task at a time.**
- **Claude Code (executor)** works on **`claude/<topic>` branches**, runs `tsc --noEmit` + `npm run build` clean, pushes the branch, **opens a PR**. **No direct-to-main commits. No CLI/browser deploys.**
- **Aashiq merges** PRs → Vercel auto-deploys.
- **Claude in Chrome** handles browser-only tasks (Meta/WhatsApp Business verification, Supabase dashboard UI, provider dashboards) — last resort, never for anything scriptable.
- Keep financial values (amounts, account numbers) out of commit/PR text. Audit-log every change to payments/cash/documents/settings.
- DB changes: write `supabase/migration-*.sql`, apply via `pg`/SQL editor, verify by querying — never assume.
