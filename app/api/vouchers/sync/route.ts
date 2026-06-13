import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { expensePaymentLines, incomeReceiptLines, gstLedgerNames, type GstSplit, type TallyLine } from '@/lib/tally'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

// Auto-generate Tally-style vouchers from approved/paid payments and recorded
// income. Idempotent (one voucher per source). Finance only. Runs through the
// user's RLS-scoped client, so the period lock and permissions apply.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!me?.is_active || !['founder', 'accountant'].includes(me.role)) return NextResponse.json({ error: 'Finance only' }, { status: 403 })

  // Config (ledger names + GST split) from app_settings, with defaults
  const { data: settings } = await supabase.from('app_settings').select('key, value').in('key', ['tally_bank_ledger', 'tally_gst_split', 'tally_tds_ledger'])
  const cfg = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]))
  const bankLedger = cfg['tally_bank_ledger'] || 'Cash'
  const gstSplit = (cfg['tally_gst_split'] as GstSplit) || 'cgst_sgst'
  const tdsLedger = cfg['tally_tds_ledger'] || 'TDS Payable'

  // Already-linked sources, so we don't double-create
  const { data: linked } = await supabase.from('vouchers').select('source_type, source_id').not('source_type', 'is', null)
  const done = new Set((linked ?? []).map((v: Row) => `${v.source_type}:${v.source_id}`))

  const [{ data: pays }, { data: incomes }] = await Promise.all([
    supabase.from('payment_requests').select('*').order('created_at', { ascending: true }),
    supabase.from('project_income').select('*, project:projects(name)').order('income_date', { ascending: true }),
  ])

  const ledgersToEnsure = new Map<string, string>() // name -> parent
  let created = 0, skipped = 0
  const errors: string[] = []

  async function makeVoucher(type: 'Payment' | 'Receipt', date: string, narration: string, lines: TallyLine[], src: string, srcId: string) {
    const { data: v, error } = await supabase.from('vouchers').insert({
      voucher_type: type, voucher_date: date, narration: narration.slice(0, 500) || null, source_type: src, source_id: srcId,
    }).select().single()
    if (error || !v) {
      if (/locked/i.test(error?.message ?? '')) skipped++       // period-locked: leave it
      else errors.push(error?.message?.slice(0, 80) ?? 'insert failed')
      return
    }
    const entries = lines.filter(l => l.ledger && l.amount > 0).map((l, i) => ({ voucher_id: v.id, ledger_name: l.ledger, dr: l.dr, amount: Math.round(l.amount * 100) / 100, sort_order: i }))
    await supabase.from('voucher_entries').insert(entries)
    created++
  }

  for (const p of (pays ?? []) as Row[]) {
    if (done.has(`payment:${p.id}`)) continue
    const settled = p.approval_status === 'approved' || p.payment_status === 'paid' || p.approval_status === 'paid'
    if (!settled) continue
    const gst = Number(p.gst_amount || 0), tds = Number(p.tds_amount || 0)
    const gross = Number(p.amount || 0) + gst
    if (gross <= 0) continue
    const party = String(p.payee || 'Sundry Party').trim()
    const date = String(p.paid_at ?? p.created_at ?? '').slice(0, 10)
    const lines = expensePaymentLines({ party, bankLedger, gross, gstAmount: gst, tdsAmount: tds, gstSplit, tdsLedger })
    await makeVoucher('Payment', date, [p.category, p.purpose].filter(Boolean).join(' — '), lines, 'payment', p.id)
    ledgersToEnsure.set(party, 'Sundry Creditors')
    if (gst > 0) for (const n of gstLedgerNames(gstSplit, false)) ledgersToEnsure.set(n, 'Duties & Taxes')
    if (tds > 0) ledgersToEnsure.set(tdsLedger, 'Duties & Taxes')
  }

  for (const i of (incomes ?? []) as Row[]) {
    if (done.has(`income:${i.id}`)) continue
    if (i.status && i.status !== 'received') continue
    const gst = Number(i.gst_amount || 0)
    const gross = Number(i.amount || 0) + gst
    if (gross <= 0) continue
    const party = String(i.party || i.source || (i.project?.name ? `${i.project.name} Income` : 'Income')).trim()
    const date = String(i.income_date ?? i.created_at ?? '').slice(0, 10)
    const lines = incomeReceiptLines({ party, bankLedger, gross, gstAmount: gst, gstSplit })
    await makeVoucher('Receipt', date, [i.source, i.project?.name, i.notes].filter(Boolean).join(' — '), lines, 'income', i.id)
    ledgersToEnsure.set(party, 'Sales Accounts')
    if (gst > 0) for (const n of gstLedgerNames(gstSplit, true)) ledgersToEnsure.set(n, 'Duties & Taxes')
  }

  // Keep the chart of accounts complete
  if (ledgersToEnsure.size) {
    ledgersToEnsure.set(bankLedger, /cash/i.test(bankLedger) ? 'Cash-in-Hand' : 'Bank Accounts')
    await supabase.from('ledgers').upsert([...ledgersToEnsure.entries()].map(([name, parent]) => ({ name, parent })), { onConflict: 'name', ignoreDuplicates: true })
  }

  return NextResponse.json({ ok: true, created, skipped, errors: errors.slice(0, 5) })
}
