import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const ROLES = ['pre_production', 'production', 'post_production']

// Add a crew member to a project's core team (by contact details) and send them
// a project-scoped login. Founder / GM / EP only.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!me?.is_active || !['founder', 'general_manager', 'executive_producer'].includes(me.role)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  let body: { name?: string; email?: string; phone?: string; project_role?: string; team_group?: string; title?: string } = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const phone = (body.phone ?? '').trim()
  const project_role = (body.project_role ?? 'member').trim()
  const team_group = ROLES.includes(body.team_group ?? '') ? body.team_group : 'production'
  const title = (body.title ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Enter a name' }, { status: 400 })
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })

  // Link to an existing app user if the email already has an account
  let user_id: string | null = null
  if (email) {
    const { data: existing } = await supabase.from('profiles').select('id').ilike('email', email).maybeSingle()
    user_id = existing?.id ?? null
  }

  const { data: member, error } = await supabase.from('project_members').insert({
    project_id: id, user_id, project_role, team_group,
    member_name: name, member_email: email || null, member_phone: phone || null,
    title: title || null, added_by: user.id,
  }).select().single()
  if (error) {
    const hint = /relation .*project_members.* does not exist/i.test(error.message) ? 'run migration-crew-teams.sql first'
      : /column .*(member_name|team_group)/i.test(error.message) ? 'run migration-crew-teams.sql first' : error.message
    return NextResponse.json({ error: String(hint).slice(0, 120) }, { status: 400 })
  }

  // Invite a project-scoped login (staff) if they're not already an app user
  let invited = false
  if (email && !user_id) {
    const admin = createAdminClient()
    if (admin) {
      const origin = new URL(request.url).origin
      const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name, role: 'staff' }, redirectTo: `${origin}/login`,
      })
      if (!invErr || /already.*registered/i.test(invErr.message)) invited = true
    }
  }

  return NextResponse.json({ ok: true, member, invited })
}
