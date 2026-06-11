import { createClient } from '@/lib/supabase/client'

export async function logAction(
  action: string,
  entityType: string,
  entityId: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
) {
  const supabase = createClient()
  // getSession() reads the local session — no auth-server round-trip per
  // logged action (RLS still validates the JWT when the insert hits the DB).
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return

  await supabase.from('audit_logs').insert({
    user_id: session.user.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_values: oldValues ?? null,
    new_values: newValues ?? null,
  })
}
