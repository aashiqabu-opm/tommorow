# SECRETS.md — environment variable inventory (NAMES + status only, never values)

> Generated 2026-06-20 by scanning every `process.env.*` in `app/`, `lib/`, `components/`, `middleware.ts`
> and cross-checking `.env.local`, `.env.db`, `.env.twilio`, `.env.production`, `.env.example`, and Vercel production.
> **Gitignored — never commit. Never print values.**

## Legend
- **Local** = present in `.env.local` · **Vercel** = present in Vercel production · ✅ ok · ⚠️ gap

---

## A. Variables the CODE actually reads (18) — these must be correct

| Variable | What it's for | Where to get it | Local | Vercel | Status |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project REST URL (browser+server clients) | Supabase → Project Settings → Data API | ✅ | ✅ | OK |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (RLS-enforced browser/server/middleware client) | Supabase → Project Settings → API Keys (publishable/anon) | ✅ | ✅ | OK |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client (`lib/supabase/admin.ts`) — bypasses RLS; cron + admin routes | Supabase → Project Settings → API Keys (secret) | ✅ | ✅ | OK (rotated 2026-06-20) |
| `ANTHROPIC_API_KEY` | All AI (Ask OPM, extractors, briefings) | console.anthropic.com → API keys | ✅ | ✅ | OK |
| `CRON_SECRET` | Bearer auth for `/api/cron/*` | self-generated random; set same value both sides | ✅ | ✅ | OK |
| `GMAIL_USER` | Gmail address for SMTP send + IMAP read | the OPM mailbox (aashiqabu@gmail.com) | ✅ | ✅ | OK |
| `GMAIL_APP_PASSWORD` | Gmail app password (SMTP/IMAP auth) | Google Account → Security → App passwords | ✅ | ✅ | OK |
| `GMAIL_PDF_NAME` | Name used to derive password-protected bank-PDF passwords (gmail-sync) | known founder value | ⚠️ missing | ✅ | Local-only gap (cron runs on Vercel) |
| `GMAIL_PDF_DOB` | DOB used for the same PDF password candidates | known founder value | ⚠️ missing | ✅ | Local-only gap (cron runs on Vercel) |
| `RESEND_API_KEY` | Email **fallback** provider (after Gmail) | resend.com → API keys | ⚠️ missing | ✅ | Local-only gap (local email uses Gmail) |
| `RESEND_FROM` | Resend "from" address | a verified Resend domain/sender | ⚠️ missing | ✅ | Local-only gap |
| `TWILIO_ACCOUNT_SID` | Twilio account (WhatsApp) | twilio.com console | ✅ | ✅ | OK |
| `TWILIO_AUTH_TOKEN` | Twilio auth token (also validates inbound webhook signature) | twilio.com console | ✅ | ✅ | OK |
| `TWILIO_WHATSAPP_FROM` | Twilio WhatsApp sender (currently **sandbox**) | twilio.com → Messaging → WhatsApp | ✅ | ✅ | OK (sandbox) |
| `TWILIO_TEMPLATE_NEW_BILL_SID` | Approved WhatsApp template SID — new-bill notification | Twilio → Content Template Builder | ⚠️ missing | ⚠️ missing | **MISSING both** — template sends fall back to plain text |
| `TWILIO_TEMPLATE_REJECTED_SID` | Approved WhatsApp template SID — rejection notice | Twilio → Content Template Builder | ⚠️ missing | ⚠️ missing | **MISSING both** |
| `YOUTUBE_API_KEY` | OPM Records channel stats refresh | Google Cloud Console → YouTube Data API v3 | ✅ | ✅ | OK |
| `NEXT_PUBLIC_APP_URL` | Base URL for links in emails/invites | n/a (set to `https://opmoffice.vercel.app`) | ⚠️ missing | ⚠️ missing | **Not set anywhere** — code falls back to `opmoffice.vercel.app`. Works, but set it to be explicit. (Note: `.env.local`/`.env.production` define `NEXT_PUBLIC_SITE_URL` — a *different* name the code does NOT read.) |

---

## B. `.env.db` — migrations only (not app runtime)
`PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE` → direct Postgres for `pg`-client migrations/verification. ✅ Present, working. Not needed in Vercel.

---

## C. Orphan variables in `.env.local` the code NO LONGER reads (safe to delete)
Leftovers from Antigravity's removed Prisma/Google/social/Believe modules:
- `DATABASE_URL` — Prisma (ORM removed)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_WORKSPACE_CLIENT_ID`, `GOOGLE_WORKSPACE_CLIENT_SECRET`, `GOOGLE_GENERATIVE_AI_API_KEY` — removed Google/Workspace integration
- `META_APP_ACCESS_SECRET` — removed social integration
- `LABELGRID_WEBHOOK_SECRET` — removed music-distribution webhook
- `NEXT_PUBLIC_SITE_URL` — superseded by (unset) `NEXT_PUBLIC_APP_URL`

## D. Orphan / future variables in Vercel the code does NOT read (review)
- `GOOGLE_OAUTH_CLIENT_ID`, `META_APP_ACCESS_SECRET`, `LABELGRID_WEBHOOK_SECRET` — from removed modules; safe to remove
- `COMPANY_BANK_IFSC`, `COMPANY_BANK_SWIFT` — not referenced in code; appear unused/future

## E. ⚠️ Stale file: `.env.production`
Exists with the Antigravity-era set (`DATABASE_URL, GOOGLE_*, META_*, LABELGRID_*, NEXT_PUBLIC_SITE_URL`) and is **missing** `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_*`, `YOUTUBE_API_KEY`. Vercel uses its **dashboard** env (not this file), so it's misleading. Recommend deleting `.env.production` to avoid confusion — Vercel is the source of truth for prod.

---

## Action items (do NOT auto-apply — decisions for Aashiq)
1. **Add the 2 Twilio template SIDs** to Vercel once the WhatsApp templates are approved (Task 5) — until then template sends degrade to plain text.
2. **Set `NEXT_PUBLIC_APP_URL=https://opmoffice.vercel.app`** in Vercel (and `.env.local`) to stop relying on the fallback.
3. **Add `RESEND_API_KEY`/`RESEND_FROM` + `GMAIL_PDF_NAME`/`GMAIL_PDF_DOB` to `.env.local`** only if you run those flows locally (otherwise they're fine on Vercel only).
4. **Clean orphans** (sections C + D + the `.env.production` file) when convenient.
5. Keep `.env.example` as the canonical placeholder list; it currently lacks `GMAIL_*`, `RESEND_*`, `YOUTUBE_API_KEY`, `NEXT_PUBLIC_APP_URL` — add them as placeholders.

> All values live only in gitignored `.env*` files and Vercel. The Supabase `service_role` key was rotated 2026-06-20.
