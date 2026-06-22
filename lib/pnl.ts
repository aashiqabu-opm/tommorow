// ─────────────────────────────────────────────
// FILM P&L — the most important number in the company, computed on read.
//
// ONE-TRUTH RULE: cost actuals come ONLY from the payment pipeline —
//   paid payment_requests (net_payable ?? amount) + expense petty-cash txns +
//   crew payments — exactly the set the budget page already sums. We map each
//   cost rupee to a production phase via budget_lines.phase (through
//   budget_line_id); anything not coded to a head is 'unclassified'.
//   Nothing here reads daily_cost_lines / vendor_advances / purchase_orders —
//   those are reporting/commitment layers, never summed into actual.
//
// Revenue is per-project realized money in: project_income.amount +
//   project_deals.received_amount. Contracted-but-not-yet-received deal value is
//   reported separately (never added into Net). Box office gross is deliberately
//   excluded — it is not OPM's share.
// ─────────────────────────────────────────────

export type Phase = 'development' | 'pre' | 'production' | 'post' | 'release' | 'unclassified'

export const PHASE_ORDER: Phase[] = ['development', 'pre', 'production', 'post', 'release', 'unclassified']
export const PHASE_LABELS: Record<Phase, string> = {
  development: 'Development',
  pre: 'Pre-Production',
  production: 'Production',
  post: 'Post-Production',
  release: 'Marketing & Release',
  unclassified: 'Unclassified',
}

export interface PnlInputs {
  budgetLines: { id: string; phase: string | null; estimated: number | string | null }[]
  payments: {
    payment_status?: string | null
    net_payable?: number | string | null
    amount?: number | string | null
    budget_line_id?: string | null
  }[]
  pettyFloats: { txns?: { type?: string | null; amount?: number | string | null; budget_line_id?: string | null }[] }[]
  crew: { budget_line_id?: string | null; payments?: { amount?: number | string | null }[] }[]
  income: { amount?: number | string | null; source?: string | null }[]
  deals: {
    kind?: string | null
    counterparty?: string | null
    mg_amount?: number | string | null
    total_value?: number | string | null
    received_amount?: number | string | null
    status?: string | null
  }[]
}

export interface PnlResult {
  costByPhase: Record<Phase, number>
  estimatedByPhase: Record<Phase, number>
  totalCost: number
  totalEstimated: number
  incomeRealized: number
  dealsReceived: number
  revenueRealized: number
  dealsContracted: number // committed deal value not yet received
  net: number // revenueRealized − totalCost
  roiPct: number | null // net / totalCost
  incomeByStream: { stream: string; amount: number }[]
  dealRows: { label: string; received: number; outstanding: number }[]
}

const n = (v: number | string | null | undefined): number => Number(v ?? 0) || 0
const zeroByPhase = (): Record<Phase, number> =>
  ({ development: 0, pre: 0, production: 0, post: 0, release: 0, unclassified: 0 })

export function computeFilmPnl(input: PnlInputs): PnlResult {
  // line id → phase (default unclassified)
  const phaseOf = new Map<string, Phase>()
  const estimatedByPhase = zeroByPhase()
  for (const b of input.budgetLines) {
    const ph = (PHASE_ORDER.includes(b.phase as Phase) ? b.phase : 'unclassified') as Phase
    phaseOf.set(b.id, ph)
    estimatedByPhase[ph] += n(b.estimated)
  }

  const costByPhase = zeroByPhase()
  const addCost = (lineId: string | null | undefined, amt: number) => {
    if (amt === 0) return
    const ph = (lineId && phaseOf.get(lineId)) || 'unclassified'
    costByPhase[ph] += amt
  }

  // 1) paid payment_requests (net_payable preferred, like the budget page)
  for (const p of input.payments) {
    if (p.payment_status === 'paid') addCost(p.budget_line_id, n(p.net_payable ?? p.amount))
  }
  // 2) petty-cash expense txns
  for (const f of input.pettyFloats) {
    for (const t of f.txns ?? []) if (t.type === 'expense') addCost(t.budget_line_id, n(t.amount))
  }
  // 3) crew payments
  for (const c of input.crew) {
    const paid = (c.payments ?? []).reduce((s, p) => s + n(p.amount), 0)
    addCost(c.budget_line_id, paid)
  }

  const totalCost = PHASE_ORDER.reduce((s, ph) => s + costByPhase[ph], 0)
  const totalEstimated = PHASE_ORDER.reduce((s, ph) => s + estimatedByPhase[ph], 0)

  // Revenue — realized only into Net; contracted reported separately
  const incomeRealized = input.income.reduce((s, i) => s + n(i.amount), 0)
  const dealsReceived = input.deals.reduce((s, d) => s + n(d.received_amount), 0)
  const revenueRealized = incomeRealized + dealsReceived
  const dealsContracted = input.deals.reduce((s, d) => {
    const value = n(d.total_value || d.mg_amount)
    const outstanding = value - n(d.received_amount)
    return s + (outstanding > 0 ? outstanding : 0)
  }, 0)

  // breakdowns
  const incomeMap = new Map<string, number>()
  for (const i of input.income) {
    const k = (i.source || 'Other').toString()
    incomeMap.set(k, (incomeMap.get(k) ?? 0) + n(i.amount))
  }
  const incomeByStream = [...incomeMap.entries()]
    .map(([stream, amount]) => ({ stream, amount }))
    .sort((a, b) => b.amount - a.amount)

  const dealRows = input.deals.map(d => {
    const value = n(d.total_value || d.mg_amount)
    const received = n(d.received_amount)
    const label = [d.kind, d.counterparty].filter(Boolean).join(' · ') || 'Deal'
    return { label, received, outstanding: Math.max(value - received, 0) }
  })

  const net = revenueRealized - totalCost
  const roiPct = totalCost > 0 ? (net / totalCost) * 100 : null

  return {
    costByPhase,
    estimatedByPhase,
    totalCost,
    totalEstimated,
    incomeRealized,
    dealsReceived,
    revenueRealized,
    dealsContracted,
    net,
    roiPct,
    incomeByStream,
    dealRows,
  }
}
