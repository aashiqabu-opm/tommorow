import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailTemplate, emailConfigured } from '@/lib/alerts/channels'
import { escapeHtml } from '@/lib/alerts/deliver'
import { withCronErrorAlert } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

// Daily: roll KDM status from validity window, then alert the team about any KDM
// already expired or expiring within 7 days (a dark theatre at showtime is the risk).
export async function GET(request: Request) {
  return withCronErrorAlert('kdm-expiry', () => run(request))
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })

  const today = new Date().toISOString().slice(0, 10)
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  // status rollover (only touch rows that need it)
  const { count: expiredCount } = await admin.from('kdm')
    .update({ status: 'expired', updated_at: new Date().toISOString() }, { count: 'exact' })
    .lt('valid_to', today).neq('status', 'expired').not('valid_to', 'is', null)
  const { count: soonCount } = await admin.from('kdm')
    .update({ status: 'expiring', updated_at: new Date().toISOString() }, { count: 'exact' })
    .gte('valid_to', today).lte('valid_to', in7).neq('status', 'expiring')

  const { data: flagged } = await admin.from('kdm')
    .select('theatre_name, theatre_location, valid_to, project:projects(name)')
    .lte('valid_to', in7).not('valid_to', 'is', null)
    .order('valid_to', { ascending: true })

  const rows = (flagged ?? []) as Row[]
  if (!rows.length) return NextResponse.json({ ok: true, expired: expiredCount ?? 0, expiring: soonCount ?? 0, alerted: false })

  let emailed = 0
  if (emailConfigured()) {
    const { data: team } = await admin.from('profiles')
      .select('email, email_alerts, is_active')
      .in('role', ['founder', 'accountant', 'general_manager', 'executive_producer']).eq('is_active', true)
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const items = rows.map(r => {
      const state = r.valid_to < today ? '⚠️ Expired' : 'Expiring'
      const where = [r.project?.name, r.theatre_name, r.theatre_location].filter(Boolean).join(' — ')
      return `<li style="margin:0 0 6px;"><b>${escapeHtml(state)}</b> — ${escapeHtml(where)} (valid to ${escapeHtml(r.valid_to)})</li>`
    }).join('')
    const html = emailTemplate(`KDM attention — ${dateStr}`,
      `<p style="margin:0 0 12px;">KDMs expired or expiring within 7 days. Re-issue before the next show or the theatre goes dark.</p>` +
      `<ul style="margin:0;padding-left:18px;line-height:1.6;">${items}</ul>`)
    for (const t of team ?? []) {
      if (t.email_alerts && t.email) { await sendEmail(t.email, `OPM Office — KDM attention (${dateStr})`, html); emailed++ }
    }
  }

  return NextResponse.json({ ok: true, expired: expiredCount ?? 0, expiring: soonCount ?? 0, flagged: rows.length, emailed })
}
