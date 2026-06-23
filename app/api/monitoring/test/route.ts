import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportError } from '@/lib/monitoring'
import { whatsappConfigured, emailConfigured } from '@/lib/alerts/channels'

export const dynamic = 'force-dynamic'

// Diagnostic: deliberately fires the error-monitoring chain so we can confirm
// that server errors actually surface (persisted to error_logs + WhatsApp/email
// to founders) instead of dying silently. Founder-only. Open
// https://<app>/api/monitoring/test in a logged-in founder browser tab.
//
// Note: reportError throttles outbound alerts to one per context per 10 min, so
// a second run within 10 minutes still logs to error_logs but may not re-send
// the WhatsApp/email. The persisted-row check below always reflects reality.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first, then open this URL again' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, role, is_active')
    .eq('id', user.id)
    .single()
  if (!profile?.is_active) return NextResponse.json({ error: 'No active profile' }, { status: 401 })
  if (profile.role !== 'founder') {
    return NextResponse.json({ error: 'Founder only' }, { status: 403 })
  }

  const nonce = `selftest-${Date.now()}`

  // Fire the real monitoring chain. This is a deliberate, harmless test error.
  await reportError(
    'diagnostic/self-test',
    new Error(`Monitoring self-test (${nonce}) — deliberate test, no action needed.`),
    { nonce, triggeredBy: profile.email },
  )

  // Confirm it actually persisted to error_logs (proves the log half of the chain).
  let persisted: unknown = 'could not verify — admin client unavailable'
  const admin = createAdminClient()
  if (admin) {
    const { data, error } = await admin
      .from('error_logs')
      .select('id, context, message, created_at')
      .contains('meta', { nonce })
      .limit(1)
      .maybeSingle()
    persisted = error ? { error: error.message } : (data ?? 'NOT FOUND — error_logs insert may be failing')
  }

  return NextResponse.json({
    ok: true,
    nonce,
    persisted_to_error_logs: persisted,
    channels: {
      whatsapp_configured: whatsappConfigured(),
      email_configured: emailConfigured(),
    },
    note:
      'A founder with active alerts should receive a WhatsApp + email titled "OPM Flash — system error". ' +
      'If you ran this twice within 10 minutes, the alert is throttled but the log row above still proves persistence.',
  })
}
