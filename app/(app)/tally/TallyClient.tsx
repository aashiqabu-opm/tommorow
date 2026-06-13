'use client'

import { useState } from 'react'
import { Download, FileCode, Table, BookOpen, Info } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { buildVoucherXml, buildLedgerXml, buildVoucherCsv, type TallyVoucher, type TallyLedger } from '@/lib/tally'

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

    for (const p of (pay.data ?? []) as Row[]) {
      const settled = p.approval_status === 'approved' || p.payment_status === 'paid' || p.approval_status === 'paid'
      if (!settled) continue
      const date = (p.paid_at ?? p.created_at ?? '').slice(0, 10)
      if (!date || date < from || date > to) continue
      const party = String(p.payee || 'Sundry Party').trim()
      const amount = Number(p.net_payable ?? p.amount ?? 0)
      if (amount <= 0) continue
      vouchers.push({
        date, type: 'Payment', partyLedger: party, bankLedger, amount,
        narration: [p.category, p.purpose].filter(Boolean).join(' — '),
      })
      ledgerSet.set(party, 'Sundry Creditors')
    }

    for (const i of (inc.data ?? []) as Row[]) {
      const status = i.status
      if (status && status !== 'received') continue // only actual receipts
      const date = String(i.income_date || i.created_at || '').slice(0, 10)
      if (!date || date < from || date > to) continue
      const party = String(i.party || i.source || (i.project?.name ? `${i.project.name} Income` : 'Income')).trim()
      const amount = Number(i.amount ?? 0)
      if (amount <= 0) continue
      vouchers.push({
        date, type: 'Receipt', partyLedger: party, bankLedger, amount,
        narration: [i.source, i.project?.name, i.notes].filter(Boolean).join(' — '),
      })
      ledgerSet.set(party, 'Sales Accounts')
    }

    // Bank/Cash ledger master
    ledgerSet.set(bankLedger, /cash/i.test(bankLedger) ? 'Cash-in-Hand' : 'Bank Accounts')
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

  async function exportLedgers() {
    setBusy(true)
    try {
      const { ledgers } = await buildVouchers()
      if (!ledgers.length) { toast.error('No ledgers to export for that range'); setBusy(false); return }
      download(`tally-ledgers-${from}_to_${to}.xml`, buildLedgerXml(ledgers, company.trim()), 'application/xml')
      toast.success(`Exported ${ledgers.length} ledger masters`)
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

  return (
    <div className="space-y-6">
      <PageHeader title="Tally Export" subtitle="Export vouchers & ledgers as Tally XML for your accountant to import" />

      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="From" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={e => setTo(e.target.value)} />
          <Input label="Tally Company Name (optional)" value={company} onChange={e => setCompany(e.target.value)} placeholder="As it appears in Tally" />
          <Input label="Bank / Cash Ledger" value={bankLedger} onChange={e => setBankLedger(e.target.value)} placeholder="e.g. Cash, HDFC Bank" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button icon={FileCode} loading={busy} onClick={exportXml}>Vouchers XML</Button>
          <Button variant="secondary" icon={BookOpen} loading={busy} onClick={exportLedgers}>Ledger Masters XML</Button>
          <Button variant="secondary" icon={Table} loading={busy} onClick={exportCsv}>CSV</Button>
        </div>

        {counts && (
          <div className="text-xs text-[#8888aa]">Last export: {counts.payments} Payment + {counts.income} Receipt vouchers.</div>
        )}
      </div>

      {/* How to import */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3"><Download size={15} className="text-white/70" /><h3 className="text-sm font-semibold text-white">How your accountant imports this</h3></div>
        <ol className="text-xs text-[#c8c8da] space-y-1.5 list-decimal pl-4 leading-relaxed">
          <li>First import <span className="text-white">Ledger Masters XML</span> (so every party/ledger exists), then the <span className="text-white">Vouchers XML</span>.</li>
          <li>In Tally: <span className="text-white">Gateway of Tally → Import Data → Vouchers</span> (TallyPrime) / <span className="text-white">Import of Data</span> (ERP 9), pick the file, confirm.</li>
          <li>Payments post as <span className="text-white">Payment vouchers</span> (party debited, {bankLedger || 'Bank/Cash'} credited); income as <span className="text-white">Receipt vouchers</span>.</li>
          <li>Review the imported vouchers in Tally before finalising — re-map any ledger to the correct group/head as needed.</li>
        </ol>
        <div className="mt-3 flex items-start gap-2 text-[11px] text-[#8888aa] bg-[#1a1a24] rounded-xl p-3">
          <Info size={13} className="mt-0.5 shrink-0 text-amber-400" />
          <span>Amounts use net payable where available. GST/TDS breakups aren&apos;t split into separate ledgers yet — the accountant applies tax in Tally, or tell me to add GST/TDS ledger lines to the export.</span>
        </div>
      </div>
    </div>
  )
}
