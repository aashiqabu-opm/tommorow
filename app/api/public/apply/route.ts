import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'
const METHODS = 'POST, OPTIONS'
export function OPTIONS(req: Request) { return preflight(req, METHODS) }

// Public job application → inserts into job_applications (status 'new').
// Service-role only; honeypot + validation; the position must exist and be OPEN.
const s = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

export async function POST(req: Request) { return withCors(req, await handle(req), METHODS) }

async function handle(req: Request) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  if (s(body.website, 1)) return NextResponse.json({ ok: true }) // honeypot

  const position_id = s(body.position_id, 64)
  const applicant_name = s(body.applicant_name, 200)
  if (!position_id || !applicant_name) return NextResponse.json({ error: 'Name and position are required' }, { status: 400 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Unavailable' }, { status: 500 })

  // IP rate limit: 5 applications per 10 minutes.
  if (await rateLimit(admin, `pub:apply:${clientIp(req)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests — please try again later' }, { status: 429 })
  }

  const { data: pos } = await admin.from('job_positions').select('id, status').eq('id', position_id).maybeSingle()
  if (!pos || pos.status !== 'open') return NextResponse.json({ error: 'This position is no longer open' }, { status: 400 })

  const { error } = await admin.from('job_applications').insert({
    position_id, applicant_name,
    email: s(body.email, 200) || null,
    phone: s(body.phone, 50) || null,
    portfolio_url: s(body.portfolio_url, 500) || null,
    cover_note: s(body.cover_note, 5000) || null,
    status: 'new',
  })
  if (error) return NextResponse.json({ error: 'Could not submit — please try again' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
