import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, sendWhatsApp, emailTemplate, normalizeWhatsApp, emailConfigured, whatsappConfigured, sleep, EMAIL_THROTTLE_MS } from '@/lib/alerts/channels'

export const dynamic = 'force-dynamic'

// Founder-only: sends a clearly-labelled TEST email + WhatsApp to every active
// user and returns a per-recipient delivery report. Open in a logged-in
// browser: /api/alerts/test-broadcast
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'founder') {
    return NextResponse.json({ error: 'Founder only' }, { status: 403 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })

  const { data: profiles } = await admin
    .from('profiles')
    .select('full_name, email, whatsapp_alerts, whatsapp_number')
    .eq('is_active', true)
    .order('full_name')

  const html = emailTemplate(
    'Test alert ✓',
    '<p style="margin:0;">This is a test of OPM Flash alerts. If you can read this, your <strong>email alerts</strong> are working. No action needed.</p>'
  )
  const waText = '*OPM Flash — Test* ✓\nThis is a test of OPM Flash WhatsApp alerts. If you got this, you are all set. No action needed.'

  // Sequential with a throttle so we stay under Resend's ~2/sec rate limit.
  const list = profiles ?? []
  const results: Record<string, unknown>[] = []
  for (let i = 0; i < list.length; i++) {
    const p = list[i]
    const r: Record<string, unknown> = { name: p.full_name, email: p.email }
    if (emailConfigured() && p.email) {
      r.email_sent = await sendEmail(p.email, 'OPM Flash — Test alert ✓', html)
    } else {
      r.email_sent = 'skipped'
    }
    if (!p.whatsapp_number) {
      r.whatsapp = 'no number'
    } else if (!p.whatsapp_alerts) {
      r.whatsapp = 'alerts off'
    } else if (!whatsappConfigured()) {
      r.whatsapp = 'twilio not configured'
    } else {
      r.whatsapp = (await sendWhatsApp(normalizeWhatsApp(p.whatsapp_number), waText))
        ? 'sent (delivers only if joined to sandbox)'
        : 'send failed'
    }
    results.push(r)
    if (i < list.length - 1) await sleep(EMAIL_THROTTLE_MS)
  }

  return NextResponse.json({
    ok: true,
    recipients: results.length,
    email_provider: emailConfigured(),
    whatsapp_provider: whatsappConfigured(),
    results,
  })
}
