import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, sendWhatsApp, emailTemplate, emailConfigured, whatsappConfigured } from '@/lib/alerts/channels'

// Fan an alert out to users via every channel they've enabled.
// Server-side only. Silently does nothing if no provider is configured.
export async function deliverAlert(userIds: string[], title: string, body?: string) {
  if (userIds.length === 0) return
  if (!emailConfigured() && !whatsappConfigured()) return

  const admin = createAdminClient()
  if (!admin) return

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name, email_alerts, whatsapp_alerts, whatsapp_number')
    .in('id', userIds)
    .eq('is_active', true)

  if (!profiles || profiles.length === 0) return

  const html = emailTemplate(title, body ? `<p style="margin:0;">${escapeHtml(body)}</p>` : '')
  const text = body ? `*OPM Office*\n${title}\n${body}` : `*OPM Office*\n${title}`

  await Promise.allSettled(
    profiles.flatMap((p) => {
      const jobs: Promise<boolean>[] = []
      if (p.email_alerts && p.email) {
        jobs.push(sendEmail(p.email, `OPM Office — ${title}`, html))
      }
      if (p.whatsapp_alerts && p.whatsapp_number) {
        jobs.push(sendWhatsApp(p.whatsapp_number, text))
      }
      return jobs
    })
  )
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
