import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, Banknote, PiggyBank } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { formatCurrency } from '@/lib/utils'
import { computeFilmPnl, PHASE_ORDER, PHASE_LABELS, type Phase } from '@/lib/pnl'

export const dynamic = 'force-dynamic'

// Film P&L — total cost (all phases) vs realized revenue, one screen, per film.
// Finance-only: it reads the finance-RLS tables (budget_lines, payments, petty, crew).
export default async function FilmPnlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireProfile()
  if (!['founder', 'accountant'].includes(profile.role)) redirect(`/projects/${id}`)

  const supabase = await createClient()
  const [{ data: project }, { data: budgetLines }, { data: payments }, { data: pettyFloats }, { data: crew }, { data: income }, { data: deals }] =
    await Promise.all([
      supabase.from('projects').select('id, name').eq('id', id).single(),
      supabase.from('budget_lines').select('id, phase, estimated').eq('project_id', id),
      supabase.from('payment_requests').select('payment_status, net_payable, amount, budget_line_id').eq('project_id', id),
      supabase.from('petty_cash_floats').select('txns:petty_cash_txns(type, amount, budget_line_id)').eq('project_id', id),
      supabase.from('project_crew').select('budget_line_id, payments:crew_payments(amount)').eq('project_id', id),
      supabase.from('project_income').select('amount, source').eq('project_id', id),
      supabase.from('project_deals').select('kind, counterparty, mg_amount, total_value, received_amount, status').eq('project_id', id),
    ])

  if (!project) notFound()

  const pnl = computeFilmPnl({
    budgetLines: budgetLines ?? [],
    payments: payments ?? [],
    pettyFloats: pettyFloats ?? [],
    crew: crew ?? [],
    income: income ?? [],
    deals: deals ?? [],
  })

  const netPositive = pnl.net >= 0
  const phaseRows = PHASE_ORDER
    .map((ph: Phase) => ({ ph, est: pnl.estimatedByPhase[ph], act: pnl.costByPhase[ph] }))
    .filter(r => r.est !== 0 || r.act !== 0)

  return (
    <div className="max-w-5xl mx-auto">
      <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-xs text-[#8888aa] hover:text-white mb-4">
        <ArrowLeft size={13} /> Back to project
      </Link>
      <PageHeader title={`${project.name} — P&L`} subtitle="Total cost across all phases vs realized revenue. Actuals come only from the payment pipeline." />

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Cost" value={formatCurrency(pnl.totalCost)} subtitle={`Est. ${formatCurrency(pnl.totalEstimated)}`} icon={Wallet} />
        <StatCard title="Revenue Realized" value={formatCurrency(pnl.revenueRealized)} subtitle={`Income ${formatCurrency(pnl.incomeRealized)} · Deals ${formatCurrency(pnl.dealsReceived)}`} icon={Banknote} status="green" />
        <StatCard title="Net P&L" value={formatCurrency(pnl.net)} subtitle={netPositive ? 'Profit' : 'Loss'} icon={netPositive ? TrendingUp : TrendingDown} status={netPositive ? 'green' : 'red'} />
        <StatCard title="ROI" value={pnl.roiPct === null ? '—' : `${pnl.roiPct.toFixed(1)}%`} subtitle={`Contracted ahead ${formatCurrency(pnl.dealsContracted)}`} icon={PiggyBank} status={pnl.roiPct === null ? 'default' : pnl.roiPct >= 0 ? 'green' : 'red'} />
      </div>

      {/* Cost by phase */}
      <div className="rounded-2xl border border-[#2a2a3a] bg-[#13131a] p-5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-3">Cost by phase</h2>
        {phaseRows.length === 0 ? (
          <p className="text-sm text-[#8888aa]">No costs recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-[#666688] text-left">
                <th className="pb-2 font-medium">Phase</th>
                <th className="pb-2 font-medium text-right">Estimated</th>
                <th className="pb-2 font-medium text-right">Actual</th>
                <th className="pb-2 font-medium text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {phaseRows.map(({ ph, est, act }) => {
                const variance = est - act
                return (
                  <tr key={ph} className="border-t border-[#2a2a3a]">
                    <td className="py-2 text-[#c8c8da]">{PHASE_LABELS[ph]}</td>
                    <td className="py-2 text-right text-[#8888aa] tabular-nums">{formatCurrency(est)}</td>
                    <td className="py-2 text-right text-white tabular-nums">{formatCurrency(act)}</td>
                    <td className={`py-2 text-right tabular-nums ${variance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatCurrency(variance)}</td>
                  </tr>
                )
              })}
              <tr className="border-t border-[#2a2a3a] font-semibold">
                <td className="py-2 text-white">Total</td>
                <td className="py-2 text-right text-[#8888aa] tabular-nums">{formatCurrency(pnl.totalEstimated)}</td>
                <td className="py-2 text-right text-white tabular-nums">{formatCurrency(pnl.totalCost)}</td>
                <td className={`py-2 text-right tabular-nums ${pnl.totalEstimated - pnl.totalCost < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatCurrency(pnl.totalEstimated - pnl.totalCost)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* Revenue breakdown */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-[#2a2a3a] bg-[#13131a] p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Income by stream</h2>
          {pnl.incomeByStream.length === 0 ? (
            <p className="text-sm text-[#8888aa]">No income recorded yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {pnl.incomeByStream.map(s => (
                <li key={s.stream} className="flex justify-between">
                  <span className="text-[#c8c8da]">{s.stream}</span>
                  <span className="text-white tabular-nums">{formatCurrency(s.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-[#2a2a3a] bg-[#13131a] p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Deals — received vs outstanding</h2>
          {pnl.dealRows.length === 0 ? (
            <p className="text-sm text-[#8888aa]">No deals recorded yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {pnl.dealRows.map((d, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-[#c8c8da] truncate">{d.label}</span>
                  <span className="tabular-nums whitespace-nowrap"><span className="text-emerald-400">{formatCurrency(d.received)}</span> <span className="text-[#666688]">/ {formatCurrency(d.outstanding)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
