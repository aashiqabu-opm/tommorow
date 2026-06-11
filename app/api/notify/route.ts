import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deliverAlert } from '@/lib/alerts/deliver'

// Instant outbound alerts. Called fire-and-forget by lib/notifications.ts
// right after in-app notifications are inserted. Caller must be an active user.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: caller } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', user.id)
    .single()
  if (!caller?.is_active) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: { userIds?: unknown; title?: unknown; body?: unknown }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const userIds = Array.isArray(payload.userIds)
    ? payload.userIds.filter((id): id is string => typeof id === 'string').slice(0, 50)
    : []
  const title = typeof payload.title === 'string' ? payload.title.slice(0, 200) : ''
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 1000) : undefined

  if (userIds.length === 0 || !title) {
    return NextResponse.json({ error: 'userIds and title required' }, { status: 400 })
  }

  await deliverAlert(userIds, title, body)
  return NextResponse.json({ ok: true })
}
