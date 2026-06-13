import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectAnomalies, anomalyConfigured } from '@/lib/ai/anomaly'
import { noteAiResult, isCreditError } from '@/lib/ai/health'
import { aiUsage, recordAiUse } from '@/lib/ai/usage'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

// On-demand AI financial review. Finance only. Builds aggregates (no raw dumps),
// respects the monthly AI cap, and classifies credit errors for the banner.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!me?.is_active || !['founder', 'accountant'].includes(me.role)) return NextResponse.json({ error: 'Finance only' }, { status: 403 })
  if (!anomalyConfigured()) return NextResponse.json({ error: 'AI not configured (ANTHROPIC_API_KEY missing).' }, { status: 503 })

  const cap = await aiUsage()
  if (cap.over) return NextResponse.json({ error: `Monthly AI limit reached (${cap.used}/${cap.cap}). Raise it in Settings to continue.` }, { status: 429 })

  const today = new Date()
  const d90 = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10)
  const d90ts = new Date(today.getTime() - 90 * 86400000).toISOString()
  const todayStr = today.toISOString().slice(0, 10)

  const [pays, liabs, cash, banks, budget] = await Promise.all([
    supabase.from('payment_requests').select('payee, amount, gst_amount, tds_amount, category, created_at, paid_at, approval_status, payment_status, budget_line_id, vendor:vendors(pan)').gte('created_at', d90ts),
    supabase.from('liabilities').select('party_name, balance_remaining, due_date, status').neq('status', 'cleared'),
    supabase.from('cash_entries').select('closing_cash').order('entry_date', { ascending: false }).limit(1),
    supabase.from('bank_accounts').select('current_balance').eq('is_active', true),
    supabase.from('budget_lines').select('head, estimated, budget_line_id:id, project:projects(name)'),
  ])

  const P = (pays.data ?? []) as Row[]
  const settled = P.filter(p => p.approval_status === 'approved' || p.payment_status === 'paid' || p.approval_status === 'paid')

  // Aggregate: vendor totals, category totals, monthly trend, large payments
  const byVendor: Record<string, number> = {}, byCategory: Record<string, number> = {}, byMonth: Record<string, number> = {}
  const actualByLine: Record<string, number> = {}
  for (const p of settled) {
    const amt = Number(p.amount || 0) + Number(p.gst_amount || 0)
    byVendor[p.payee || 'Unknown'] = (byVendor[p.payee || 'Unknown'] ?? 0) + amt
    byCategory[p.category || 'Uncategorised'] = (byCategory[p.category || 'Uncategorised'] ?? 0) + amt
    const m = String(p.paid_at ?? p.created_at ?? '').slice(0, 7)
    if (m) byMonth[m] = (byMonth[m] ?? 0) + amt
    if (p.budget_line_id) actualByLine[p.budget_line_id] = (actualByLine[p.budget_line_id] ?? 0) + amt
  }
  const top = (o: Record<string, number>, n: number) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ name: k, total: Math.round(v) }))
  const largePayments = [...settled].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 12)
    .map(p => ({ payee: p.payee, amount: Math.round(Number(p.amount || 0) + Number(p.gst_amount || 0)), category: p.category, date: String(p.paid_at ?? p.created_at ?? '').slice(0, 10) }))
  const overBudget = ((budget.data ?? []) as Row[])
    .map(b => ({ head: b.head, project: b.project?.name, estimated: Number(b.estimated || 0), actual: Math.round(actualByLine[b.budget_line_id] ?? 0) }))
    .filter(b => b.estimated > 0 && b.actual >= b.estimated * 0.9)
    .sort((a, b) => (b.actual / b.estimated) - (a.actual / a.estimated)).slice(0, 10)
  const tdsNoPan = settled.filter(p => Number(p.tds_amount || 0) > 0 && !p.vendor?.pan).map(p => ({ payee: p.payee, tds: Math.round(Number(p.tds_amount)) }))
  const overdueLiab = ((liabs.data ?? []) as Row[]).filter(l => l.due_date && l.due_date < todayStr).map(l => ({ party: l.party_name, balance: Math.round(Number(l.balance_remaining || 0)), due: l.due_date }))

  const snapshot = {
    period: `${d90} to ${todayStr}`,
    cash_on_hand: Math.round(Number(cash.data?.[0]?.closing_cash ?? 0)),
    bank_balance: Math.round(((banks.data ?? []) as Row[]).reduce((s, b) => s + Number(b.current_balance ?? 0), 0)),
    payment_count: settled.length,
    top_vendors_by_spend: top(byVendor, 12),
    spend_by_category: top(byCategory, 12),
    monthly_spend: Object.entries(byMonth).sort().map(([month, total]) => ({ month, total: Math.round(total) })),
    largest_payments: largePayments,
    budget_heads_near_or_over: overBudget,
    tds_without_pan: tdsNoPan.slice(0, 15),
    overdue_liabilities: overdueLiab.slice(0, 15),
  }

  try {
    const findings = await detectAnomalies(snapshot)
    await recordAiUse('anomaly-review')
    await noteAiResult(null)
    return NextResponse.json({ ok: true, findings: findings ?? [] })
  } catch (e) {
    await noteAiResult(e)
    return NextResponse.json({ error: isCreditError(e) ? 'AI is paused — Anthropic API credits are exhausted. Top up to resume.' : 'AI review failed — try again.' }, { status: isCreditError(e) ? 503 : 500 })
  }
}
