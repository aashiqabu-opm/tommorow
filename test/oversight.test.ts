import { describe, it, expect, vi } from 'vitest'

// The EP/GM "oversight" finance summary must NEVER contain bank balances, cash
// position, or row-level transaction entries. This test feeds the redaction
// builder real-looking liabilities/payments/receivables (via a stubbed admin
// client) and asserts the output is the curated, redacted shape — and that no
// bank/cash data field can leak through.

const sample: Record<string, unknown[]> = {
  liabilities: [
    { party_name: 'Vendor A', balance_remaining: 1000, due_date: '2000-01-01', status: 'unpaid' }, // overdue
    { party_name: 'Vendor B', balance_remaining: 500, due_date: '2999-01-01', status: 'unpaid' },  // future
  ],
  payment_requests: [
    { amount: 300, approval_status: 'pending', payment_status: 'unpaid' },
    { amount: 700, approval_status: 'approved', payment_status: 'unpaid' },
  ],
  project_income: [{ amount: 2000, status: 'receivable' }],
}

// Minimal chainable query stub: select/eq/neq return self; awaiting resolves { data }.
function chain(rows: unknown[]) {
  const c: Record<string, unknown> = {}
  c.select = () => c
  c.eq = () => c
  c.neq = () => c
  c.then = (res: (v: { data: unknown[] }) => unknown) => Promise.resolve({ data: rows }).then(res)
  return c
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (t: string) => chain(sample[t] ?? []) }),
}))

import { buildOversightFinance } from '@/lib/ai/oversight'

describe('buildOversightFinance — EP/GM redaction guarantee', () => {
  it('exposes only liabilities + aggregate totals — no bank/cash data fields', async () => {
    const r = await buildOversightFinance()

    // Exactly the curated keys — nothing else.
    expect(Object.keys(r).sort()).toEqual(['approvals', 'excluded', 'liabilities', 'receivables'])

    // No bank/cash data properties anywhere in the structure.
    expect(r).not.toHaveProperty('bankBalance')
    expect(r).not.toHaveProperty('cashOnHand')
    expect(r).not.toHaveProperty('bank_balance')
    expect(r.liabilities).not.toHaveProperty('bank')
    expect(r.approvals).not.toHaveProperty('cash')

    // The disclaimer must positively state bank/cash are excluded.
    expect(r.excluded.toLowerCase()).toContain('bank')
    expect(r.excluded.toLowerCase()).toContain('cash')
  })

  it('computes the allowed aggregates correctly', async () => {
    const r = await buildOversightFinance()
    expect(r.liabilities.overdue).toHaveLength(1)
    expect(r.liabilities.overdue_total).toBe(1000)
    expect(r.liabilities.outstanding_total).toBe(1500)
    expect(r.approvals.pending_total).toBe(300)
    expect(r.approvals.approved_unpaid_total).toBe(700)
    expect(r.receivables.outstanding_total).toBe(2000)
  })
})
