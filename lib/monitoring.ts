import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp, sendEmail, emailTemplate, whatsappConfigured, emailConfigured } from '@/lib/alerts/channels'
import { escapeHtml } from '@/lib/alerts/deliver'

// Lightweight error monitoring that reuses our existing channels instead of a
// third-party service: every server error is logged, persisted to error_logs,
// and (throttled) pushed to the founder via WhatsApp + email. So failures —
// broken crons, failed bill extraction, AI timeouts — surface instead of dying
// silently. Swap in Sentry later if richer traces are ever needed.

// In-memory throttle so a flapping error can't spam alerts. Resets per cold
// start, which is fine — we still persist every occurrence to error_logs.
const lastAlertAt: Record<string, number> = {}
const ALERT_THROTTLE_MS = 10 * 60 * 1000 // one alert per context per 10 min

export async function reportError(
  context: string,
  err: unknown,
  meta?: Record<string, unknown>,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : undefined
  // Always log — shows up in Vercel function logs regardless of channels.
  console.error(`[reportError] ${context}: ${message}`, stack ?? '', meta ?? '')

  const admin = createAdminClient()
  if (!admin) return

  // Persist every occurrence (best-effort).
  try {
    await admin.from('error_logs').insert({
      context,
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 6000) ?? null,
      meta: meta ?? null,
    })
  } catch { /* table missing or transient — don't mask the original error */ }

  // Throttle outbound alerts per context.
  const now = Date.now()
  if (lastAlertAt[context] && now - lastAlertAt[context] < ALERT_THROTTLE_MS) return
  lastAlertAt[context] = now

  if (!whatsappConfigured() && !emailConfigured()) return
  try {
    const { data: founders } = await admin
      .from('profiles')
      .select('full_name, email, whatsapp_number, email_alerts, whatsapp_alerts')
      .eq('role', 'founder')
      .eq('is_active', true)
    if (!founders?.length) return

    const waText = `⚠️ OPM Office error\n${context}\n${message}`.slice(0, 1000)
    const html = emailTemplate(
      'OPM Office — system error',
      `<p style="margin:0 0 8px;"><strong>${escapeHtml(context)}</strong></p>` +
        `<pre style="margin:0;white-space:pre-wrap;font-size:13px;color:#b91c1c;">${escapeHtml(message)}</pre>` +
        (meta ? `<p style="margin:12px 0 0;color:#666;font-size:12px;">${escapeHtml(JSON.stringify(meta))}</p>` : ''),
    )
    for (const f of founders) {
      if (f.whatsapp_alerts && f.whatsapp_number) await sendWhatsApp(f.whatsapp_number, waText)
      if (f.email_alerts && f.email) await sendEmail(f.email, 'OPM Office — system error', html)
    }
  } catch { /* alerting must never throw */ }
}

// Wrap a cron handler so any failure is reported (and re-thrown so the platform
// still records a failed invocation). Usage:
//   export const GET = (req) => withCronErrorAlert('ai-briefing', () => run(req))
export async function withCronErrorAlert<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    await reportError(`cron/${name}`, e)
    throw e
  }
}
