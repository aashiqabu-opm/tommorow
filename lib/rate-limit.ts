import type { SupabaseClient } from '@supabase/supabase-js'

// Fixed-window per-key rate limit backed by the wa_rate_limit table (serverless
// functions share no memory, so the counter must live in the DB). Low-volume
// use, so the tiny read-then-write race is acceptable. Returns true if the
// caller is OVER the limit and should be turned away.
export async function isRateLimited(
  admin: SupabaseClient,
  key: string,
  max = 10,
  windowMs = 60_000,
): Promise<boolean> {
  const now = Date.now()
  try {
    const { data } = await admin
      .from('wa_rate_limit')
      .select('count, window_start')
      .eq('phone', key)
      .maybeSingle()

    // New key, or the previous window has expired → start a fresh window.
    if (!data || now - new Date(data.window_start).getTime() > windowMs) {
      await admin
        .from('wa_rate_limit')
        .upsert({ phone: key, count: 1, window_start: new Date(now).toISOString() })
      return false
    }

    if (data.count >= max) return true

    await admin.from('wa_rate_limit').update({ count: data.count + 1 }).eq('phone', key)
    return false
  } catch {
    // Never block legitimate traffic because the limiter itself failed.
    return false
  }
}
