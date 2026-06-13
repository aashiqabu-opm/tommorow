import { createAdminClient } from '@/lib/supabase/admin'

// Tracks whether AI is usable, so the app can show the team WHY calls fail
// (most commonly: Anthropic credits exhausted) instead of just blank results.

const KEY = 'ai_credit'

// Recognise the "credit balance too low" family of Anthropic API errors.
export function isCreditError(e: unknown): boolean {
  let msg = ''
  if (typeof e === 'string') msg = e
  else if (e && typeof e === 'object') {
    const o = e as { message?: string; error?: { error?: { message?: string }; message?: string } }
    msg = o.message || o.error?.error?.message || o.error?.message || ''
    if (!msg) { try { msg = JSON.stringify(e) } catch { msg = '' } }
  }
  return /credit balance is too low|too low to access the anthropic api|insufficient.*credit|billing_?error|plans? *& *billing/i.test(msg)
}

// Record that AI is paused due to billing. Idempotent; silent on any failure.
export async function reportCreditIssue(): Promise<void> {
  try {
    const admin = createAdminClient()
    if (!admin) return
    await admin.from('system_status').upsert({
      key: KEY,
      message: 'AI features are paused — the Anthropic API balance is exhausted.',
      detail: 'Top up credits at console.anthropic.com → Billing to restore bill reading, document analysis, Ask OPM and the daily briefing.',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
  } catch { /* noop */ }
}

// Clear the flag after a successful AI call. Idempotent; silent on failure.
export async function clearCreditIssue(): Promise<void> {
  try {
    const admin = createAdminClient()
    if (!admin) return
    await admin.from('system_status').delete().eq('key', KEY)
  } catch { /* noop */ }
}

// Convenience: inspect an error and record/clear accordingly. Returns whether
// it was a credit error.
export async function noteAiResult(errorOrNull: unknown): Promise<boolean> {
  if (errorOrNull && isCreditError(errorOrNull)) { await reportCreditIssue(); return true }
  if (!errorOrNull) await clearCreditIssue()
  return false
}
