import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, sendWhatsApp, emailTemplate, emailConfigured, whatsappConfigured, sleep, EMAIL_THROTTLE_MS } from '@/lib/alerts/channels'
import { CATEGORY_LABELS, type AlertCategory } from '@/lib/alerts/categories'

// Fan an alert out to users via every channel they've enabled, skipping
// anyone who muted the category. Email carries everything; WhatsApp is
// reserved for important alerts. Server-side only. Silently does nothing
// if no provider is configured.
export async function deliverAlert(
  userIds: string[],
  title: string,
  body?: string,
  category: AlertCategory = 'general',
  important = false
) {
  if (userIds.length === 0) return
  if (!emailConfigured() && !whatsappConfigured()) return

  const admin = createAdminClient()
  if (!admin) return

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name, email_alerts, whatsapp_alerts, whatsapp_number, muted_categories')
    .in('id', userIds)
    .eq('is_active', true)

  if (!profiles || profiles.length === 0) return

  const recipients = profiles.filter(
    (p) => !(p.muted_categories ?? []).includes(category)
  )
  if (recipients.length === 0) return

  const tag = CATEGORY_LABELS[category]
  const html = emailTemplate(title, body ? `<p style="margin:0;">${escapeHtml(body)}</p>` : '')
  const text = body ? `*OPM Office · ${tag}*\n${title}\n${body}` : `*OPM Office · ${tag}*\n${title}`

  // Sequential with a throttle so larger recipient lists stay under
  // Resend's ~2/sec rate limit (otherwise some sends get a 429).
  for (let i = 0; i < recipients.length; i++) {
    const p = recipients[i]
    if (p.email_alerts && p.email) {
      await sendEmail(p.email, `OPM Office [${tag}] — ${title}`, html)
    }
    if (important && p.whatsapp_alerts && p.whatsapp_number) {
      await sendWhatsApp(p.whatsapp_number, text)
    }
    if (i < recipients.length - 1) await sleep(EMAIL_THROTTLE_MS)
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
