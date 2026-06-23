# OPM Office — Full Technical & Business Audit
*As of 2026-06-22 · for CTO / architect / DevOps / AI / security / PM / investor review*
*Grounded in the live system: 122 tables, 331 RLS policies (100% table coverage), 266 indexes, 46 app pages, 36 API routes, 11 crons.*

> **Frame-setting caveat.** OPM Office is an **internal, effectively single-tenant operations platform for one production house (OPM Cinemas)** — not a consumer/multi-tenant SaaS. Real concurrent users ≈ 10–30 staff. Questions about 100k–1M users are answered honestly but **that is not the design point**; treating it as a SaaS would be the biggest misframing.

## 1. Executive Summary
- **What it is:** A Next.js + Supabase web app running the back office of a film production house — finance (payments, cash, liabilities, budgets, vouchers, Tally export, GST/TDS), per-film production management (development → pre-prod → shoot → post → release → revenue), a music label module (OPM Records), a founder-only personal-finance vault, vehicles, social, HR, and a full production cost engine (Phases 1–5).
- **Primary purpose:** one source of truth for every rupee and operational fact across all OPM films.
- **Core objectives:** accurate budget actuals (one-truth from the payment pipeline), creditor/receivable visibility, paper-replacement (DPRs, timecards, receipts), safety/legal gates that block non-compliant shoot days.
- **Status:** live on Vercel; cost engine Phases 1–4 complete, Phase 5 in progress (receivables done, cash-flow forecast next). 122 tables.
- **Architecture:** Next.js 15 App Router (server components + actions) on Vercel serverless → Supabase Postgres (RLS) + Auth + Storage; Anthropic for AI; Gmail SMTP/IMAP + Resend for mail; Vercel cron.

## 2. System Architecture
```
Browser (staff PWA) → Vercel (project "tommorow", Pro)
  Next.js 15 App Router: server components (RLS client) · client components (RLS client) ·
  middleware.ts (auth) · /api/* serverless (cron, alerts, notify, whatsapp, monitoring, AI, gmail-sync) ·
  11 Vercel Cron jobs
       ├─ anon key (RLS enforced) ─► Supabase Postgres (122 tables, 331 policies, 266 idx)
       └─ service role (admin) ────►   Auth (email/pw, JWT, profiles.role)
                                       Storage: documents/personal/vehicle-documents (all private)
External: Anthropic (Opus 4.8, Haiku 4.5) · Gmail SMTP+IMAP · Resend (fallback) · Twilio WhatsApp (dormant)
Second hat: same repo serves tommorow.in via GitHub Pages (index.html + CNAME)
```
**Services:** Vercel, Supabase, Anthropic, Gmail (Workspace), Resend, Twilio (dormant), GitHub. No separate analytics, vector DB, queue, or APM.

## 3. Technology Stack (live)
Next.js ^15.3.1 (App Router) · React ^19 · TypeScript ^5.8 · Tailwind ^4.1 (dark, no config) · Supabase (`supabase-js ^2.49`, `ssr ^0.5`) · `@anthropic-ai/sdk ^0.104` (claude-opus-4-8 ×18 sites, claude-haiku-4-5 ×2) · nodemailer ^9 (Gmail SMTP) + Resend (fallback) · imapflow ^1.4 · mupdf ^1.27 · `pg` for migrations. Rationale: server components keep finance data server-side; RLS is the security core; Gmail = zero-cost on the founder domain; Opus for extraction quality, Haiku for cheap paths; prompt-based JSON (the SDK structured-output param throws — banned).

## 4. Vercel Audit
Single project `tommorow` (team `opm-cinemas-projects`, Pro). Push/merge to `main` → auto prod deploy; per-PR preview deploys. 36 serverless API routes (some `maxDuration` 60–300s), 11 crons, no edge functions. **Risks:** 🔴 preview deploys share the **production DB**; 🟠 repo double-duty with the public landing page; 🟠 single static `CRON_SECRET`; 🟡 300s gmail-sync near serverless limits.

## 5. Supabase Audit
122 tables; **RLS enabled on every table** (0 without), 331 policies; helpers `user_role/is_founder/is_finance/is_project_member/my_project_role/can_view_personal`. 266 indexes (hot paths covered). Buckets now all private; signed URLs for reads. Auth = email/password + JWT, `profiles.role` is authz truth. No edge functions. **Bottlenecks:** migrations applied manually via `pg` (no CLI history/CI); data volumes tiny (largest table 734 rows) so Postgres is over-provisioned for years.

## 6. AI Architecture Audit
Models: claude-opus-4-8 (reasoning/extraction, 18 sites) + claude-haiku-4-5 (2). Use: document/receipt/statement/transaction extraction (prompt-based JSON), Ask OPM assistant (founder-only), daily briefings, intel. **No app-level memory, no RAG, no vector DB, no embeddings, no in-product agents** — context is assembled per request from Postgres. Cost: Anthropic usage-based, concentrated on Opus (the main cost lever if usage grows; several extractors could move to Haiku).

## 7. Security Audit
| Sev | Finding |
|---|---|
| 🔴 Critical | `documents` bucket was **public** — **fixed** (now private + signed URLs). |
| 🟠 High | Preview deploys share the **production DB**. |
| 🟠 High | **No CI/test gate** before prod (push-to-main; manual tsc+build only). |
| 🟠 High | **Single-operator key custody**, no rotation cadence. |
| 🟡 Med | Rate limiting only on the WhatsApp webhook. |
| 🟡 Med | No field-level encryption for bank/PAN/GSTIN. |
| 🟢 Low | RLS coverage excellent (100%, 331 policies); secrets gitignored; admin client server-only; audit logging on payments/cash/documents/settings. |

## 8. Database Audit
Spine: `projects` ──< `budget_lines` (phase/section/estimated); actuals computed on read from paid `payment_requests` + expense `project_transactions`/`petty_cash_txns` + `crew_payments` by `budget_line_id`. Production: `production_reports`↔`daily_cost_reports`>`daily_cost_lines`; `purchase_orders`>`vendor_advances`; pre-prod (`costume_looks`/`art_sets`/`permits`/`crew_onboarding`>`crew_consents`); shoot (`store_items`>`consumption_logs`, `extras_days`, `fuel_estimates`, `geofences`/`attendance_logs`); sequences (`stunt_sequences`/`animal_usage`/`song_sequences`/`special_equipment`/`vfx_shots`); release (`kdm`/`media_assets`/`project_deals`>`receivable_encumbrances`). `personal_*` owner-scoped. **Growth:** thousands of rows/year, not millions — no partitioning needed. **Retention:** none defined (financial/legal records kept indefinitely; no documented policy).

## 9. Business Workflow Audit
Onboarding (founder creates user → role → RLS scopes); crew onboarding + consent log. Admin: founder/accountant finance, GM/EP production. Production: per-film modules. AI: extraction on upload + assistant + crons. File: upload → Storage → signed-URL read. Payment: request → verify → approve → paid, coded to budget head → actuals; Tally export. Reporting: dashboard, Film P&L, statements, Tally.

## 10. DevOps Audit
**CI/CD:** none beyond Vercel auto-deploy (manual tsc+build gate). GitHub `aashiqabu-opm/tommorow`; branch → PR → user merges → deploy; migrations applied manually via `pg`. Branching: `claude/<topic>`, squash-merge. Rollback: Vercel instant; **DB: forward-only, no down-migrations.** Backup/DR: was undocumented — now addressed in `docs/BACKUP.md` (PITR + dumps + drill).

## 11. Cost Audit
Today (~10–30 internal users): **~$45–90/mo** (Vercel ~$20, Supabase ~$25, Anthropic low-tens, Gmail free, Resend free, Twilio idle). Hypothetical-if-SaaS: 100 users ~$70–150; 1k ~$200–1.2k; 10k ~$1.5–11k; 100k **AI-dominated, $15–100k+**. At scale, **Anthropic (Opus) dominates**, not infra.

## 12. Scalability Audit
10k: minor work (private docs ✓, cache actuals, split preview DB). 100k: Supabase dedicated/pooling, AI cost controls, background queue. 1M: requires **multi-tenant data model** (it's role-based single-org today, not org-isolated) — a rebuild question, not tuning.

## 13. Product Audit
Complete: full finance; cost engine P1–4; Records; Personal vault; HR; expense automation; receivables+encumbrances. Partial: Phase 5 (cash-flow forecast pending; per-shot VFX cost, music, ADR pending). Missing/deferred: public crew self-onboarding PWA; geofence auto check-in; Twilio WhatsApp prod; marketing (Phase 6). Debt: manual migrations, no tests, shared preview DB, overcrowded project nav.

## 14. Codebase Audit
`app/(app)/*` (46 pages), `app/api/*` (36 routes incl cron/alerts/notify/whatsapp/monitoring), `components/ui`+`layout`, `lib/` (supabase clients, audit, alerts, mailer, monitoring, ai/*, pnl, finance/categorizer, tally, storage, types), `supabase/*.sql`. Reusable kit: PageHeader/StatCard/Modal/Button/Input/MoneyInput/Toast/FilePicker. **Refactors:** (1) shared `<TrackerTab>` for the repeated cost-engine CRUD; (2) centralize budget-actuals roll-up into one `lib` fn (currently ~6 sites); (3) production sub-nav.

## 15. Investor Readiness (/10)
Technical 7 · Operational 4 · Security 6 · Scalability (internal) 8 / (SaaS) 3. **Honest line:** a genuinely strong internal operating system for a production house; not a fundraise-ready SaaS. Value = operational leverage for OPM + a credible template for a future productized version.

## 16. CTO Recommendations
Keep: Next+Supabase+RLS, the cost-engine one-truth design, per-PR discipline, the UI kit. Rebuild: CI/CD (GitHub Actions gate), migrations on Supabase CLI, separate staging DB. Remove: public bucket (done), dormant Twilio config, overcrowded nav. Add: tested backups/DR (done — `BACKUP.md`), finance smoke tests, secret-rotation policy, the cash-flow forecast.

## 17. Roadmap
30 days: cash-flow forecast · private docs (done) · CI gate · tested backups (runbook done). 90 days: finish Phase 5/6, separate preview DB, migration tooling, shared tracker component, route extractors Opus→Haiku. 12 months: decide the fork — best-in-class internal tool vs multi-tenant productization; add observability + secret management.

## 18. Documentation
In-repo: `CLAUDE.md`, `APP_CONTEXT.md`, `SECRETS.md`, `docs/database-schema-tree.md`, per-migration comments, and now `docs/AUDIT.md` / `STRATEGY.md` / `ADR.md` / `BACKUP.md`. Gap: a single consolidated ops runbook (deploy/migrate/rotate/restore/on-call) — `BACKUP.md` covers the DR slice.

**Two live items remain urgent regardless of roadmap: separate the preview DB (High) and add a CI gate (High). The two Criticals (public bucket, untested backups) are now addressed.**
