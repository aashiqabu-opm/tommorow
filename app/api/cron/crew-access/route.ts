import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withCronErrorAlert } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

// Daily: deactivate crew (staff) logins once ALL their projects released > 7
// days ago. Kept active if they're on any project not yet past that window.
export async function GET(request: Request) {
  return withCronErrorAlert('crew-access', () => run(request))
}
async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })

  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10) // released on/before this = expired

  const [{ data: staff }, { data: links }] = await Promise.all([
    admin.from('profiles').select('id, email').eq('role', 'staff').eq('is_active', true),
    admin.from('project_members').select('user_id, member_email, project:projects(release_date)'),
  ])
  if (!staff?.length) return NextResponse.json({ ok: true, deactivated: 0 })

  const L = (links ?? []) as Row[]
  const expired: string[] = []

  for (const s of staff as Row[]) {
    const mine = L.filter(l => l.user_id === s.id || (l.member_email && s.email && l.member_email.toLowerCase() === s.email.toLowerCase()))
    if (mine.length === 0) continue // not assigned to any project — leave alone
    // Active if ANY project has no release date or released within the last 7 days
    const stillActive = mine.some(l => {
      const rd = l.project?.release_date
      return !rd || rd > cutoff
    })
    if (!stillActive) expired.push(s.id)
  }

  if (expired.length) {
    await admin.from('profiles').update({ is_active: false, updated_at: new Date().toISOString() }).in('id', expired)
  }
  return NextResponse.json({ ok: true, deactivated: expired.length })
}
