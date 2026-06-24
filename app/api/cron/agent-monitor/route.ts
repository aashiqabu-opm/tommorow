import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withCronErrorAlert } from '@/lib/monitoring'
import {
  checkWebsite, checkSupabase, checkSslExpiry, checkTwilio, checkGitHub, checkStorage,
  type CheckResult,
} from '@/lib/agents/health-checks'
import { processResults } from '@/lib/agents/escalation'

export const runtime = 'nodejs'        // SSL probe needs the tls module
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Always-on watchdog. Runs every 5 min (Vercel Cron). Fast probes run every
// tick; heavier/rate-limited probes run on slower cadences so we don't burn
// function invocations or hit third-party limits. Rules decide green/yellow/red;
// Claude is consulted only when something is actually red. Alert-only — it never
// changes infrastructure.
export async function GET(request: Request) {
  return withCronErrorAlert('agent-monitor', () => run(request))
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })

  const now = new Date()
  const min = now.getUTCMinutes()
  const hour = now.getUTCHours()
  // Cadence gates (cron fires every 5 min):
  const everyTick = true
  const every15 = min % 15 < 5                    // twilio
  const hourly = min < 5                           // github CI
  const daily = hour === 1 && min < 5              // ssl + storage, ~06:30 IST

  const probes: Promise<CheckResult>[] = []
  if (everyTick) probes.push(checkWebsite(), checkSupabase(admin))
  if (every15) probes.push(checkTwilio())
  if (hourly) probes.push(checkGitHub())
  if (daily) probes.push(checkSslExpiry(), checkStorage())

  const results = await Promise.all(probes)
  const outcome = await processResults(admin, results)

  return NextResponse.json({
    ok: true,
    overall: outcome.overall,
    checks: results.map(r => ({ service: r.service, type: r.checkType, status: r.status })),
    paged: outcome.paged,
    opened: outcome.opened,
    resolved: outcome.resolved,
  })
}
