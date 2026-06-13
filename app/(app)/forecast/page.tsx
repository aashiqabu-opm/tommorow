import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Wallet, TrendingDown, CalendarClock, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

const WEEKS = 12
const DAY = 86400000

type Ev = { date: string; amount: number; dir: 'in' | 'out'; label: string }

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
    supabase.from('payment_requests').select('payee, amount, due_date, approval_status, payment_status').eq('approval_status', 'approved').eq('payment_status', 'unpaid'),
    supabase.from('liabilities').select('party_name, balance_remaining, due_date, status').neq('status', 'cleared').not('due_date', 'is', null),
    supabase.from('project_income').select('amount, party, expected_date, status, project:projects(name)').eq('status', 'receivable').not('expected_date', 'is', null),
  ])

  const startBalance =
    Number(lastCash.data?.[0]?.closing_cash ?? 0) +
    (banks.data ?? []).reduce((s, b) => s + Number(b.current_balance ?? 0), 0)
  const monthlyPayroll = (payroll.data ?? []).reduce((s, p) => s + Number(p.monthly_salary ?? 0), 0)

  // Build dated events. Anything overdue is pulled to "today" (it's due now).
  const clamp = (d: string) => (d < todayStr ? todayStr : d)
  const events: Ev[] = []
  for (const l of liabilities.data ?? []) {
    const d = l.due_date as string
    if (d <= horizonStr) events.push({ date: clamp(d), amount: Number(l.balance_remaining), dir: 'out', label: `Liability: ${l.party_name}` })
  }
  for (const p of payments.data ?? []) {
    const d = (p.due_date as string) ?? todayStr
    if (d <= horizonStr) events.push({ date: clamp(d), amount: Number(p.amount), dir: 'out', label: `Approved payment: ${p.payee}` })
  }
  for (const r of receivables.data ?? []) {
    const d = r.expected_date as string
    if (d <= horizonStr) events.push({ date: clamp(d), amount: Number(r.amount), dir: 'in', label: `Receivable: ${(r.project as { name?: string } | null)?.name ?? r.party ?? 'income'}` })
  }
  // Recurring payroll on the 1st of each month within the horizon
  if (monthlyPayroll > 0) {
    const cur = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    while (cur <= horizon) {
      events.push({ date: cur.toISOString().slice(0, 10), amount: monthlyPayroll, dir: 'out', label: 'Monthly payroll' })
      cur.setMonth(cur.getMonth() + 1)
    }
  }

  // Weekly buckets
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(today.getTime() + i * 7 * DAY)
    const end = new Date(today.getTime() + (i + 1) * 7 * DAY)
    return { start, startStr: start.toISOString().slice(0, 10), endStr: end.toISOString().slice(0, 10), inflow: 0, outflow: 0, balance: 0 }
  })
  for (const e of events) {
    const w = weeks.find(w => e.date >= w.startStr && e.date < w.endStr)
    if (!w) continue
    if (e.dir === 'in') w.inflow += e.amount
    else w.outflow += e.amount
  }
  let running = startBalance
  let low = { balance: startBalance, date: todayStr }
  for (const w of weeks) {
    running += w.inflow - w.outflow
    w.balance = running
    if (running < low.balance) low = { balance: running, date: w.endStr }
  }

  const totalIn = weeks.reduce((s, w) => s + w.inflow, 0)
  const totalOut = weeks.reduce((s, w) => s + w.outflow, 0)
  const goesNegative = low.balance < 0
  const maxAbs = Math.max(...weeks.map(w => Math.abs(w.balance)), startBalance, 1)

  const upcoming = [...events].filter(e => e.amount > 0).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12)

  return (
    <div className="space-y-6">
      <PageHeader title="Cash-flow Forecast" subtitle={`Projected ${WEEKS}-week runway from known inflows & outflows`} />

      {goesNegative ? (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>Cash is projected to go negative — reaching <strong>{formatCurrency(low.balance)}</strong> by <strong>{formatDate(low.date)}</strong>. Defer non-urgent payments or pull in a receivable before then.</span>
        </div>
      ) : (
        <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-300">
          <Wallet size={15} className="mt-0.5 shrink-0" />
          <span>Cash stays positive across the next {WEEKS} weeks. Projected low: <strong>{formatCurrency(low.balance)}</strong> around {formatDate(low.date)}.</span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Available Now" value={formatCurrency(startBalance)} status="default" icon={Wallet} subtitle="Cash + bank" />
        <StatCard title="Projected Low" value={formatCurrency(low.balance)} status={goesNegative ? 'red' : low.balance < startBalance * 0.25 ? 'yellow' : 'green'} icon={TrendingDown} subtitle={`by ${formatDate(low.date)}`} />
        <StatCard title="Expected In (12wk)" value={formatCurrency(totalIn)} status="green" />
        <StatCard title="Expected Out (12wk)" value={formatCurrency(totalOut)} status="red" subtitle={`Net ${formatCurrency(totalIn - totalOut)}`} />
      </div>

      {/* Projected balance — bars above/below a zero line */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Projected balance by week</h3>
        <div className="flex items-stretch gap-1.5" style={{ height: 160 }}>
          {weeks.map((w, i) => {
            const pos = w.balance >= 0
            const hPct = Math.min((Math.abs(w.balance) / maxAbs) * 50, 50)
            return (
              <div key={i} className="flex-1 flex flex-col items-center" title={`Week of ${formatDate(w.startStr)}: ${formatCurrency(w.balance)}`}>
                <div className="flex-1 w-full flex flex-col justify-end items-center">
                  {pos && <div className="w-full bg-emerald-500/80 rounded-t-sm min-h-[2px]" style={{ height: `${hPct}%` }} />}
                </div>
                <div className="w-full border-t border-[#3a3a4a]" />
                <div className="flex-1 w-full flex flex-col justify-start items-center">
                  {!pos && <div className="w-full bg-red-500/80 rounded-b-sm min-h-[2px]" style={{ height: `${hPct}%` }} />}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-1.5 mt-1">
          {weeks.map((w, i) => (
            <div key={i} className="flex-1 text-center text-[9px] text-[#5a5a7a]">{i % 2 === 0 ? w.start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</div>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Weekly table */}
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#2a2a3a]"><h3 className="text-sm font-semibold text-white">Week-by-week</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[#2a2a3a]">
                {['Week of', 'In', 'Out', 'Balance'].map(h => <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-[#8888aa] uppercase">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-[#2a2a3a]">
                {weeks.map((w, i) => (
                  <tr key={i} className={w.balance < 0 ? 'bg-red-500/5' : ''}>
                    <td className="px-4 py-2.5 text-[#c8c8da] whitespace-nowrap">{formatDate(w.startStr)}</td>
                    <td className="px-4 py-2.5 text-emerald-400 tabular-nums">{w.inflow ? `+${formatCurrency(w.inflow)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-red-400 tabular-nums">{w.outflow ? `-${formatCurrency(w.outflow)}` : '—'}</td>
                    <td className={`px-4 py-2.5 font-semibold tabular-nums ${w.balance < 0 ? 'text-red-400' : 'text-white'}`}>{formatCurrency(w.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upcoming events */}
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center gap-2">
            <CalendarClock size={15} className="text-white/70" />
            <h3 className="text-sm font-semibold text-white">What&apos;s driving it</h3>
          </div>
          <div className="divide-y divide-[#2a2a3a] max-h-80 overflow-y-auto">
            {upcoming.map((e, i) => (
              <div key={i} className="px-5 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{e.label}</div>
                  <div className="text-xs text-[#8888aa]">{formatDate(e.date)}</div>
                </div>
                <div className={`text-sm font-semibold tabular-nums shrink-0 ${e.dir === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {e.dir === 'in' ? '+' : '-'}{formatCurrency(e.amount)}
                </div>
              </div>
            ))}
            {upcoming.length === 0 && <div className="py-8 text-center text-[#8888aa] text-sm">No dated inflows or outflows in the window.</div>}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-[#5a5a7a]">Includes: overdue & upcoming liabilities, approved-but-unpaid payments, expected receivables, and monthly payroll (assumed on the 1st). Undated items aren&apos;t projected. This is a forecast — verify before acting on it.</p>
    </div>
  )
}
