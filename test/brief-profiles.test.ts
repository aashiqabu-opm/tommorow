import { describe, it, expect } from 'vitest'
import { PROFILES } from '@/lib/ai/brief'

// Locks the finance boundary in the brief profile registry: EP/GM must use the
// redacted oversight finance (never the full snapshot, which carries bank
// balances), and only the founder writes to the private founder_briefs table.

describe('brief profiles — finance boundary', () => {
  it('EP and GM use redacted oversight finance, not the full snapshot', () => {
    expect(PROFILES.executive_producer.finance).toBe('oversight')
    expect(PROFILES.general_manager.finance).toBe('oversight')
  })

  it('founder and accountant get full finance', () => {
    expect(PROFILES.founder.finance).toBe('full')
    expect(PROFILES.accountant.finance).toBe('full')
  })

  it('EP/GM do not pull itemized receivables', () => {
    expect(PROFILES.executive_producer.includeReceivables).toBe(false)
    expect(PROFILES.general_manager.includeReceivables).toBe(false)
  })

  it('only the founder writes to the private founder_briefs table', () => {
    expect(PROFILES.founder.table).toBe('founder_briefs')
    expect(PROFILES.accountant.table).toBe('role_briefs')
    expect(PROFILES.executive_producer.table).toBe('role_briefs')
    expect(PROFILES.general_manager.table).toBe('role_briefs')
  })
})
