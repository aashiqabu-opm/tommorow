# OPM Agent System — Phase 1 (Watchdog)

Always-on monitoring + escalation for OPM infrastructure. Alert-only: it
observes and pages, it never redeploys, restarts, or touches money.

## How it works

- **`/api/cron/agent-monitor`** runs every 5 min (Vercel Cron, `CRON_SECRET`-gated).
- It runs read-only **probes** (`lib/agents/health-checks.ts`) on a tiered cadence:
  | Probe | Cadence | Needs |
  |---|---|---|
  | Website HTTP + latency | every tick | `OPM_WEBSITE_URL` |
  | Supabase query + latency | every tick | service role key |
  | Twilio account active | ~every 15 min | Twilio vars |
  | GitHub CI last run | ~hourly | `GITHUB_TOKEN` + `GITHUB_REPO` |
  | SSL cert expiry | ~daily (06:30 IST) | — |
  | Supabase storage usage | ~daily | `SUPABASE_MGMT_TOKEN` + `SUPABASE_PROJECT_REF` |

  Any probe whose vars are missing reports `skipped` and the monitor continues.
- **Rules engine** (`lib/agents/escalation.ts`) rolls results into green/yellow/red,
  writes an `agent_health_snapshots` row, and opens/updates/resolves
  `agent_incidents` (deduped by `service:checkType` fingerprint).
- **Claude** (`lib/agents/triage.ts`) is consulted **only on a red event** to phrase
  the alert in plain English — never on green ticks, so cost stays near zero.
- **Paging**: criticals (and always-alert warnings — SSL/storage) go to founders'
  WhatsApp via the existing `sendWhatsApp`, throttled by `ALERT_COOLDOWN_MINUTES`.

## The 1 / 2 / 3 reply flow

A critical page ends with three options. Founders reply (handled in
`app/api/whatsapp/inbound`):
- **1 — I'll handle it** → incident `acknowledged`, paging stops until it recovers.
- **2 — Try again** → incident re-armed; the next monitor tick re-checks and
  re-pages if still failing.
- **3 — Take service offline** → recorded; the watchdog does **not** take services
  offline itself — do that from Vercel/Supabase. Paging pauses.

When a paged incident recovers, founders get a `✅ OPM RESOLVED` message.

## Setup

1. Run the migration `supabase/migration-agent-monitoring.sql` (Supabase SQL editor
   or `pg`). Creates `agent_incidents` + `agent_health_snapshots` (founder-only RLS).
2. Set the watchdog env vars (see `.env.example`) in Vercel. Everything is optional
   except `CRON_SECRET` (already set) and the Supabase keys.
3. Deploy. `vercel.json` already registers the `*/5` cron.

## External uptime — the one gap in-app crons can't cover

A cron hosted **on** opmoffice cannot report that opmoffice itself is down — if the
host is down, the cron doesn't run. So set up an **off-Vercel** pinger for office
liveness (5-min interval, alert to the same WhatsApp/email):

- **Better Stack / UptimeRobot / Cronitor** → monitor `https://opmoffice.vercel.app`
  and `https://opmcinemas.com`. Free tiers cover this.
- This complements the in-app watchdog (which covers Supabase/Twilio/GitHub/website-
  from-office and the incident lifecycle).

## Verify, don't guess

- Manually fire the monitor (founder browser, signed in is not enough — it needs the
  cron secret): `curl -H "Authorization: Bearer $CRON_SECRET" https://opmoffice.vercel.app/api/cron/agent-monitor`
  → returns the per-probe statuses + `overall`.
- Check `agent_health_snapshots` for a fresh row and `agent_incidents` for any opened.
- Existing channel tests still apply: `GET /api/alerts/test`, `GET /api/monitoring/test`.

## Cost notes

- ~288 cron invocations/day (fine on Vercel Pro).
- Claude is called only on red events, so AI spend is effectively zero while healthy.
