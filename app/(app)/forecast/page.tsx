import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { ForecastClient, type ForecastEvent } from './ForecastClient'

const WEEKS = 12
const DAY = 86400000

export default async function ForecastPage() {
  const supabase = await createClient()
  const profile = await requireProfile()
  if (!['founder', 'accountant'].includes(profile.role)) redirect('/dashboard')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)
  const horizon = new Date(today.getTime() + WEEKS * 7 * DAY)
  const horizonStr = horizon.toISOString().slice(0, 10)

  const [banks, lastCash, payroll, payments, liabilities, receivables] = await Promise.all([
    supabase.from('bank_accounts').select('current_balance').eq('is_active', true),
    supabase.from('cash_entries').select('closing_cash').order('entry_date', { ascending: false }).limit(1),
    supabase.from('staff_salaries').select('monthly_salary').eq('is_active', true),
    supabase.from('payment_requests').select('id, payee, amount, due_date, approval_status, payment_status').eq('approval_status', 'approved').eq('payment_status', 'unpaid'),
    supabase.from('liabilities').select('id, party_name, balance_remaining, due_date, status').neq('status', 'cleared').not('due_date', 'is', null),
    supabase.from('project_income').select('id, amount, party, expected_date, status, project:projects(name)').eq('status', 'receivable').not('expected_date', 'is', null),
  ])

  const startBalance =
    Number(lastCash.data?.[0]?.closing_cash ?? 0) +
    (banks.data ?? []).reduce((s, b) => s + Number(b.current_balance ?? 0), 0)
  const monthlyPayroll = (payroll.data ?? []).reduce((s, p) => s + Number(p.monthly_salary ?? 0), 0)

  const events: ForecastEvent[] = []
  for (const l of liabilities.data ?? []) {
    if ((l.due_date as string) <= horizonStr) events.push({ id: `liab-${l.id}`, date: l.due_date as string, amount: Number(l.balance_remaining), dir: 'out', label: `Liability: ${l.party_name}`, deferrable: true })
  }
  for (const p of payments.data ?? []) {
    const d = (p.due_date as string) ?? todayStr
    if (d <= horizonStr) events.push({ id: `pay-${p.id}`, date: d, amount: Number(p.amount), dir: 'out', label: `Approved payment: ${p.payee}`, deferrable: true })
  }
  for (const r of receivables.data ?? []) {
    if ((r.expected_date as string) <= horizonStr) events.push({ id: `recv-${r.id}`, date: r.expected_date as string, amount: Number(r.amount), dir: 'in', label: `Receivable: ${(r.project as { name?: string } | null)?.name ?? r.party ?? 'income'}`, deferrable: false })
  }
  if (monthlyPayroll > 0) {
    const cur = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    while (cur <= horizon) {
      events.push({ id: `payroll-${cur.toISOString().slice(0, 10)}`, date: cur.toISOString().slice(0, 10), amount: monthlyPayroll, dir: 'out', label: 'Monthly payroll', deferrable: false })
      cur.setMonth(cur.getMonth() + 1)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Cash-flow Forecast" subtitle={`Projected ${WEEKS}-week runway — defer a payment to see the effect`} />
      <ForecastClient events={events} startBalance={startBalance} todayStr={todayStr} weeks={WEEKS} />
    </div>
  )
}
