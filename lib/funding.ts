import type { ProjectFunding, FundingTxnType } from '@/lib/types'

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.4375 // average month

export interface FundingMetrics {
  capitalIn: number
  payouts: number
  interestPaid: number
  principalRepaid: number
  outstandingPrincipal: number
  monthlyRatePct: number      // effective monthly rate (%)
  monthlyInterest: number     // interest accruing per month on outstanding principal
  monthsElapsed: number       // since start_date (fractional)
  accruedInterest: number     // total simple interest accrued to date
  outstandingInterest: number // accrued − interest paid
}

// Flat / simple monthly interest model: interest accrues on the principal at a
// fixed monthly rate. Reducing-balance is not modelled here (treated as simple).
export function fundingMetrics(f: ProjectFunding, today: Date = new Date()): FundingMetrics {
  const txns = f.transactions ?? []
  const sum = (t: FundingTxnType) => txns.filter(x => x.type === t).reduce((s, x) => s + Number(x.amount || 0), 0)

  const capitalIn = sum('capital_in')
  const payouts = sum('payout')
  const interestPaid = sum('interest_paid')
  const principalRepaid = sum('principal_repaid')
  const outstandingPrincipal = Math.max(Number(f.amount || 0) - principalRepaid, 0)

  let monthlyRatePct = 0
  let monthlyInterest = 0
  let monthsElapsed = 0
  let accruedInterest = 0

  if (f.kind === 'loan' && f.interest_rate) {
    monthlyRatePct = f.interest_basis === 'annual' ? Number(f.interest_rate) / 12 : Number(f.interest_rate)
    monthlyInterest = outstandingPrincipal * (monthlyRatePct / 100)
    if (f.start_date) {
      const ms = today.getTime() - new Date(f.start_date + 'T00:00:00').getTime()
      monthsElapsed = ms > 0 ? ms / MS_PER_MONTH : 0
    }
    // Simple interest accrued on original principal over elapsed months
    accruedInterest = Number(f.amount || 0) * (monthlyRatePct / 100) * monthsElapsed
  }

  return {
    capitalIn, payouts, interestPaid, principalRepaid, outstandingPrincipal,
    monthlyRatePct, monthlyInterest, monthsElapsed, accruedInterest,
    outstandingInterest: Math.max(accruedInterest - interestPaid, 0),
  }
}
