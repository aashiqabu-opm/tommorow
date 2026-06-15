import nodemailer from 'nodemailer'
import { sendEmail as sendViaResend, emailConfigured as resendConfigured } from '@/lib/alerts/channels'

// Email delivery. Primary path is Gmail SMTP using the same app-password the
// mailbox sync already uses — it delivers to ANY recipient and needs no domain
// verification. Resend is a fallback when Gmail isn't configured.

export function gmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
}

export function mailerConfigured() {
  return gmailConfigured() || resendConfigured()
}

let cached: nodemailer.Transporter | null = null
function transporter() {
  if (cached) return cached
  cached = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: (process.env.GMAIL_APP_PASSWORD ?? '').replace(/\s+/g, ''), // app passwords are shown with spaces
    },
  })
  return cached
}

// Send an HTML email. Returns true on success. Tries Gmail first, then Resend.
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (gmailConfigured()) {
    try {
      const from = `OPM Office <${process.env.GMAIL_USER}>`
      await transporter().sendMail({ from, to, subject, html })
      return true
    } catch {
      // fall through to Resend
    }
  }
  if (resendConfigured()) return sendViaResend(to, subject, html)
  return false
}
