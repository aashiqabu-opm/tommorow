import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailTemplate, emailConfigured } from '@/lib/alerts/channels'
import { escapeHtml } from '@/lib/alerts/deliver'
import { withCronErrorAlert } from '@/lib/monitoring'
import { VEHICLE_DOC_LABELS } from '@/lib/types'
import type { VehicleDocType } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

// Daily: roll vehicle-document status from expiry dates, then alert the team
// about anything expired or expiring within 30 days.
export async function GET(request: Request) {
  return withCronErrorAlert('vehicle-doc-expiry', () => run(request))
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })

  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  // 1) status rollover (only touch rows that need it)
  const { count: expiredCount } = await admin.from('vehicle_documents')
    .update({ status: 'expired', updated_at: new Date().toISOString() }, { count: 'exact' })
    .lt('expiry_date', today).neq('status', 'expired').not('expiry_date', 'is', null)
  const { count: soonCount } = await admin.from('vehicle_documents')
    .update({ status: 'expiring_soon', updated_at: new Date().toISOString() }, { count: 'exact' })
    .gte('expiry_date', today).lte('expiry_date', in30).neq('status', 'expiring_soon')

  // 2) gather everything currently expired or expiring within 30d (with vehicle)
  const { data: docs } = await admin.from('vehicle_documents')
    .select('id, doc_type, doc_number, expiry_date, vehicle:vehicles(reg_number, name)')
    .lte('expiry_date', in30).not('expiry_date', 'is', null)
    .order('expiry_date', { ascending: true })

  const rows = (docs ?? []) as Row[]
  if (!rows.length) return NextResponse.json({ ok: true, expired: expiredCount ?? 0, expiring_soon: soonCount ?? 0, alerted: false })

  // 3) notify the core team (in-app + one summary email)
  const { data: team } = await admin.from('profiles')
    .select('id, email, email_alerts, is_active')
    .in('role', ['founder', 'accountant', 'general_manager', 'executive_producer']).eq('is_active', true)

  const label = (t: string) => VEHICLE_DOC_LABELS[t as VehicleDocType] ?? t
  const line = (d: Row) => {
    const veh = d.vehicle?.reg_number || d.vehicle?.name || 'Vehicle'
    const state = d.expiry_date < today ? 'EXPIRED' : 'expiring'
    return `${veh} — ${label(d.doc_type)}${d.doc_number ? ` (${d.doc_number})` : ''}: ${state} ${d.expiry_date}`
  }

  // In-app notifications, one per team member summarising the count
  const expiredNow = rows.filter(d => d.expiry_date < today).length
  const soonNow = rows.length - expiredNow
  const notif = (team ?? []).map((t: Row) => ({
    user_id: t.id,
    title: `Vehicle docs need attention (${rows.length})`,
    body: `${expiredNow} expired, ${soonNow} expiring within 30 days.`,
    entity_type: 'vehicle_document',
  }))
  if (notif.length) await admin.from('notifications').insert(notif)

  // Email summary
  let emailed = 0
  if (emailConfigured()) {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const items = rows.map(d => `<li style="margin:0 0 6px;"><b>${escapeHtml(d.expiry_date < today ? '⚠️ Expired' : 'Expiring soon')}</b> — ${escapeHtml(line(d))}</li>`).join('')
    const html = emailTemplate(`Vehicle documents — ${dateStr}`,
      `<p style="margin:0 0 12px;">${expiredNow} expired and ${soonNow} expiring within 30 days. Renew and re-upload in the Vehicles → Document Vault.</p>` +
      `<ul style="margin:0;padding-left:18px;line-height:1.6;">${items}</ul>`)
    for (const t of team ?? []) {
      if (t.email_alerts && t.email) { await sendEmail(t.email, `OPM Flash — Vehicle documents need attention (${dateStr})`, html); emailed++ }
    }
  }

  return NextResponse.json({ ok: true, expired: expiredCount ?? 0, expiring_soon: soonCount ?? 0, flagged: rows.length, notified: notif.length, emailed })
}
