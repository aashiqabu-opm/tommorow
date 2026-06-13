import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_ROLES = ['accountant', 'general_manager', 'executive_producer', 'legal_viewer', 'staff']

// Invite a new user by email. Founder-only. Uses the service-role admin client
// to send a Supabase magic-link invite; the new user sets their own password.
// We NEVER create accounts silently or set passwords on anyone's behalf.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: caller } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!caller?.is_active || caller.role !== 'founder') {
    return NextResponse.json({ error: 'Only the founder can invite users' }, { status: 403 })
  }

  let payload: { email?: unknown; full_name?: unknown; role?: unknown }
  try { payload = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
  const full_name = typeof payload.full_name === 'string' ? payload.full_name.trim() : ''
  const role = typeof payload.role === 'string' ? payload.role : ''

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 })
  if (!full_name) return NextResponse.json({ error: 'Enter a name' }, { status: 400 })
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: 'Pick a valid role' }, { status: 400 })

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({
      error: 'Invites need the SUPABASE_SERVICE_ROLE_KEY env var on the server. Add it in Vercel → Settings → Environment Variables, then redeploy.',
    }, { status: 503 })
  }

  const origin = new URL(request.url).origin
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role },
    redirectTo: `${origin}/login`,
  })

  if (error) {
    const msg = /already.*registered|already been registered/i.test(error.message)
      ? 'That email already has an account.'
      : error.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({ ok: true, userId: data.user?.id, email })
}
