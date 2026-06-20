// Email delivery shim. The real engine now lives in lib/alerts/channels.ts —
// Gmail SMTP primary (delivers to ANY recipient, no domain verification needed),
// Resend fallback. This file is kept so existing callers that import
// `sendMail` / `mailerConfigured` keep working through the same unified path.
export {
  sendEmail as sendMail,
  emailConfigured as mailerConfigured,
  gmailConfigured,
} from '@/lib/alerts/channels'
