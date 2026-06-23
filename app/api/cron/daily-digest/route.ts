import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailTemplate, emailConfigured, sleep, EMAIL_THROTTLE_MS } from '@/lib/alerts/channels'
import { escapeHtml } from '@/lib/alerts/deliver'
import { withCronErrorAlert } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

// Daily digest for founder + accountant: pending approvals, overdue and
// upcoming liabilities, expiring agreements. Triggered by Vercel Cron.
export async function GET(request: Request) {
  return withCronErrorAlert('daily-digest', () => run(request))
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!emailConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'no alert channel configured' })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  }

  const today = new Date()
  const in7Days = new Date(today.getTime() + 7 * 86400000)
  const in30Days = new Date(today.getTime() + 30 * 86400000)
  const isoToday = today.toISOString().slice(0, 10)

  const [pendingRes, liabilitiesRes, documentsRes, recipientsRes] = await Promise.all([
    admin
      .from('payment_requests')
      .select('payee, amount, purpose')
      .eq('approval_status', 'pending'),
    admin
      .from('liabilities')
      .select('party_name, balance_remaining, due_date')
      .neq('status', 'cleared')
      .not('due_date', 'is', null)
      .lte('due_date', in7Days.toISOString().slice(0, 10)),
    admin
      .from('documents')
      .select('title, expiry_date')
      .not('expiry_date', 'is', null)
      .neq('status', 'expired')
      .gte('expiry_date', isoToday)
      .lte('expiry_date', in30Days.toISOString().slice(0, 10)),
    admin
      .from('profiles')
      .select('email, full_name, email_alerts, whatsapp_alerts, whatsapp_number')
      .in('role', ['founder', 'accountant'])
      .eq('is_active', true),
  ])

  const pending = pendingRes.data ?? []
  const liabilities = liabilitiesRes.data ?? []
  const documents = documentsRes.data ?? []
  const recipients = recipientsRes.data ?? []

  const overdue = liabilities.filter((l) => l.due_date! < isoToday)
  const dueSoon = liabilities.filter((l) => l.due_date! >= isoToday)

  if (pending.length === 0 && liabilities.length === 0 && documents.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'nothing to report' })
  }

  const sections: string[] = []
  const textLines: string[] = []

  if (pending.length > 0) {
    const total = pending.reduce((s, p) => s + Number(p.amount), 0)
    sections.push(
      `<h3 style="margin:16px 0 6px;font-size:14px;color:#18181b;">⏳ ${pending.length} payment${pending.length === 1 ? '' : 's'} awaiting approval (${inr(total)})</h3>` +
      `<ul style="margin:0;padding-left:18px;">${pending.slice(0, 8).map((p) =>
        `<li>${escapeHtml(p.payee)} — ${inr(Number(p.amount))} <span style="color:#71717a;">(${escapeHtml(p.purpose)})</span></li>`
      ).join('')}</ul>`
    )
    textLines.push(`⏳ ${pending.length} payments awaiting approval (${inr(total)})`)
  }

  if (overdue.length > 0) {
    sections.push(
      `<h3 style="margin:16px 0 6px;font-size:14px;color:#b91c1c;">🔴 ${overdue.length} overdue liabilit${overdue.length === 1 ? 'y' : 'ies'}</h3>` +
      `<ul style="margin:0;padding-left:18px;">${overdue.slice(0, 8).map((l) =>
        `<li>${escapeHtml(l.party_name)} — ${inr(Number(l.balance_remaining))} (due ${l.due_date})</li>`
      ).join('')}</ul>`
    )
    textLines.push(`🔴 ${overdue.length} overdue liabilities`)
  }

  if (dueSoon.length > 0) {
    sections.push(
      `<h3 style="margin:16px 0 6px;font-size:14px;color:#18181b;">🟡 ${dueSoon.length} liabilit${dueSoon.length === 1 ? 'y' : 'ies'} due within 7 days</h3>` +
      `<ul style="margin:0;padding-left:18px;">${dueSoon.slice(0, 8).map((l) =>
        `<li>${escapeHtml(l.party_name)} — ${inr(Number(l.balance_remaining))} (due ${l.due_date})</li>`
      ).join('')}</ul>`
    )
    textLines.push(`🟡 ${dueSoon.length} liabilities due within 7 days`)
  }

  if (documents.length > 0) {
    sections.push(
      `<h3 style="margin:16px 0 6px;font-size:14px;color:#18181b;">📄 ${documents.length} agreement${documents.length === 1 ? '' : 's'} expiring within 30 days</h3>` +
      `<ul style="margin:0;padding-left:18px;">${documents.slice(0, 8).map((d) =>
        `<li>${escapeHtml(d.title)} (expires ${d.expiry_date})</li>`
      ).join('')}</ul>`
    )
    textLines.push(`📄 ${documents.length} agreements expiring within 30 days`)
  }

  const dateStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const html = emailTemplate(`Daily Digest — ${dateStr}`, sections.join(''))

  // Email-only: the digest is a multi-item summary that doesn't map to a fixed
  // WhatsApp utility template. Time-sensitive bill approvals still reach people
  // on WhatsApp in real time via the inbound webhook flow.
  let sent = 0
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i]
    if (r.email_alerts && r.email) {
      if (await sendEmail(r.email, `OPM Flash — Daily Digest (${dateStr})`, html)) sent++
    }
    if (i < recipients.length - 1) await sleep(EMAIL_THROTTLE_MS)
  }

  return NextResponse.json({ ok: true, recipients: recipients.length, sent })
}
