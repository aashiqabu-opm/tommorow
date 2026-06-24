import { describe, it, expect } from 'vitest'
import {
  paymentsWhatMatters,
  liabilitiesWhatMatters,
  documentsWhatMatters,
  forecastWhatMatters,
  projectWhatMatters,
} from '@/lib/what-matters'

const iso = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)

describe('paymentsWhatMatters', () => {
  it('counts only verified+pending bills as "pending approval" (no double-count)', () => {
    const items = paymentsWhatMatters([
      { approval_status: 'pending', verification_status: 'verified', amount: 1000 },           // pending approval
      { approval_status: 'pending', verification_status: 'pending', amount: 200 },             // awaiting verification ONLY
      { approval_status: 'approved', payment_status: 'unpaid', net_payable: 450, amount: 500 }, // awaiting payout
    ])
    const pending = items.find(i => i.text.includes('pending approval'))
    expect(pending?.text).toContain('1 payment request pending approval')
    expect(pending?.tone).toBe('amber')
    expect(items.find(i => i.text.includes('awaiting payout'))?.text).toContain('₹450')
    expect(items.find(i => i.text.includes('awaiting verification'))?.text).toContain('1 bill')
  })

  it('flags red when more than 5 are pending approval', () => {
    const rows = Array.from({ length: 6 }, () => ({ approval_status: 'pending', verification_status: 'verified', amount: 100 }))
    expect(paymentsWhatMatters(rows).find(i => i.text.includes('pending approval'))?.tone).toBe('red')
  })

  it('returns nothing when all clear', () => {
    expect(paymentsWhatMatters([{ approval_status: 'approved', payment_status: 'paid', verification_status: 'verified' }])).toHaveLength(0)
  })
})

describe('liabilitiesWhatMatters', () => {
  it('separates overdue (red), due-soon (amber) and disputed (blue)', () => {
    const items = liabilitiesWhatMatters([
      { balance_remaining: 1000, due_date: iso(-3), status: 'unpaid' },  // overdue
      { balance_remaining: 500, due_date: iso(7), status: 'unpaid' },    // due soon
      { balance_remaining: 300, due_date: iso(60), status: 'disputed' }, // disputed (and not due-soon)
      { balance_remaining: 999, due_date: iso(-1), status: 'cleared' },  // cleared → ignored
    ])
    expect(items.find(i => i.text.includes('overdue'))).toMatchObject({ tone: 'red' })
    expect(items.find(i => i.text.includes('overdue'))?.text).toContain('₹1,000')
    expect(items.find(i => i.text.includes('within 14 days'))).toMatchObject({ tone: 'amber' })
    expect(items.find(i => i.text.includes('disputed'))).toMatchObject({ tone: 'blue' })
  })
})

describe('documentsWhatMatters', () => {
  it('flags expiring, high-severity risk, and upcoming key dates', () => {
    const items = documentsWhatMatters([
      { expiry_date: iso(10), status: 'active' },                                   // expiring ≤30d
      { ai_analysis: { flags: [{ severity: 'high' }] } },                            // high-risk
      { ai_analysis: { key_dates: [{ date: iso(20) }] } },                           // key date ≤45d
      { expiry_date: iso(200), status: 'active' },                                   // far off → ignored
    ])
    expect(items.find(i => i.text.includes('expiring'))).toMatchObject({ tone: 'amber' })
    expect(items.find(i => i.text.includes('high-severity'))).toMatchObject({ tone: 'red' })
    expect(items.find(i => i.text.includes('contract date'))).toMatchObject({ tone: 'blue' })
  })
})

describe('forecastWhatMatters', () => {
  it('flags a projected shortfall when running balance dips below zero', () => {
    const items = forecastWhatMatters([{ date: iso(5), amount: 1500, dir: 'out' }], 1000)
    expect(items.find(i => i.text.includes('shortfall'))).toMatchObject({ tone: 'red' })
  })

  it('stays quiet when the balance holds comfortably', () => {
    const items = forecastWhatMatters([{ date: iso(5), amount: 100, dir: 'out' }], 100000)
    expect(items).toHaveLength(0)
  })
})

describe('projectWhatMatters', () => {
  it('flags recent blockers and over-budget heads', () => {
    const items = projectWhatMatters(
      [{ blockers: 'generator down', checkin_date: iso(-2) }, { blockers: '', checkin_date: iso(-1) }],
      [{ id: 'L1', estimated: 1000 }],
      [{ budget_line_id: 'L1', amount: 1500, payment_status: 'paid' }],
      {},
    )
    expect(items.find(i => i.text.includes('blocker'))).toMatchObject({ tone: 'amber' })
    expect(items.find(i => i.text.includes('over estimate'))).toMatchObject({ tone: 'red' })
  })

  it('ignores stale blockers older than 14 days', () => {
    const items = projectWhatMatters([{ blockers: 'old issue', checkin_date: iso(-30) }], [], [], {})
    expect(items).toHaveLength(0)
  })
})
