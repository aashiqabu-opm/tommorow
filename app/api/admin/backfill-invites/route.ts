import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMail, mailerConfigured } from '@/lib/mailer'
import { emailTemplate, sendWhatsApp, whatsappConfigured } from '@/lib/alerts/channels'

export const dynamic = 'force-dynamic'

// TEMPORARY one-off endpoint: (re)send project logins to everyone already on a
// core team who has an email but never received a working invite. Protected by
// BACKFILL_SECRET. Remove this route after running.

function tempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `OPM-${s}-${Math.floor(1000 + Math.random() * 9000)}`
}

export async function POST(request: Request) {
  const secret = process.env.BACKFILL_SECRET
  const given = request.headers.get('x-backfill-secret')
  if (!secret || given !== secret) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'No service role key' }, { status: 500 })

  const url = new URL(request.url)
  const dry = url.searchParams.get('dry') === '1'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin

  // Pull every core-team member with an email, across all projects.
  const { data: members, error } = await admin
    .from('project_members')
    .select('id, member_name, member_email, member_phone, project_id, projects(name)')
    .not('member_email', 'is', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: Array<Record<string, unknown>> = []

  for (const m of members ?? []) {
    const email = String(m.member_email).trim().toLowerCase()
    const name = m.member_name ?? email.split('@')[0]
    const phone = m.member_phone ?? ''
    const projName = (m.projects as { name?: string } | null)?.name ?? 'the project'
    const row: Record<string, unknown> = { email, name, project: projName }

    if (dry) { results.push({ ...row, action: 'would-send' }); continue }

    // Find an existing auth user by email; create one if absent, else reset pwd.
    let existed = false
    let userId: string | null = null
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const found = list?.users?.find(u => (u.email ?? '').toLowerCase() === email)
    const pwd = tempPassword()
    if (found) {
      existed = true; userId = found.id
      await admin.auth.admin.updateUserById(found.id, { password: pwd })
    } else {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password: pwd, email_confirm: true,
        user_metadata: { full_name: name, role: 'staff' },
      })
      if (cErr) { results.push({ ...row, error: cErr.message.slice(0, 100) }); continue }
      userId = created.user?.id ?? null
    }

    // Link the membership row to the login if it isn't already.
    if (userId) await admin.from('project_members').update({ user_id: userId }).eq('id', m.id)

    const subject = `Your OPM Office login for ${projName}`
    const html = emailTemplate(subject, `<p>Hi ${name},</p>
      <p>You're on the <b>${projName}</b> team on OPM Office. Here's your login:</p>
      <p style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:12px 16px;">
        <b>Email:</b> ${email}<br/><b>Password:</b> <code style="font-size:15px;">${pwd}</code>
      </p>
      <p>Sign in at <a href="${appUrl}/login">${appUrl}/login</a> and change your password from Settings.</p>
      ${existed ? '<p style="color:#71717a;font-size:12px;">(Your password has been reset to the one above.)</p>' : ''}`)

    let emailed = false, whatsapped = false
    if (mailerConfigured()) emailed = await sendMail(email, subject, html)
    if (phone && whatsappConfigured()) {
      whatsapped = await sendWhatsApp(phone,
        `OPM Office: You're on the ${projName} team.\nLogin: ${appUrl}/login\nEmail: ${email}\nPassword: ${pwd}\n(Please change it after first sign-in.)`)
    }
    results.push({ ...row, existed, emailed, whatsapped })
  }

  const sent = results.filter(r => r.emailed || r.whatsapped).length
  return NextResponse.json({ ok: true, total: results.length, sent, results })
}
