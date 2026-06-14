import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailTemplate, emailConfigured, sleep } from '@/lib/alerts/channels'
import { generateWeeklyReport, type WeeklySnapshot, type ProjectWeekly } from '@/lib/ai/weekly-report'
import { fundingMetrics } from '@/lib/funding'
import type { ProjectFunding } from '@/lib/types'
import { withCronErrorAlert } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

// Weekly AI management report → founder + accountant. Triggered by Vercel Cron.
export async function GET(request: Request) {
  return withCronErrorAlert('weekly-report', () => run(request))
}
async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!emailConfigured()) return NextResponse.json({ ok: true, skipped: 'email not configured' })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekStart = new Date(today.getTime() - 7 * 86400000)
  const weekStartDate = weekStart.toISOString().slice(0, 10)
  const weekStartIso = weekStart.toISOString()
  const todayStr = today.toISOString().slice(0, 10)
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const weekLabel = `${fmt(weekStart)} – ${today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const [banks, lastCash, payroll, incomeWk, paidWk, receivablesAll, liabilitiesAll, pendingPays, loans, recipients] = await Promise.all([
    admin.from('bank_accounts').select('current_balance').eq('is_active', true),
    admin.from('cash_entries').select('closing_cash').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(1),
    admin.from('staff_salaries').select('monthly_salary').eq('is_active', true),
    admin.from('project_income').select('amount, status, project:projects(name)').gte('income_date', weekStartDate),
    admin.from('payment_requests').select('amount, net_payable, project:projects(name)').eq('payment_status', 'paid').gte('paid_at', weekStartIso),
    admin.from('project_income').select('amount, expected_date, status').eq('status', 'receivable'),
    admin.from('liabilities').select('balance_remaining, due_date, status').neq('status', 'cleared'),
    admin.from('payment_requests').select('amount').eq('approval_status', 'pending'),
    admin.from('project_funding').select('*, transactions:funding_transactions(*)').eq('kind', 'loan').eq('status', 'active'),
    admin.from('profiles').select('email, email_alerts').in('role', ['founder', 'accountant']).eq('is_active', true),
  ])

  const available = Number(lastCash.data?.[0]?.closing_cash ?? 0) + (banks.data ?? []).reduce((s, b) => s + Number(b.current_balance ?? 0), 0)
  const monthlyPayroll = (payroll.data ?? []).reduce((s, p) => s + Number(p.monthly_salary ?? 0), 0)
  const loanMonthlyInterest = (loans.data ?? []).reduce((s, l) => s + fundingMetrics(l as ProjectFunding).monthlyInterest, 0)

  const incomeRows = (incomeWk.data ?? []) as { amount: number; status: string | null; project: { name?: string } | null }[]
  const paidRows = (paidWk.data ?? []) as { amount: number; net_payable: number | null; project: { name?: string } | null }[]
  const inflow = incomeRows.filter(r => (r.status ?? 'received') === 'received').reduce((s, r) => s + Number(r.amount || 0), 0)
  const outflow = paidRows.reduce((s, r) => s + Number(r.net_payable ?? r.amount ?? 0), 0)

  // Per-project activity this week
  const projMap: Record<string, ProjectWeekly> = {}
  const proj = (name?: string) => (projMap[name ?? '—'] ??= { name: name ?? '—', received: 0, spent: 0 })
  for (const r of incomeRows) if ((r.status ?? 'received') === 'received') proj(r.project?.name).received += Number(r.amount || 0)
  for (const r of paidRows) proj(r.project?.name).spent += Number(r.net_payable ?? r.amount ?? 0)
  const topProjects = Object.values(projMap).sort((a, b) => (b.received + b.spent) - (a.received + a.spent)).slice(0, 5)

  const receivableOutstanding = (receivablesAll.data ?? []).reduce((s, r) => s + Number(r.amount || 0), 0)
  const overdueRecv = (receivablesAll.data ?? []).filter(r => r.expected_date && (r.expected_date as string) < todayStr)
  const liabilitiesOutstanding = (liabilitiesAll.data ?? []).reduce((s, l) => s + Number(l.balance_remaining || 0), 0)
  const overdueLiab = (liabilitiesAll.data ?? []).filter(l => l.due_date && (l.due_date as string) < todayStr)
  const pendingApprovals = { count: (pendingPays.data ?? []).length, total: (pendingPays.data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0) }

  const attention: string[] = []
  if (overdueLiab.length) attention.push(`${overdueLiab.length} overdue due(s) totalling ${inr(overdueLiab.reduce((s, l) => s + Number(l.balance_remaining || 0), 0))}.`)
  if (overdueRecv.length) attention.push(`${overdueRecv.length} overdue receivable(s) totalling ${inr(overdueRecv.reduce((s, r) => s + Number(r.amount || 0), 0))}.`)
  if (available < monthlyPayroll && monthlyPayroll > 0) attention.push(`Available cash ${inr(available)} is below one month's payroll (${inr(monthlyPayroll)}).`)

  const snapshot: WeeklySnapshot = {
    weekLabel, available, inflow, outflow, receivableOutstanding, liabilitiesOutstanding,
    pendingApprovals, monthlyPayroll, loanMonthlyInterest, topProjects, attention,
  }

  const report = await generateWeeklyReport(snapshot)
  const html = emailTemplate(`Weekly Report — ${weekLabel}`, report.bodyHtml)

  const list = (recipients.data ?? []).filter(r => r.email_alerts && r.email)
  let sent = 0
  for (const r of list) {
    if (await sendEmail(r.email as string, `OPM Office — Weekly Report (${weekLabel})`, html)) sent++
    await sleep(600)
  }

  return NextResponse.json({ ok: true, sent, headline: report.headline })
}
