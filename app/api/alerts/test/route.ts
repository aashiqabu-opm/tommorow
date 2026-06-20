import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { emailTemplate, whatsappConfigured, normalizeWhatsApp, sendEmail, emailConfigured, gmailConfigured } from '@/lib/alerts/channels'

export const dynamic = 'force-dynamic'

// Diagnostic: sends a test alert to the signed-in user and reports the raw
// provider responses, so delivery problems are visible instead of silent.
// Open https://<app>/api/alerts/test in a logged-in browser tab.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first, then open this URL again' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, email_alerts, whatsapp_alerts, whatsapp_number, is_active')
    .eq('id', user.id)
    .single()
  if (!profile?.is_active) return NextResponse.json({ error: 'No active profile' }, { status: 401 })

  const report: Record<string, unknown> = {
    config: {
      EMAIL: emailConfigured(),
      GMAIL_SMTP: gmailConfigured(),
      RESEND_API_KEY: Boolean(process.env.RESEND_API_KEY),
      RESEND_FROM: process.env.RESEND_FROM ?? '(default: onboarding@resend.dev)',
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      CRON_SECRET: Boolean(process.env.CRON_SECRET),
      TWILIO: whatsappConfigured(),
      TWILIO_ACCOUNT_SID: Boolean(process.env.TWILIO_ACCOUNT_SID),
      TWILIO_AUTH_TOKEN: Boolean(process.env.TWILIO_AUTH_TOKEN),
      TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM ?? '(not set)',
    },
    your_profile: {
      email: profile.email,
      email_alerts: profile.email_alerts,
      whatsapp_alerts: profile.whatsapp_alerts,
      whatsapp_number: profile.whatsapp_number ? 'set' : 'not set',
    },
  }

  // Email test — uses the unified sender (Gmail SMTP primary, Resend fallback).
  if (emailConfigured()) {
    try {
      const ok = await sendEmail(
        profile.email,
        'OPM Office — Test alert ✓',
        emailTemplate('Test alert', `<p style="margin:0;">Hi ${profile.full_name}, if you can read this, email alerts are working.</p>`),
      )
      report.email_test = { sent: ok, via: gmailConfigured() ? 'gmail-smtp' : 'resend' }
    } catch (e) {
      report.email_test = { error: String(e) }
    }
  } else {
    report.email_test = 'skipped — no email provider configured (set GMAIL_APP_PASSWORD or RESEND_API_KEY)'
  }

  // WhatsApp test — only if configured and the caller has a number
  if (whatsappConfigured() && profile.whatsapp_number) {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID!
      const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          From: process.env.TWILIO_WHATSAPP_FROM!,
          To: `whatsapp:${normalizeWhatsApp(profile.whatsapp_number)}`,
          Body: '*OPM Office* — Test alert ✓ WhatsApp alerts are working.',
        }),
      })
      const twilioBody = (await res.json().catch(() => null)) as { message?: string; status?: string } | null
      report.whatsapp_test = { status: res.status, message: twilioBody?.message ?? twilioBody?.status ?? null }
    } catch (e) {
      report.whatsapp_test = { error: String(e) }
    }
  } else {
    report.whatsapp_test = whatsappConfigured() ? 'skipped — add your WhatsApp number first' : 'skipped — Twilio not configured'
  }

  return NextResponse.json(report)
}
