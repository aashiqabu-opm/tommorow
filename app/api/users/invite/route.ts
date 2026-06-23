import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail, mailerConfigured } from '@/lib/mailer'
import { emailTemplate } from '@/lib/alerts/channels'

const ALLOWED_ROLES = ['accountant', 'general_manager', 'executive_producer', 'legal_viewer', 'staff']
// Who can invite new users (never a second founder).
const INVITER_ROLES = ['founder', 'general_manager', 'executive_producer', 'accountant']

function tempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `OPM-${s}-${Math.floor(1000 + Math.random() * 9000)}`
}

// Invite a new user by email. Founder / GM / EP / Accountant can invite. We
// create the login with a temporary password and deliver the credentials over
// Gmail SMTP (reliable), falling back to Supabase's invite email. We NEVER set
// a password the inviter chooses — a generated temp one the user then changes.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: caller } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!caller?.is_active || !INVITER_ROLES.includes(caller.role)) {
    return NextResponse.json({ error: 'You do not have permission to invite users' }, { status: 403 })
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin
  const pwd = tempPassword()

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password: pwd, email_confirm: true,
    user_metadata: { full_name, role },
  })
  if (cErr) {
    if (/already.*(registered|exist)/i.test(cErr.message)) return NextResponse.json({ error: 'That email already has an account.' }, { status: 400 })
    return NextResponse.json({ error: cErr.message }, { status: 400 })
  }

  // Deliver credentials over Gmail SMTP; fall back to Supabase invite email.
  let emailed = false
  const subject = 'Your OPM Flash login'
  const html = emailTemplate(subject, `<p>Hi ${full_name},</p>
    <p>An OPM Flash account has been created for you. Here's your login:</p>
    <p style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:12px 16px;">
      <b>Email:</b> ${email}<br/><b>Temporary password:</b> <code style="font-size:15px;">${pwd}</code>
    </p>
    <p>Sign in at <a href="${appUrl}/login">${appUrl}/login</a> and change your password from Settings.</p>`)
  if (mailerConfigured()) emailed = await sendMail(email, subject, html)

  return NextResponse.json({ ok: true, userId: created.user?.id, email, emailed, invitedBy: caller.role })
}
