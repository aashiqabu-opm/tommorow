import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Checks liabilities due within 7 days and documents expiring within 30 days.
 * Inserts notifications for founder+accountant users if not already notified within 3 days.
 * Called once per session (guarded by sessionStorage).
 */
export async function runReminderSweep(supabase: SupabaseClient, role: string) {
  // Only run for finance roles
  if (role !== 'founder' && role !== 'accountant') return

  // Guard: run only once per session
  if (typeof sessionStorage !== 'undefined') {
    if (sessionStorage.getItem('opm_reminders_run')) return
    sessionStorage.setItem('opm_reminders_run', '1')
  }

  try {
    const today = new Date()
    const in7Days = new Date(today.getTime() + 7 * 86400000)
    const in30Days = new Date(today.getTime() + 30 * 86400000)
    const ago3Days = new Date(today.getTime() - 3 * 86400000)

    // Fetch liabilities that are not cleared and have a due date
    const { data: liabilities } = await supabase
      .from('liabilities')
      .select('id, party_name, balance_remaining, due_date, status')
      .neq('status', 'cleared')
      .not('due_date', 'is', null)

    // Fetch documents that are not expired and have expiry_date
    const { data: documents } = await supabase
      .from('documents')
      .select('id, title, expiry_date, status')
      .not('expiry_date', 'is', null)
      .not('status', 'eq', 'expired')

    // Fetch founder and accountant profile ids
    const { data: targetProfiles } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['founder', 'accountant'])
      .eq('is_active', true)

    const targetUserIds = (targetProfiles ?? []).map(p => p.id)
    if (targetUserIds.length === 0) return

    // Fetch recent notifications to avoid duplicates (last 3 days)
    const { data: recentNotifs } = await supabase
      .from('notifications')
      .select('entity_type, entity_id')
      .in('user_id', targetUserIds)
      .gte('created_at', ago3Days.toISOString())

    const notifiedSet = new Set(
      (recentNotifs ?? []).map(n => `${n.entity_type}:${n.entity_id}`)
    )

    const notificationsToInsert: {
      user_id: string
      title: string
      body?: string
      entity_type: string
      entity_id: string
    }[] = []

    // Check liabilities
    for (const lib of liabilities ?? []) {
      if (!lib.due_date) continue
      const due = new Date(lib.due_date)
      const key = `liabilities:${lib.id}`
      if (notifiedSet.has(key)) continue

      const diffMs = due.getTime() - today.getTime()
      const diffDays = Math.ceil(diffMs / 86400000)

      let title = ''
      if (diffDays < 0) {
        title = `OVERDUE: ₹${Math.round(lib.balance_remaining).toLocaleString('en-IN')} due to ${lib.party_name}`
        const body = `${Math.abs(diffDays)} days past due`
        for (const uid of targetUserIds) {
          notificationsToInsert.push({ user_id: uid, title, body, entity_type: 'liabilities', entity_id: lib.id })
        }
      } else if (diffDays <= 7) {
        title = `₹${Math.round(lib.balance_remaining).toLocaleString('en-IN')} due to ${lib.party_name} in ${diffDays} day${diffDays === 1 ? '' : 's'}`
        for (const uid of targetUserIds) {
          notificationsToInsert.push({ user_id: uid, title, entity_type: 'liabilities', entity_id: lib.id })
        }
      }
    }

    // Check documents
    for (const doc of documents ?? []) {
      if (!doc.expiry_date) continue
      const expiry = new Date(doc.expiry_date)
      const key = `documents:${doc.id}`
      if (notifiedSet.has(key)) continue

      const diffMs = expiry.getTime() - today.getTime()
      const diffDays = Math.ceil(diffMs / 86400000)

      if (diffDays >= 0 && diffDays <= 30) {
        const title = `Agreement '${doc.title}' expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`
        for (const uid of targetUserIds) {
          notificationsToInsert.push({ user_id: uid, title, entity_type: 'documents', entity_id: doc.id })
        }
      }
    }

    // Batch insert notifications
    if (notificationsToInsert.length > 0) {
      await supabase.from('notifications').insert(notificationsToInsert)
    }
  } catch {
    // Silent fail — reminder sweep should never break the app
  }
}
