'use client'

import { useState } from 'react'
import { Download, FileCode, Table, BookOpen, Coins, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { buildVoucherXml, buildLedgerXml, buildVoucherCsv, expensePaymentLines, incomeReceiptLines, gstLedgerNames, type TallyVoucher, type TallyLedger, type GstSplit } from '@/lib/tally'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

function startOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10) }
function today() { return new Date().toISOString().slice(0, 10) }

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click()
  URL.revokeObjectURL(a.href)
}

export function TallyClient() {
  const toast = useToast()
  const [from, setFrom] = useState(startOfMonth())
  const [to, setTo] = useState(today())
  const [company, setCompany] = useState('')
  const [bankLedger, setBankLedger] = useState('Cash')
  const [gstSplit, setGstSplit] = useState<GstSplit>('cgst_sgst')
  const [tdsLedger, setTdsLedger] = useState('TDS Payable')
  const [busy, setBusy] = useState(false)
  const [counts, setCounts] = useState<{ payments: number; income: number } | null>(null)

  // Pull approved/paid payments + received income in range and map to vouchers.
  async function buildVouchers(): Promise<{ vouchers: TallyVoucher[]; ledgers: TallyLedger[] }> {
    const supabase = createClient()
    const [pay, inc] = await Promise.all([
      supabase.from('payment_requests').select('*').order('created_at', { ascending: true }),
      supabase.from('project_income').select('*, project:projects(name)').gte('income_date', from).lte('income_date', to).order('income_date', { ascending: true }),
    ])

    const vouchers: TallyVoucher[] = []
    const ledgerSet = new Map<string, string>() // name -> parent
    let usedInputGst = false, usedOutputGst = false, usedTds = false

    for (const p of (pay.data ?? []) as Row[]) {
      const settled = p.approval_status === 'approved' || p.payment_status === 'paid' || p.approval_status === 'paid'
      if (!settled) continue
      const date = (p.paid_at ?? p.created_at ?? '').slice(0, 10)
      if (!date || date < from || date > to) continue
      const party = String(p.payee || 'Sundry Party').trim()
      const gstAmount = Number(p.gst_amount ?? 0)
      const tdsAmount = Number(p.tds_amount ?? 0)
      // payment_requests.amount is the BASE (excl GST); gross = base + GST
      const gross = Number(p.amount ?? 0) + gstAmount
      if (gross <= 0) continue
      vouchers.push({
        date, type: 'Payment', partyLedger: party,
        narration: [p.category, p.purpose].filter(Boolean).join(' — '),
        lines: expensePaymentLines({ party, bankLedger, gross, gstAmount, tdsAmount, gstSplit, tdsLedger }),
      })
      ledgerSet.set(party, 'Sundry Creditors')
      if (gstAmount > 0) usedInputGst = true
      if (tdsAmount > 0) usedTds = true
    }

    for (const i of (inc.data ?? []) as Row[]) {
      const status = i.status
      if (status && status !== 'received') continue // only actual receipts
      const date = String(i.income_date || i.created_at || '').slice(0, 10)
      if (!date || date < from || date > to) continue
      const party = String(i.party || i.source || (i.project?.name ? `${i.project.name} Income` : 'Income')).trim()
      const gstAmount = Number(i.gst_amount ?? 0)
      // income amount is the base (excl GST); gross received = base + GST
      const gross = Number(i.amount ?? 0) + gstAmount
      if (gross <= 0) continue
      vouchers.push({
        date, type: 'Receipt', partyLedger: party,
        narration: [i.source, i.project?.name, i.notes].filter(Boolean).join(' — '),
        lines: incomeReceiptLines({ party, bankLedger, gross, gstAmount, gstSplit }),
      })
      ledgerSet.set(party, 'Sales Accounts')
      if (gstAmount > 0) usedOutputGst = true
    }

    // Bank/Cash + tax ledger masters
    ledgerSet.set(bankLedger, /cash/i.test(bankLedger) ? 'Cash-in-Hand' : 'Bank Accounts')
    if (usedInputGst) for (const n of gstLedgerNames(gstSplit, false)) ledgerSet.set(n, 'Duties & Taxes')
    if (usedOutputGst) for (const n of gstLedgerNames(gstSplit, true)) ledgerSet.set(n, 'Duties & Taxes')
    if (usedTds) ledgerSet.set(tdsLedger, 'Duties & Taxes')
    const ledgers: TallyLedger[] = [...ledgerSet.entries()].map(([name, parent]) => ({ name, parent }))
    return { vouchers, ledgers }
  }

  async function exportXml() {
    setBusy(true)
    try {
      const { vouchers } = await buildVouchers()
      if (!vouchers.length) { toast.error('No approved payments or received income in that range'); setBusy(false); return }
      download(`tally-vouchers-${from}_to_${to}.xml`, buildVoucherXml(vouchers, company.trim()), 'application/xml')
      const p = vouchers.filter(v => v.type === 'Payment').length
      setCounts({ payments: p, income: vouchers.length - p })
      toast.success(`Exported ${vouchers.length} vouchers`)
    } catch { toast.error('Export failed') }
    setBusy(false)
  }

  // Step 1: full Chart of Accounts — every ledger in the books (with opening
  // balances) PLUS any party/tax ledgers the period's vouchers reference, so
  // one import seeds Tally completely and no voucher import ever fails.
  async function exportMasters() {
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: chart } = await supabase.from('ledgers').select('name, parent, opening_balance').order('name')
      const map = new Map<string, TallyLedger>()
      for (const l of (chart ?? []) as Row[]) map.set(l.name, { name: l.name, parent: l.parent, opening: Number(l.opening_balance || 0) })
      const { ledgers } = await buildVouchers()
      for (const l of ledgers) if (!map.has(l.name)) map.set(l.name, l)
      const all = [...map.values()]
      if (!all.length) { toast.error('No ledgers yet — add them on the Vouchers page first'); setBusy(false); return }
      download(`tally-chart-of-accounts.xml`, buildLedgerXml(all, company.trim()), 'application/xml')
      toast.success(`Exported ${all.length} ledgers`)
    } catch { toast.error('Export failed') }
    setBusy(false)
  }

  async function exportCsv() {
    setBusy(true)
    try {
      const { vouchers } = await buildVouchers()
      if (!vouchers.length) { toast.error('Nothing to export in that range'); setBusy(false); return }
      download(`tally-vouchers-${from}_to_${to}.csv`, buildVoucherCsv(vouchers), 'text/csv')
      toast.success(`Exported ${vouchers.length} rows`)
    } catch { toast.error('Export failed') }
    setBusy(false)
  }

  // Supplementary REVIEW reports — NOT Tally vouchers. Advances and POs are
  // money-in-the-field / commitments; the actual disbursement is a payment_request
  // already exported above, so these never post to Tally (no double-counting).
  function toCsv(headers: string[], rows: (string | number)[][]): string {
    const esc = (v: string | number) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
    return [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
  }

  async function exportAdvancesCsv() {
    setBusy(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.from('vendor_advances')
        .select('amount, paid_date, expected_delivery_date, status, payment_request_id, notes, vendor:vendors(name)')
        .order('paid_date', { ascending: true })
      const rows = ((data ?? []) as Row[])
        .filter(a => !a.paid_date || (a.paid_date >= from && a.paid_date <= to))
        .map(a => [a.vendor?.name ?? '', Number(a.amount || 0), a.paid_date ?? '', a.expected_delivery_date ?? '', a.status ?? '', a.payment_request_id ? 'yes' : 'no', a.notes ?? ''])
      if (!rows.length) { toast.error('No vendor advances in that range'); setBusy(false); return }
      download(`vendor-advances-${from}_to_${to}.csv`, toCsv(['Vendor', 'Advance Amount', 'Paid Date', 'Expected Delivery', 'Status', 'Settled in books', 'Notes'], rows), 'text/csv')
      toast.success(`Exported ${rows.length} advances (review report)`)
    } catch { toast.error('Export failed') }
    setBusy(false)
  }

  async function exportPurchaseOrdersCsv() {
    setBusy(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.from('purchase_orders')
        .select('po_number, department, description, order_amount, status, expected_delivery_date, vendor:vendors(name)')
        .order('created_at', { ascending: true })
      const rows = ((data ?? []) as Row[]).map(p => [p.po_number ?? '', p.vendor?.name ?? '', p.department ?? '', p.description ?? '', Number(p.order_amount || 0), p.status ?? '', p.expected_delivery_date ?? ''])
      if (!rows.length) { toast.error('No purchase orders yet'); setBusy(false); return }
      download(`purchase-orders.csv`, toCsv(['PO Number', 'Vendor', 'Department', 'Description', 'Order Amount', 'Status', 'Expected Delivery'], rows), 'text/csv')
      toast.success(`Exported ${rows.length} purchase orders (review report)`)
    } catch { toast.error('Export failed') }
    setBusy(false)
  }

  return (
    <div className="space-y-5">
      {/* STEP 1 — Chart of Accounts (one-time setup) */}
      <Step n={1} title="Set up Tally once — Chart of Accounts"
        desc="Sends every ledger (with opening balances) into Tally so it's ready to receive vouchers. Do this once, or again whenever you add new ledgers.">
        <Button icon={BookOpen} loading={busy} onClick={exportMasters}>Download Chart of Accounts (XML)</Button>
        <p className="text-[11px] text-[#5a5a7a] mt-2">In Tally: <span className="text-[#8888aa]">Gateway of Tally → Import → Masters</span>, pick this file.</p>
      </Step>

      {/* STEP 2 — Settings */}
      <Step n={2} title="Set your details"
        desc="These tell Tally which bank/cash account the money moved through and how to treat GST. Set once; they're remembered as you export.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={e => setTo(e.target.value)} />
          <Input label="Tally Company Name (optional)" value={company} onChange={e => setCompany(e.target.value)} placeholder="As it appears in Tally" />
          <Input label="Bank / Cash Ledger" value={bankLedger} onChange={e => setBankLedger(e.target.value)} placeholder="e.g. Cash, HDFC Bank" />
          <Select label="GST split" value={gstSplit} onChange={e => setGstSplit(e.target.value as GstSplit)}
            options={[{ value: 'cgst_sgst', label: 'CGST + SGST (local / intra-state)' }, { value: 'igst', label: 'IGST (other state / inter-state)' }, { value: 'single', label: 'Single Input/Output GST' }]} />
          <Input label="TDS Payable Ledger" value={tdsLedger} onChange={e => setTdsLedger(e.target.value)} placeholder="TDS Payable" />
        </div>
      </Step>

      {/* STEP 3 — Export vouchers */}
      <Step n={3} title="Export the period's entries"
        desc="Your approved payments and received income for the dates above, as Tally Payment & Receipt vouchers — GST and TDS already split onto the right ledgers.">
        <div className="flex flex-wrap gap-2">
          <Button icon={FileCode} loading={busy} onClick={exportXml}>Download Vouchers (XML)</Button>
          <Button variant="secondary" icon={Table} loading={busy} onClick={exportCsv}>CSV (to review)</Button>
        </div>
        {counts && <div className="text-xs text-emerald-400 mt-2">Last export: {counts.payments} payments + {counts.income} receipts.</div>}
        <p className="text-[11px] text-[#5a5a7a] mt-2">In Tally: <span className="text-[#8888aa]">Gateway of Tally → Import → Vouchers</span>, pick this file. (Import the Chart of Accounts first.)</p>
      </Step>

      {/* STEP 4 — supplementary review reports (not vouchers) */}
      <Step n={4} title="Supplementary reports for the CA (not vouchers)"
        desc="Money-in-the-field and commitments the CA likes to see. These are review CSVs only — they do NOT import into Tally and never double-count the payments above (the actual disbursement is already a payment voucher).">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Coins} loading={busy} onClick={exportAdvancesCsv}>Outstanding Advances (CSV)</Button>
          <Button variant="secondary" icon={ClipboardList} loading={busy} onClick={exportPurchaseOrdersCsv}>Purchase Orders (CSV)</Button>
        </div>
        <p className="text-[11px] text-[#5a5a7a] mt-2">Advances show a “Settled in books” flag — “yes” means it’s already linked to a payment and thus already in your Tally vouchers.</p>
      </Step>

      {/* Plain-language explainer */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2"><Download size={15} className="text-white/70" /><h3 className="text-sm font-semibold text-white">What lands in Tally</h3></div>
        <p className="text-xs text-[#c8c8da] leading-relaxed">
          Each <span className="text-white">payment</span> becomes a Payment voucher: the vendor is debited with the base amount, GST goes to
          {' '}<span className="text-white">Input {gstSplit === 'igst' ? 'IGST' : gstSplit === 'single' ? 'GST' : 'CGST/SGST'}</span>, TDS to <span className="text-white">{tdsLedger}</span>,
          and the net paid is credited to <span className="text-white">{bankLedger || 'your bank/cash'}</span>. Each <span className="text-white">receipt</span> credits the income ledger plus Output GST.
          Everything balances Dr = Cr. Always review in Tally before finalising.
        </p>
      </div>
    </div>
  )
}

function Step({ n, title, desc, children }: { n: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-7 h-7 rounded-full bg-white text-black text-sm font-bold flex items-center justify-center shrink-0">{n}</div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-[#8888aa] mt-0.5 leading-relaxed">{desc}</p>
        </div>
      </div>
      <div className="pl-10">{children}</div>
    </div>
  )
}
