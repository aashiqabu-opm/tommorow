import { createClient } from '@/lib/supabase/client'
import { categoryFor } from '@/lib/alerts/categories'

export async function notifyUsers(
  userIds: string[],
  title: string,
  body?: string,
  entityType?: string,
  entityId?: string
) {
  if (userIds.length === 0) return
  const supabase = createClient()
  await supabase.from('notifications').insert(
    userIds.map((user_id) => ({
      user_id,
      title,
      body: body ?? null,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
    }))
  )
  // Fire-and-forget outbound email/WhatsApp — never blocks or breaks the UI
  try {
    void fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds, title, body, category: categoryFor(entityType) }),
      keepalive: true,
    })
  } catch {
    // ignore
  }
}

// Notify all active founder + accountant users (optionally excluding the actor)
export async function notifyFinance(
  title: string,
  body?: string,
  entityType?: string,
  entityId?: string,
  excludeUserId?: string
) {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['founder', 'accountant'])
    .eq('is_active', true)
  const ids = (data ?? []).map((p) => p.id).filter((id) => id !== excludeUserId)
  await notifyUsers(ids, title, body, entityType, entityId)
}
