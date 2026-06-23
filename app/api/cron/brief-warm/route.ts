import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAndStoreBrief, BRIEF_AUDIENCES } from '@/lib/ai/brief'
import { withCronErrorAlert } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Pre-warm every role brief each morning so the leadership team never lands on
// a cold (~10-20s) generate-on-load. Runs with the service-role client; the
// EP/GM finance section is still the redacted oversight summary (no bank/cash).
export async function GET(request: Request) {
  return withCronErrorAlert('brief-warm', () => run(request))
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: true, skipped: 'ANTHROPIC_API_KEY not set' })
  }
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })

  const results: Record<string, string> = {}
  // Sequential — keeps within the AI rate budget and avoids a token spike.
  for (const audience of BRIEF_AUDIENCES) {
    try {
      const brief = await generateAndStoreBrief(admin, audience, 'cron')
      results[audience] = `ok (${brief.tokens_used ?? 0} tokens)`
    } catch (e) {
      results[audience] = `failed: ${e instanceof Error ? e.message : 'unknown'}`
    }
  }

  return NextResponse.json({ ok: true, results })
}
