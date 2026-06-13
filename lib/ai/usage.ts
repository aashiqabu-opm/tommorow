import { createAdminClient } from '@/lib/supabase/admin'

// AI usage metering + monthly cap. Each AI call logs one row; a configurable
// monthly cap (app_settings.ai_monthly_cap) lets finance bound the spend.
// Web-search calls cost more, so 'feature' is recorded to refine later.

function monthStartISO(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

// Record one AI call. Silent on failure (never block the feature on logging).
export async function recordAiUse(feature: string): Promise<void> {
  try {
    const admin = createAdminClient()
    if (!admin) return
    await admin.from('ai_usage').insert({ feature })
  } catch { /* noop */ }
}

// Returns { over, used, cap }. cap = 0/undefined means no cap (always allowed).
export async function aiUsage(): Promise<{ over: boolean; used: number; cap: number }> {
  try {
    const admin = createAdminClient()
    if (!admin) return { over: false, used: 0, cap: 0 }
    const [{ count }, { data: setting }] = await Promise.all([
      admin.from('ai_usage').select('*', { count: 'exact', head: true }).gte('created_at', monthStartISO()),
      admin.from('app_settings').select('value').eq('key', 'ai_monthly_cap').maybeSingle(),
    ])
    const cap = parseInt(setting?.value ?? '') || 0
    const used = count ?? 0
    return { over: cap > 0 && used >= cap, used, cap }
  } catch { return { over: false, used: 0, cap: 0 } }
}
