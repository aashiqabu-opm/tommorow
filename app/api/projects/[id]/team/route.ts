import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail, mailerConfigured } from '@/lib/mailer'
import { emailTemplate } from '@/lib/alerts/channels'
import { sendWhatsApp, whatsappConfigured } from '@/lib/alerts/channels'

export const dynamic = 'force-dynamic'

const ROLES = ['pre_production', 'production', 'post_production']

// A friendly, typo-resistant temporary password (no ambiguous chars).
function tempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `OPM-${s}-${Math.floor(1000 + Math.random() * 9000)}`
}

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

  // Provision a project-scoped login (staff) and deliver credentials ourselves
  // over Gmail SMTP / WhatsApp — Supabase's built-in invite email needs custom
  // SMTP that isn't set up, so it silently never arrives.
  let invited = false
  const channels: { email: boolean; whatsapp: boolean } = { email: false, whatsapp: false }
  let inviteNote: string | null = null

  if (email && !user_id) {
    const admin = createAdminClient()
    if (!admin) {
      inviteNote = 'Login not created — service role key missing on the server.'
    } else {
      const origin = new URL(request.url).origin
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin
      const pwd = tempPassword()
      // Create the account with the temp password already set + email confirmed,
      // so they can sign in immediately at /login (no SMTP round-trip needed).
      const { error: cErr } = await admin.auth.admin.createUser({
        email, password: pwd, email_confirm: true,
        user_metadata: { full_name: name, role: 'staff' },
      })
      const alreadyExists = cErr ? /already.*(registered|exist)/i.test(cErr.message) : false

      const projName = (await supabase.from('projects').select('name').eq('id', id).single()).data?.name ?? 'the project'

      // Compose the message. New users get credentials; existing users get a heads-up.
      const subject = alreadyExists ? `You've been added to ${projName} — OPM Office`
        : `Your OPM Office login for ${projName}`
      const lines = alreadyExists
        ? `<p>Hi ${name},</p><p>You've been added to <b>${projName}</b> on OPM Office. Sign in with your existing OPM Office password.</p>`
        : `<p>Hi ${name},</p><p>You've been added to <b>${projName}</b> on OPM Office. Here's your login:</p>
           <p style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:12px 16px;">
             <b>Email:</b> ${email}<br/><b>Temporary password:</b> <code style="font-size:15px;">${pwd}</code>
           </p>
           <p>Sign in at <a href="${appUrl}/login">${appUrl}/login</a> and change your password from Settings.</p>`
      const html = emailTemplate(subject, lines)

      if (mailerConfigured()) channels.email = await sendMail(email, subject, html)

      if (phone && whatsappConfigured()) {
        const waText = alreadyExists
          ? `OPM Office: You've been added to ${projName}. Sign in at ${appUrl}/login with your existing password.`
          : `OPM Office: You're on the ${projName} team.\nLogin: ${appUrl}/login\nEmail: ${email}\nTemp password: ${pwd}\n(Please change it after first sign-in.)`
        channels.whatsapp = await sendWhatsApp(phone, waText)
      }

      invited = !cErr || alreadyExists
      if (cErr && !alreadyExists) inviteNote = `Couldn't create login: ${cErr.message.slice(0, 100)}`
      else if (!channels.email && !channels.whatsapp) {
        inviteNote = mailerConfigured()
          ? 'Login created, but the invite could not be delivered — check email/WhatsApp settings.'
          : 'Login created, but no email/WhatsApp sender is configured on the server.'
      }
    }
  }

  return NextResponse.json({ ok: true, member, invited, channels, inviteNote })
}
