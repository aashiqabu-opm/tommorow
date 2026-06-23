import nodemailer from 'nodemailer'

// Outbound alert channels. Each channel is a no-op until its env vars are set,
// so the app works without any provider configured.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://opmoffice.vercel.app'

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Resend free tier allows ~2 emails/sec. A 600ms gap between sends keeps
// multi-recipient fan-outs (digests, broadcasts) under the limit so none
// get throttled (HTTP 429).
export const EMAIL_THROTTLE_MS = 600

export function gmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
}

export function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
}

// Email is configured if EITHER provider is available.
export function emailConfigured() {
  return gmailConfigured() || resendConfigured()
}

export function whatsappConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM
  )
}

let gmailTransport: nodemailer.Transporter | null = null
function gmailTransporter() {
  if (gmailTransport) return gmailTransport
  gmailTransport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: (process.env.GMAIL_APP_PASSWORD ?? '').replace(/\s+/g, ''), // app passwords are shown with spaces
    },
  })
  return gmailTransport
}

async function sendViaResend(to: string, subject: string, html: string): Promise<boolean> {
  if (!resendConfigured()) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? 'OPM Flash <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// Send an HTML email. Gmail SMTP is the primary path (delivers to ANY recipient,
// no domain verification needed); Resend is the fallback. Returns true on success.
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (gmailConfigured()) {
    try {
      await gmailTransporter().sendMail({ from: `OPM Flash <${process.env.GMAIL_USER}>`, to, subject, html })
      return true
    } catch {
      // fall through to Resend
    }
  }
  return sendViaResend(to, subject, html)
}

// Strip spaces, dashes, parens etc. → E.164 (leading + then digits only),
// so staff can enter numbers in whatever format feels natural.
export function normalizeWhatsApp(num: string): string {
  const cleaned = num.replace(/[^\d+]/g, '')
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`
}

export async function sendWhatsApp(toNumber: string, text: string): Promise<boolean> {
  if (!whatsappConfigured()) return false
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
    const body = new URLSearchParams({
      From: process.env.TWILIO_WHATSAPP_FROM!,
      To: `whatsapp:${normalizeWhatsApp(toNumber)}`,
      Body: text,
    })
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    return res.ok
  } catch {
    return false
  }
}

// Send a pre-approved WhatsApp template (required for business-initiated
// messages outside the 24h customer-service window once we move off the Twilio
// sandbox onto a verified WhatsApp Business number). `contentSid` is the
// approved Content Template SID (HXxxxx); `vars` maps the template's numbered
// placeholders ({{1}}, {{2}}…) to values. Returns false if Twilio/the SID is
// not configured, so callers can fall back to free-form text.
export async function sendWhatsAppTemplate(
  toNumber: string,
  contentSid: string,
  vars: Record<string, string>,
): Promise<boolean> {
  if (!whatsappConfigured() || !contentSid) return false
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
    const body = new URLSearchParams({
      From: process.env.TWILIO_WHATSAPP_FROM!,
      To: `whatsapp:${normalizeWhatsApp(toNumber)}`,
      ContentSid: contentSid,
      ContentVariables: JSON.stringify(vars),
    })
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    return res.ok
  } catch {
    return false
  }
}

// Minimal branded email wrapper — light background for email-client compatibility.
export function emailTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr><td style="background:#0a0a0f;padding:20px 28px;">
          <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:2px;">OPM&nbsp;OFFICE</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h2 style="margin:0 0 12px;font-size:18px;color:#18181b;">${title}</h2>
          <div style="font-size:14px;line-height:1.6;color:#3f3f46;">${bodyHtml}</div>
          <div style="margin-top:24px;">
            <a href="${APP_URL}" style="display:inline-block;background:#0a0a0f;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:8px;">Open OPM Flash</a>
          </div>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e4e4e7;">
          <span style="font-size:11px;color:#a1a1aa;">OPM Cinemas internal system — manage alert preferences in Settings.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
