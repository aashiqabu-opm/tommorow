import type { SupabaseClient } from '@supabase/supabase-js'
import type { BriefingSnapshot } from '@/lib/ai/briefing'

// Shared financial-snapshot builder. Reads the books and returns the
// BriefingSnapshot used by both the morning ai-briefing cron and the
// on-demand Founder Brief. Read-only; every query is a SELECT.
//
// Pass a service-role client (cron) to bypass RLS, or a founder's session
// client (Founder Brief) — the founder has read access to every table below.
export async function buildSnapshot(sb: SupabaseClient): Promise<BriefingSnapshot> {
  const today = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const todayStr = iso(today)
  const in14 = iso(new Date(today.getTime() + 14 * 86400000))
  const in30 = iso(new Date(today.getTime() + 30 * 86400000))

  const [banks, lastCash, payroll, payments, liabilities, receivables, docs, docInsights] = await Promise.all([
    sb.from('bank_accounts').select('current_balance').eq('is_active', true),
    sb.from('cash_entries').select('closing_cash').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(1),
    sb.from('staff_salaries').select('monthly_salary').eq('is_active', true),
    sb.from('payment_requests').select('payee, amount, purpose, approval_status, payment_status'),
    sb.from('liabilities').select('party_name, balance_remaining, due_date, status').neq('status', 'cleared').not('due_date', 'is', null),
    sb.from('project_income').select('amount, expected_date, status, party, project:projects(name)').eq('status', 'receivable'),
    sb.from('documents').select('title, expiry_date').not('expiry_date', 'is', null).neq('status', 'expired').gte('expiry_date', todayStr).lte('expiry_date', in30),
    sb.from('documents').select('title, ai_analysis').not('ai_analysis', 'is', null),
  ])

  const pay = payments.data ?? []
  const liab = liabilities.data ?? []
  const recv = (receivables.data ?? []) as { amount: number; expected_date: string | null; party: string | null; project: { name?: string } | null }[]

  // ── Film budget heads trending over estimate (≥90% used) ──
  const [budgetLinesAll, codedPays, pettyExp, crewCoded, vehicleDocs] = await Promise.all([
    sb.from('budget_lines').select('id, head, estimated, project:projects(name)').then(r => r.data ?? []),
    sb.from('payment_requests').select('amount, net_payable, payment_status, approval_status, budget_line_id').not('budget_line_id', 'is', null).then(r => r.data ?? []),
    sb.from('petty_cash_txns').select('amount, budget_line_id').eq('type', 'expense').not('budget_line_id', 'is', null).then(r => r.data ?? []),
    sb.from('project_crew').select('budget_line_id, payments:crew_payments(amount)').not('budget_line_id', 'is', null).then(r => r.data ?? []),
    sb.from('vehicle_documents').select('doc_type, expiry_date, vehicle:vehicles(reg_number)').not('expiry_date', 'is', null).gte('expiry_date', todayStr).lte('expiry_date', in30).then(r => r.data ?? []),
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

  // ── Burn rate & cash runway (trailing 90 days) ──
  const since90 = iso(new Date(today.getTime() - 90 * 86400000))
  const [paidPays, incomeRecv] = await Promise.all([
    sb.from('payment_requests').select('amount, net_payable').eq('payment_status', 'paid').gte('paid_at', since90).then(r => r.data ?? []),
    sb.from('project_income').select('amount').eq('status', 'received').gte('income_date', since90).then(r => r.data ?? []),
  ])
  const paid90 = (paidPays as { amount: number; net_payable: number | null }[]).reduce((s, p) => s + Number(p.net_payable ?? p.amount ?? 0), 0)
  const income90 = (incomeRecv as { amount: number }[]).reduce((s, p) => s + Number(p.amount || 0), 0)
  const cashOnHand = Number(lastCash.data?.[0]?.closing_cash ?? 0)
  const bankBalance = (banks.data ?? []).reduce((s, b) => s + Number(b.current_balance ?? 0), 0)
  const monthlyPayroll = (payroll.data ?? []).reduce((s, p) => s + Number(p.monthly_salary ?? 0), 0)
  const monthlyBurn = Math.max(0, monthlyPayroll + paid90 / 3 - income90 / 3)
  const available = cashOnHand + bankBalance
  const runwayWeeks = monthlyBurn > 0 ? Math.round((available / monthlyBurn) * 4.33) : null

  return {
    dateStr: today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
    cashOnHand,
    bankBalance,
    monthlyPayroll,
    monthlyBurn,
    runwayWeeks,
    pendingApprovals: pay.filter(p => p.approval_status === 'pending').map(p => ({ payee: p.payee, amount: Number(p.amount), purpose: p.purpose })),
    approvedUnpaid: pay.filter(p => p.approval_status === 'approved' && p.payment_status === 'unpaid').map(p => ({ payee: p.payee, amount: Number(p.amount) })),
    overdueLiabilities: liab.filter(l => (l.due_date as string) < todayStr).map(l => ({ party: l.party_name, amount: Number(l.balance_remaining), due: l.due_date as string })),
    dueSoonLiabilities: liab.filter(l => (l.due_date as string) >= todayStr && (l.due_date as string) <= in14).map(l => ({ party: l.party_name, amount: Number(l.balance_remaining), due: l.due_date as string })),
    overdueReceivables: recv.filter(r => r.expected_date && r.expected_date < todayStr).map(r => ({ project: r.project?.name ?? '', party: r.party ?? 'a buyer', amount: Number(r.amount), expected: r.expected_date as string })),
    expiringDocs: [
      ...(docs.data ?? []).map(d => ({ title: d.title as string, expiry: d.expiry_date as string })),
      ...(vehicleDocs as { doc_type: string; expiry_date: string; vehicle: { reg_number?: string } | null }[]).map(v => ({ title: `Vehicle ${v.vehicle?.reg_number ?? ''} — ${v.doc_type.toUpperCase()}`, expiry: v.expiry_date })),
    ],
    docKeyDates,
    docFlags,
    budgetAlerts,
  }
}
