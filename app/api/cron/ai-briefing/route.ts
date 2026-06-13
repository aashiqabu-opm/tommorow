import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, sendWhatsApp, emailTemplate, emailConfigured, whatsappConfigured } from '@/lib/alerts/channels'
import { escapeHtml } from '@/lib/alerts/deliver'
import { generateBriefing, type BriefingSnapshot } from '@/lib/ai/briefing'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Daily AI monitor: reads the books, Claude writes a prioritized briefing,
// delivered to founder + accountant. Triggered by Vercel Cron.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!emailConfigured() && !whatsappConfigured()) {
    return NextResponse.json({ ok: true, skipped: 'no alert channel configured' })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })

  const today = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const todayStr = iso(today)
  const in14 = iso(new Date(today.getTime() + 14 * 86400000))
  const in30 = iso(new Date(today.getTime() + 30 * 86400000))

  const [banks, lastCash, payroll, payments, liabilities, receivables, docs, recipients, docInsights] = await Promise.all([
    admin.from('bank_accounts').select('current_balance').eq('is_active', true),
    admin.from('cash_entries').select('closing_cash').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(1),
    admin.from('staff_salaries').select('monthly_salary').eq('is_active', true),
    admin.from('payment_requests').select('payee, amount, purpose, approval_status, payment_status'),
    admin.from('liabilities').select('party_name, balance_remaining, due_date, status').neq('status', 'cleared').not('due_date', 'is', null),
    admin.from('project_income').select('amount, expected_date, status, party, project:projects(name)').eq('status', 'receivable'),
    admin.from('documents').select('title, expiry_date').not('expiry_date', 'is', null).neq('status', 'expired').gte('expiry_date', todayStr).lte('expiry_date', in30),
    admin.from('profiles').select('email, full_name, email_alerts, whatsapp_alerts, whatsapp_number').in('role', ['founder', 'accountant']).eq('is_active', true),
    admin.from('documents').select('title, ai_analysis').not('ai_analysis', 'is', null),
  ])

  const pay = payments.data ?? []
  const liab = liabilities.data ?? []
  const recv = (receivables.data ?? []) as { amount: number; expected_date: string | null; party: string | null; project: { name?: string } | null }[]

  // ── Film budget heads trending over estimate (≥90% used) ──
  const [budgetLinesAll, codedPays, pettyExp, crewCoded] = await Promise.all([
    admin.from('budget_lines').select('id, head, estimated, project:projects(name)').then(r => r.data ?? []),
    admin.from('payment_requests').select('amount, net_payable, payment_status, approval_status, budget_line_id').not('budget_line_id', 'is', null).then(r => r.data ?? []),
    admin.from('petty_cash_txns').select('amount, budget_line_id').eq('type', 'expense').not('budget_line_id', 'is', null).then(r => r.data ?? []),
    admin.from('project_crew').select('budget_line_id, payments:crew_payments(amount)').not('budget_line_id', 'is', null).then(r => r.data ?? []),
  ])
  const actualByLine: Record<string, number> = {}
  const bump = (id: string | null, n: number) => { if (id) actualByLine[id] = (actualByLine[id] ?? 0) + n }
  for (const p of codedPays as { amount: number; net_payable: number | null; payment_status: string; approval_status: string; budget_line_id: string }[]) {
    if (p.payment_status === 'paid' || p.approval_status === 'approved') bump(p.budget_line_id, Number(p.net_payable ?? p.amount ?? 0))
  }
  for (const t of pettyExp as { amount: number; budget_line_id: string }[]) bump(t.budget_line_id, Number(t.amount || 0))
  for (const c of crewCoded as { budget_line_id: string; payments?: { amount: number }[] }[]) {
    bump(c.budget_line_id, (c.payments ?? []).reduce((s, p) => s + Number(p.amount || 0), 0))
  }
  const budgetAlerts = (budgetLinesAll as { id: string; head: string; estimated: number; project: { name?: string } | null }[])
    .map(l => {
      const budget = Number(l.estimated || 0)
      const actual = actualByLine[l.id] ?? 0
      return { project: l.project?.name ?? 'Project', head: l.head, budget, actual, pct: budget > 0 ? Math.round((actual / budget) * 100) : 0 }
    })
    .filter(b => b.budget > 0 && b.pct >= 90)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6)

  // From AI-analyzed documents: upcoming key dates (next 45 days) and high-severity flags
  type DocA = { summary: string; key_dates: { label: string; date: string; kind: string }[]; flags: { severity: string; note: string }[] }
  const in45 = iso(new Date(today.getTime() + 45 * 86400000))
  const docKeyDates: { title: string; label: string; date: string }[] = []
  const docFlags: { title: string; severity: string; note: string }[] = []
  for (const d of (docInsights.data ?? []) as { title: string; ai_analysis: DocA | null }[]) {
    const a = d.ai_analysis
    if (!a) continue
    for (const kd of a.key_dates ?? []) {
      if (kd.date && kd.date >= todayStr && kd.date <= in45) docKeyDates.push({ title: d.title, label: kd.label, date: kd.date })
    }
    for (const f of a.flags ?? []) {
      if (f.severity === 'high') docFlags.push({ title: d.title, severity: f.severity, note: f.note })
    }
  }

  const snapshot: BriefingSnapshot = {
    dateStr: today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
    cashOnHand: lastCash.data?.[0]?.closing_cash ?? 0,
    bankBalance: (banks.data ?? []).reduce((s, b) => s + Number(b.current_balance ?? 0), 0),
    monthlyPayroll: (payroll.data ?? []).reduce((s, p) => s + Number(p.monthly_salary ?? 0), 0),
    pendingApprovals: pay.filter(p => p.approval_status === 'pending').map(p => ({ payee: p.payee, amount: Number(p.amount), purpose: p.purpose })),
    approvedUnpaid: pay.filter(p => p.approval_status === 'approved' && p.payment_status === 'unpaid').map(p => ({ payee: p.payee, amount: Number(p.amount) })),
    overdueLiabilities: liab.filter(l => (l.due_date as string) < todayStr).map(l => ({ party: l.party_name, amount: Number(l.balance_remaining), due: l.due_date as string })),
    dueSoonLiabilities: liab.filter(l => (l.due_date as string) >= todayStr && (l.due_date as string) <= in14).map(l => ({ party: l.party_name, amount: Number(l.balance_remaining), due: l.due_date as string })),
    overdueReceivables: recv.filter(r => r.expected_date && r.expected_date < todayStr).map(r => ({ project: r.project?.name ?? '', party: r.party ?? 'a buyer', amount: Number(r.amount), expected: r.expected_date as string })),
    expiringDocs: (docs.data ?? []).map(d => ({ title: d.title as string, expiry: d.expiry_date as string })),
    docKeyDates,
    docFlags,
    budgetAlerts,
  }

  const briefing = await generateBriefing(snapshot)

  const dateStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const html = emailTemplate(
    `Morning Briefing — ${dateStr}`,
    `<p style="margin:0 0 12px;font-weight:600;">${escapeHtml(briefing.headline)}</p>` +
    (briefing.itemsHtml ? `<ul style="margin:0;padding-left:18px;line-height:1.7;">${briefing.itemsHtml}</ul>` : '<p style="margin:0;">Nothing needs attention today.</p>') +
    `<p style="margin:16px 0 0;font-size:11px;color:#a1a1aa;">Generated by your OPM Office AI monitor. Figures are read-only — it never changes anything.</p>`
  )
  const waText = `*OPM Office — Morning Briefing (${dateStr})*\n${briefing.whatsapp || briefing.headline}`

  const list = recipients.data ?? []
  let sent = 0
  for (let i = 0; i < list.length; i++) {
    const r = list[i]
    if (r.email_alerts && r.email) {
      if (await sendEmail(r.email, `OPM Office — Morning Briefing (${dateStr})`, html)) sent++
    }
    // WhatsApp only when something is genuinely urgent (keeps WhatsApp high-signal)
    if (briefing.hasUrgent && r.whatsapp_alerts && r.whatsapp_number) {
      if (await sendWhatsApp(r.whatsapp_number, waText)) sent++
    }
    if (i < list.length - 1) await new Promise(res => setTimeout(res, 600))
  }

  return NextResponse.json({ ok: true, recipients: list.length, sent, headline: briefing.headline, urgent: briefing.hasUrgent })
}
