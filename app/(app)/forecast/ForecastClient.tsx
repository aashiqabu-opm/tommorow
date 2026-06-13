'use client'

import { useMemo, useState } from 'react'
import { StatCard } from '@/components/ui/StatCard'
import { Wallet, TrendingDown, CalendarClock, AlertTriangle, RotateCcw } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

export type ForecastEvent = {
  id: string
  date: string
  amount: number
  dir: 'in' | 'out'
  label: string
  deferrable: boolean
}

const DAY = 86400000

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function project(events: ForecastEvent[], startBalance: number, todayStr: string, weeksCount: number) {
  const today = new Date(todayStr + 'T00:00:00')
  const weeks = Array.from({ length: weeksCount }, (_, i) => {
    const start = new Date(today.getTime() + i * 7 * DAY)
    const end = new Date(today.getTime() + (i + 1) * 7 * DAY)
    return { start, startStr: start.toISOString().slice(0, 10), endStr: end.toISOString().slice(0, 10), inflow: 0, outflow: 0, balance: 0 }
  })
  const horizonStr = weeks[weeks.length - 1].endStr
  for (const e of events) {
    const date = e.date < todayStr ? todayStr : e.date
    if (date >= horizonStr) continue
    const w = weeks.find(w => date >= w.startStr && date < w.endStr)
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
  return { weeks, low, totalIn, totalOut }
}

export function ForecastClient({
  events, startBalance, todayStr, weeks: weeksCount,
}: { events: ForecastEvent[]; startBalance: number; todayStr: string; weeks: number }) {
  // deferrals: event id -> days shifted forward
  const [defer, setDefer] = useState<Record<string, number>>({})
  const activeDeferrals = Object.values(defer).filter(d => d > 0).length

  const shifted = useMemo(
    () => events.map(e => (defer[e.id] ? { ...e, date: addDays(e.date, defer[e.id]) } : e)),
    [events, defer]
  )

  const base = useMemo(() => project(events, startBalance, todayStr, weeksCount), [events, startBalance, todayStr, weeksCount])
  const sim = useMemo(() => project(shifted, startBalance, todayStr, weeksCount), [shifted, startBalance, todayStr, weeksCount])

  const { weeks, low, totalIn, totalOut } = sim
  const goesNegative = low.balance < 0
  const maxAbs = Math.max(...weeks.map(w => Math.abs(w.balance)), startBalance, 1)
  const lowDelta = low.balance - base.low.balance // improvement vs baseline when deferring

  const outflows = useMemo(
    () => events.filter(e => e.deferrable).sort((a, b) => a.date.localeCompare(b.date)),
    [events]
  )
  const inflows = useMemo(
    () => events.filter(e => e.dir === 'in' && e.amount > 0).sort((a, b) => a.date.localeCompare(b.date)),
    [events]
  )

  const setShift = (id: string, days: number) => setDefer(d => ({ ...d, [id]: d[id] === days ? 0 : days }))

  return (
    <div className="space-y-6">
      {goesNegative ? (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          <span>Cash is projected to go negative — reaching <strong>{formatCurrency(low.balance)}</strong> by <strong>{formatDate(low.date)}</strong>. Try deferring an outflow below, or pull in a receivable.</span>
        </div>
      ) : (
        <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-300">
          <Wallet size={15} className="mt-0.5 shrink-0" />
          <span>Cash stays positive across the next {weeksCount} weeks. Projected low: <strong>{formatCurrency(low.balance)}</strong> around {formatDate(low.date)}.</span>
        </div>
      )}

      {activeDeferrals > 0 && (
        <div className="flex items-center justify-between gap-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-2.5 text-sm">
          <span className="text-indigo-200">
            What-if: {activeDeferrals} payment{activeDeferrals > 1 ? 's' : ''} deferred ·{' '}
            {lowDelta >= 0
              ? <>projected low improves by <strong className="text-emerald-300">{formatCurrency(lowDelta)}</strong></>
              : <>projected low worsens by <strong className="text-red-300">{formatCurrency(-lowDelta)}</strong></>}
          </span>
          <button onClick={() => setDefer({})} className="flex items-center gap-1.5 text-xs text-indigo-200 hover:text-white">
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Available Now" value={formatCurrency(startBalance)} status="default" icon={Wallet} subtitle="Cash + bank" />
        <StatCard title="Projected Low" value={formatCurrency(low.balance)} status={goesNegative ? 'red' : low.balance < startBalance * 0.25 ? 'yellow' : 'green'} icon={TrendingDown} subtitle={`by ${formatDate(low.date)}`} />
        <StatCard title="Expected In" value={formatCurrency(totalIn)} status="green" subtitle={`${weeksCount} weeks`} />
        <StatCard title="Expected Out" value={formatCurrency(totalOut)} status="red" subtitle={`Net ${formatCurrency(totalIn - totalOut)}`} />
      </div>

      {/* Projected balance — bars above/below a zero line. Faint baseline ghost behind. */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Projected balance by week</h3>
          {activeDeferrals > 0 && <span className="text-[10px] text-[#8888aa]">faint bar = before deferral</span>}
        </div>
        <div className="flex items-stretch gap-1.5" style={{ height: 160 }}>
          {weeks.map((w, i) => {
            const pos = w.balance >= 0
            const hPct = Math.min((Math.abs(w.balance) / maxAbs) * 50, 50)
            const bb = base.weeks[i].balance
            const ghostPct = Math.min((Math.abs(bb) / maxAbs) * 50, 50)
            const ghostPos = bb >= 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center" title={`Week of ${formatDate(w.startStr)}: ${formatCurrency(w.balance)}`}>
                <div className="flex-1 w-full flex flex-col justify-end items-center relative">
                  {activeDeferrals > 0 && ghostPos && <div className="absolute bottom-0 w-full border border-dashed border-white/15 rounded-t-sm" style={{ height: `${ghostPct}%` }} />}
                  {pos && <div className="w-full bg-emerald-500/80 rounded-t-sm min-h-[2px]" style={{ height: `${hPct}%` }} />}
                </div>
                <div className="w-full border-t border-[#3a3a4a]" />
                <div className="flex-1 w-full flex flex-col justify-start items-center relative">
                  {activeDeferrals > 0 && !ghostPos && <div className="absolute top-0 w-full border border-dashed border-white/15 rounded-b-sm" style={{ height: `${ghostPct}%` }} />}
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

        {/* Drivers + what-if controls */}
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center gap-2">
            <CalendarClock size={15} className="text-white/70" />
            <h3 className="text-sm font-semibold text-white">Outflows — try deferring</h3>
          </div>
          <div className="divide-y divide-[#2a2a3a] max-h-96 overflow-y-auto">
            {outflows.map(e => {
              const d = defer[e.id] ?? 0
              return (
                <div key={e.id} className="px-5 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{e.label}</div>
                      <div className="text-xs text-[#8888aa]">
                        {formatDate(e.date)}{d ? <span className="text-indigo-300"> → {formatDate(addDays(e.date, d))}</span> : null}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums shrink-0 text-red-400">-{formatCurrency(e.amount)}</div>
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {[[7, '+1w'], [14, '+2w'], [30, '+1m']].map(([days, lbl]) => (
                      <button key={days} onClick={() => setShift(e.id, days as number)}
                        className={`text-[11px] rounded-full px-2.5 py-0.5 border transition-colors ${
                          d === days ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200' : 'border-[#2a2a3a] text-[#8888aa] hover:border-white/30'
                        }`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
            {outflows.length === 0 && <div className="py-8 text-center text-[#8888aa] text-sm">No deferrable outflows in the window.</div>}
          </div>
          {inflows.length > 0 && (
            <div className="border-t border-[#2a2a3a]">
              <div className="px-5 py-2 text-[11px] font-medium text-[#8888aa] uppercase">Expected inflows</div>
              {inflows.slice(0, 6).map(e => (
                <div key={e.id} className="px-5 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{e.label}</div>
                    <div className="text-xs text-[#8888aa]">{formatDate(e.date)}</div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums shrink-0 text-emerald-400">+{formatCurrency(e.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-[#5a5a7a]">Includes overdue &amp; upcoming liabilities, approved-but-unpaid payments, expected receivables, and monthly payroll (assumed on the 1st). Deferring here is a what-if only — it does <strong>not</strong> change any record. This is a forecast; verify before acting.</p>
    </div>
  )
}
