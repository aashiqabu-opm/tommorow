import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Public, unauthenticated inquiry intake (line-production / contact / casting / general).
// Inserts via the service-role client — the public never writes to the DB directly.
// Defences: honeypot field + required-field + length caps. (IP rate-limiting: follow-up.)
const KINDS = ['line_production', 'contact', 'casting', 'general']
const s = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }

  // Honeypot — bots fill hidden fields; pretend success and drop it.
  if (s(body.website, 1)) return NextResponse.json({ ok: true })

  const name = s(body.name, 200)
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  const kind = KINDS.includes(String(body.kind)) ? String(body.kind) : 'general'

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Unavailable' }, { status: 500 })

  // IP rate limit: 5 submissions per 10 minutes.
  if (await rateLimit(admin, `pub:inquiry:${clientIp(req)}`, 5, 10 * 60_000)) {
    return NextResponse.json({ error: 'Too many requests — please try again later' }, { status: 429 })
  }

  const { error } = await admin.from('public_inquiries').insert({
    kind, name,
    email: s(body.email, 200) || null,
    phone: s(body.phone, 50) || null,
    company: s(body.company, 200) || null,
    subject: s(body.subject, 300) || null,
    message: s(body.message, 5000) || null,
    project_ref: s(body.project_ref, 200) || null,
    source: s(body.source, 100) || 'website',
  })
  if (error) return NextResponse.json({ error: 'Could not submit — please try again' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
