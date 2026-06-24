import type { WhatMattersItem } from '@/components/ui/WhatMatters'

// Deterministic, page-scoped "what matters" builders. Pure functions over rows
// the pages already fetch — no new queries, no AI. Each returns the few items
// that need attention on that page, ordered red → amber → blue by construction.

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const TODAY = () => new Date().toISOString().slice(0, 10)
const PLUS = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

type PayRow = { amount?: number; net_payable?: number | null; approval_status?: string; payment_status?: string; verification_status?: string }
export function paymentsWhatMatters(requests: PayRow[]): WhatMattersItem[] {
  const items: WhatMattersItem[] = []
  // Ready for approval = verified but not yet approved. Unverified bills are
  // counted under "awaiting verification" below, not here — so the two lines
  // never double-count the same request.
  const pending = requests.filter(r => r.approval_status === 'pending' && r.verification_status === 'verified')
  if (pending.length) items.push({ text: `${pending.length} payment ${pending.length === 1 ? 'request' : 'requests'} pending approval (${inr(pending.reduce((s, r) => s + Number(r.amount || 0), 0))})`, tone: pending.length > 5 ? 'red' : 'amber' })
  const unpaid = requests.filter(r => r.approval_status === 'approved' && r.payment_status === 'unpaid')
  if (unpaid.length) items.push({ text: `${unpaid.length} approved ${unpaid.length === 1 ? 'payment' : 'payments'} awaiting payout (${inr(unpaid.reduce((s, r) => s + Number(r.net_payable ?? r.amount ?? 0), 0))})`, tone: 'amber' })
  const toVerify = requests.filter(r => r.verification_status === 'pending')
  if (toVerify.length) items.push({ text: `${toVerify.length} ${toVerify.length === 1 ? 'bill' : 'bills'} awaiting verification`, tone: 'blue' })
  return items
}

type LiabRow = { balance_remaining?: number; due_date?: string | null; status?: string }
export function liabilitiesWhatMatters(rows: LiabRow[]): WhatMattersItem[] {
  const items: WhatMattersItem[] = []
  const t = TODAY(), in14 = PLUS(14)
  const open = rows.filter(l => l.status !== 'cleared')
  const overdue = open.filter(l => l.due_date && (l.due_date as string) < t)
  if (overdue.length) items.push({ text: `${overdue.length} overdue ${overdue.length === 1 ? 'liability' : 'liabilities'} (${inr(overdue.reduce((s, l) => s + Number(l.balance_remaining || 0), 0))})`, tone: 'red' })
  const soon = open.filter(l => l.due_date && (l.due_date as string) >= t && (l.due_date as string) <= in14)
  if (soon.length) items.push({ text: `${soon.length} due within 14 days (${inr(soon.reduce((s, l) => s + Number(l.balance_remaining || 0), 0))})`, tone: 'amber' })
  const disputed = rows.filter(l => l.status === 'disputed')
  if (disputed.length) items.push({ text: `${disputed.length} disputed ${disputed.length === 1 ? 'item' : 'items'}`, tone: 'blue' })
  return items
}

type DocRow = { expiry_date?: string | null; status?: string; ai_analysis?: { flags?: { severity?: string }[]; key_dates?: { date?: string }[] } | null }
export function documentsWhatMatters(rows: DocRow[]): WhatMattersItem[] {
  const items: WhatMattersItem[] = []
  const t = TODAY(), in30 = PLUS(30), in45 = PLUS(45)
  const expiring = rows.filter(d => d.expiry_date && (d.expiry_date as string) >= t && (d.expiry_date as string) <= in30 && d.status !== 'expired')
  if (expiring.length) items.push({ text: `${expiring.length} ${expiring.length === 1 ? 'agreement' : 'agreements'} expiring within 30 days`, tone: 'amber' })
  const highRisk = rows.filter(d => (d.ai_analysis?.flags ?? []).some(f => f.severity === 'high'))
  if (highRisk.length) items.push({ text: `${highRisk.length} document${highRisk.length === 1 ? '' : 's'} with high-severity risk flags`, tone: 'red' })
  const keyDates = rows.filter(d => (d.ai_analysis?.key_dates ?? []).some(k => k.date && (k.date as string) >= t && (k.date as string) <= in45))
  if (keyDates.length) items.push({ text: `${keyDates.length} upcoming contract date${keyDates.length === 1 ? '' : 's'} within 45 days`, tone: 'blue' })
  return items
}

type FcEvent = { date: string; amount: number; dir: 'in' | 'out' }
export function forecastWhatMatters(events: FcEvent[], startBalance: number): WhatMattersItem[] {
  const items: WhatMattersItem[] = []
  const sorted = [...events].sort((a, b) => (a.date < b.date ? -1 : 1))
  let bal = startBalance, minBal = startBalance, minDate = TODAY()
  for (const e of sorted) { bal += e.dir === 'in' ? e.amount : -e.amount; if (bal < minBal) { minBal = bal; minDate = e.date } }
  if (startBalance <= 0) items.push({ text: `Starting cash position is ${inr(startBalance)} — fund before commitments clear`, tone: 'red' })
  if (minBal < 0) items.push({ text: `Projected cash shortfall — balance dips to ${inr(minBal)} around ${fmtDate(minDate)}`, tone: 'red' })
  else if (startBalance > 0 && minBal < startBalance * 0.2) items.push({ text: `Tight runway — lowest projected balance ${inr(minBal)} around ${fmtDate(minDate)}`, tone: 'amber' })
  return items
}

type BudgetRow = { id: string; estimated?: number }
type ProjPay = { budget_line_id?: string | null; amount?: number; net_payable?: number | null; payment_status?: string; approval_status?: string }
type Checkin = { blockers?: string | null; checkin_date?: string }
export function projectWhatMatters(checkins: Checkin[], budgetLines: BudgetRow[], payments: ProjPay[], extraSpentByLine: Record<string, number>): WhatMattersItem[] {
  const items: WhatMattersItem[] = []
  const since = PLUS(-14)
  const blockers = checkins.filter(c => c.blockers && c.blockers.trim() && (!c.checkin_date || (c.checkin_date as string) >= since))
  if (blockers.length) items.push({ text: `${blockers.length} ${blockers.length === 1 ? 'blocker' : 'blockers'} flagged in recent check-ins`, tone: 'amber' })
  if (budgetLines.length) {
    const spent: Record<string, number> = { ...extraSpentByLine }
    for (const p of payments) {
      if (p.budget_line_id && (p.payment_status === 'paid' || p.approval_status === 'approved')) spent[p.budget_line_id] = (spent[p.budget_line_id] ?? 0) + Number(p.net_payable ?? p.amount ?? 0)
    }
    const over = budgetLines.filter(l => Number(l.estimated || 0) > 0 && (spent[l.id] ?? 0) > Number(l.estimated))
    const near = budgetLines.filter(l => Number(l.estimated || 0) > 0 && (spent[l.id] ?? 0) >= 0.9 * Number(l.estimated) && (spent[l.id] ?? 0) <= Number(l.estimated))
    if (over.length) items.push({ text: `${over.length} budget ${over.length === 1 ? 'head' : 'heads'} over estimate`, tone: 'red' })
    else if (near.length) items.push({ text: `${near.length} budget ${near.length === 1 ? 'head' : 'heads'} ≥90% of estimate`, tone: 'amber' })
  }
  return items
}
