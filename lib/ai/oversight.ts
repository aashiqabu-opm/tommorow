import { createAdminClient } from '@/lib/supabase/admin'

// Redacted finance summary for non-finance leadership (Executive Producer,
// General Manager). Deliberately omits bank balances, cash-in-hand and all
// row-level transaction entries — it returns ONLY liabilities (which they are
// granted) and aggregate approval/receivable totals. This is the *only* finance
// shape that ever reaches an EP/GM brief, and it is what gets stored in their
// role_briefs row, so a non-finance role can never read a balance.
//
// Runs with the service-role client on purpose: the EP/GM session cannot read
// the finance tables under RLS, so the curated subset is assembled server-side
// and handed back already-masked.

export interface OversightFinance {
  liabilities: {
    outstanding_total: number
    overdue_total: number
    overdue: { party: string; amount: number; due: string }[]
    due_soon: { party: string; amount: number; due: string }[]
  }
  approvals: { pending_count: number; pending_total: number; approved_unpaid_total: number }
  receivables: { outstanding_total: number }
  excluded: string
}

const EXCLUDED_NOTE = 'Bank balances, cash-in-hand and individual transaction entries are intentionally excluded from this oversight view.'

function empty(): OversightFinance {
  return {
    liabilities: { outstanding_total: 0, overdue_total: 0, overdue: [], due_soon: [] },
    approvals: { pending_count: 0, pending_total: 0, approved_unpaid_total: 0 },
    receivables: { outstanding_total: 0 },
    excluded: EXCLUDED_NOTE,
  }
}

export async function buildOversightFinance(): Promise<OversightFinance> {
  const admin = createAdminClient()
  if (!admin) return empty()

  const today = new Date().toISOString().slice(0, 10)
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

  const [liab, pays, recv] = await Promise.all([
    admin.from('liabilities').select('party_name, balance_remaining, due_date, status').neq('status', 'cleared'),
    admin.from('payment_requests').select('amount, approval_status, payment_status'),
    admin.from('project_income').select('amount, status').eq('status', 'receivable'),
  ])

  const L = (liab.data ?? []) as { party_name: string; balance_remaining: number; due_date: string | null }[]
  const overdue = L.filter(l => l.due_date && (l.due_date as string) < today)
  const dueSoon = L.filter(l => l.due_date && (l.due_date as string) >= today && (l.due_date as string) <= in14)
  const P = (pays.data ?? []) as { amount: number; approval_status: string; payment_status: string }[]

  return {
    liabilities: {
      outstanding_total: L.reduce((s, l) => s + Number(l.balance_remaining || 0), 0),
      overdue_total: overdue.reduce((s, l) => s + Number(l.balance_remaining || 0), 0),
      overdue: overdue.map(l => ({ party: l.party_name, amount: Number(l.balance_remaining || 0), due: l.due_date as string })),
      due_soon: dueSoon.map(l => ({ party: l.party_name, amount: Number(l.balance_remaining || 0), due: l.due_date as string })),
    },
    approvals: {
      pending_count: P.filter(p => p.approval_status === 'pending').length,
      pending_total: P.filter(p => p.approval_status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0),
      approved_unpaid_total: P.filter(p => p.approval_status === 'approved' && p.payment_status === 'unpaid').reduce((s, p) => s + Number(p.amount || 0), 0),
    },
    receivables: { outstanding_total: (recv.data ?? []).reduce((s, r) => s + Number((r as { amount: number }).amount || 0), 0) },
    excluded: EXCLUDED_NOTE,
  }
}
