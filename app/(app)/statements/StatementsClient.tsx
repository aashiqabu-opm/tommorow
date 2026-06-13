'use client'

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatDate } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>
type Entry = { ledger_name: string; dr: boolean; amount: number }
type Voucher = { voucher_date: string; entries: Entry[] }
interface Props { ledgers: Row[]; vouchers: Voucher[]; payments: Row[]; tdsLedger: string }

const INCOME_GROUPS = ['Direct Incomes', 'Indirect Incomes', 'Sales Accounts']
const EXPENSE_GROUPS = ['Direct Expenses', 'Indirect Expenses', 'Purchase Accounts']
const ASSET_GROUPS = ['Cash-in-Hand', 'Bank Accounts', 'Sundry Debtors', 'Fixed Assets', 'Current Assets', 'Deposits (Asset)', 'Loans & Advances (Asset)', 'Stock-in-Hand', 'Investments']
const LIAB_GROUPS = ['Sundry Creditors', 'Duties & Taxes', 'Loans (Liability)', 'Current Liabilities', 'Capital Account', 'Reserves & Surplus', 'Provisions', 'Secured Loans', 'Unsecured Loans', 'Bank OD A/c']
const CASH_GROUPS = ['Cash-in-Hand', 'Bank Accounts', 'Bank OD A/c']

const startOfFY = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-04-01` }
const today = () => new Date().toISOString().slice(0, 10)

type Tab = 'pnl' | 'bs' | 'cash' | 'gst' | 'tds'
const TABS: { id: Tab; label: string }[] = [
  { id: 'pnl', label: 'Profit & Loss' }, { id: 'bs', label: 'Balance Sheet' },
  { id: 'cash', label: 'Cash & Bank' }, { id: 'gst', label: 'GST Summary' }, { id: 'tds', label: 'TDS (26Q)' },
]

function download(name: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(c => /[",]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c)).join(',')).join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click()
}

export function StatementsClient({ ledgers, vouchers, payments, tdsLedger }: Props) {
  const [tab, setTab] = useState<Tab>('pnl')
  const [from, setFrom] = useState(startOfFY())
  const [to, setTo] = useState(today())

  const parentOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of ledgers) m.set(l.name, l.parent)
    return (name: string) => m.get(name) ?? 'Suspense A/c'
  }, [ledgers])
  const openingOf = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of ledgers) m.set(l.name, Number(l.opening_balance || 0))
    return m
  }, [ledgers])

  // Net debit movement (Dr − Cr) per ledger, within [a,b]
  function movement(a: string, b: string) {
    const net = new Map<string, number>()
    for (const v of vouchers) {
      if (v.voucher_date < a || v.voucher_date > b) continue
      for (const e of v.entries ?? []) {
        const cur = net.get(e.ledger_name) ?? 0
        net.set(e.ledger_name, cur + (e.dr ? Number(e.amount) : -Number(e.amount)))
      }
    }
    return net
  }

  const periodNet = useMemo(() => movement(from, to), [from, to, vouchers]) // eslint-disable-line react-hooks/exhaustive-deps
  const toDateNet = useMemo(() => movement('0000-01-01', to), [to, vouchers]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── P&L ──
  const pnl = useMemo(() => {
    const inc: { name: string; amt: number }[] = [], exp: { name: string; amt: number }[] = []
    for (const [name, net] of periodNet) {
      const g = parentOf(name)
      if (INCOME_GROUPS.includes(g) && -net !== 0) inc.push({ name, amt: -net })   // income = credit
      if (EXPENSE_GROUPS.includes(g) && net !== 0) exp.push({ name, amt: net })     // expense = debit
    }
    inc.sort((x, y) => y.amt - x.amt); exp.sort((x, y) => y.amt - x.amt)
    const incTotal = inc.reduce((s, r) => s + r.amt, 0), expTotal = exp.reduce((s, r) => s + r.amt, 0)
    return { inc, exp, incTotal, expTotal, net: incTotal - expTotal }
  }, [periodNet, parentOf])

  // ── Balance Sheet (as of `to`) ──
  const bs = useMemo(() => {
    const assets: { name: string; amt: number }[] = [], liabs: { name: string; amt: number }[] = []
    const names = new Set<string>([...toDateNet.keys(), ...ledgers.map(l => l.name)])
    let incTD = 0, expTD = 0
    for (const name of names) {
      const g = parentOf(name)
      const bal = (openingOf.get(name) ?? 0) + (toDateNet.get(name) ?? 0) // net debit balance
      if (INCOME_GROUPS.includes(g)) incTD += -(toDateNet.get(name) ?? 0)
      else if (EXPENSE_GROUPS.includes(g)) expTD += (toDateNet.get(name) ?? 0)
      else if (ASSET_GROUPS.includes(g)) { if (Math.round(bal * 100)) assets.push({ name, amt: bal }) }
      else if (LIAB_GROUPS.includes(g)) { if (Math.round(bal * 100)) liabs.push({ name, amt: -bal }) }
    }
    const profit = incTD - expTD
    if (Math.round(profit * 100)) liabs.push({ name: 'Profit & Loss A/c (current)', amt: profit })
    assets.sort((a, b) => b.amt - a.amt); liabs.sort((a, b) => b.amt - a.amt)
    const aTot = assets.reduce((s, r) => s + r.amt, 0), lTot = liabs.reduce((s, r) => s + r.amt, 0)
    return { assets, liabs, aTot, lTot, diff: aTot - lTot }
  }, [toDateNet, openingOf, parentOf, ledgers])

  // ── Cash & Bank movement ──
  const cash = useMemo(() => {
    const lines: { name: string; opening: number; inn: number; out: number; closing: number }[] = []
    for (const l of ledgers) {
      if (!CASH_GROUPS.includes(l.parent)) continue
      const opening = (openingOf.get(l.name) ?? 0) + movementBeforeNet(l.name)
      let inn = 0, out = 0
      for (const v of vouchers) {
        if (v.voucher_date < from || v.voucher_date > to) continue
        for (const e of v.entries ?? []) if (e.ledger_name === l.name) { if (e.dr) inn += Number(e.amount); else out += Number(e.amount) }
      }
      const closing = opening + inn - out
      if (opening || inn || out) lines.push({ name: l.name, opening, inn, out, closing })
    }
    return lines
    function movementBeforeNet(name: string) {
      let n = 0
      for (const v of vouchers) { if (v.voucher_date >= from) continue; for (const e of v.entries ?? []) if (e.ledger_name === name) n += e.dr ? Number(e.amount) : -Number(e.amount) }
      return n
    }
  }, [from, to, ledgers, openingOf, vouchers])

  // ── GST ──
  const gst = useMemo(() => {
    const sum = (name: string, wantDr: boolean) => {
      let t = 0
      for (const v of vouchers) { if (v.voucher_date < from || v.voucher_date > to) continue; for (const e of v.entries ?? []) if (e.ledger_name === name && e.dr === wantDr) t += Number(e.amount) }
      return t
    }
    const out = { cgst: sum('Output CGST', false), sgst: sum('Output SGST', false), igst: sum('Output IGST', false), single: sum('Output GST', false) }
    const inp = { cgst: sum('Input CGST', true), sgst: sum('Input SGST', true), igst: sum('Input IGST', true), single: sum('Input GST', true) }
    const outTot = out.cgst + out.sgst + out.igst + out.single
    const inpTot = inp.cgst + inp.sgst + inp.igst + inp.single
    return { out, inp, outTot, inpTot, payable: outTot - inpTot }
  }, [from, to, vouchers])

  // ── TDS (26Q working) ──
  const tds = useMemo(() => {
    const rows = (payments as Row[]).filter(p => {
      const settled = p.approval_status === 'approved' || p.payment_status === 'paid' || p.approval_status === 'paid'
      const d = String(p.paid_at ?? p.created_at ?? '').slice(0, 10)
      return settled && Number(p.tds_amount || 0) > 0 && d >= from && d <= to
    }).map(p => ({ payee: p.payee, pan: p.vendor?.pan ?? '', section: p.tds_section ?? '', base: Number(p.amount || 0), tds: Number(p.tds_amount || 0), date: String(p.paid_at ?? p.created_at ?? '').slice(0, 10) }))
    rows.sort((a, b) => a.date.localeCompare(b.date))
    return { rows, total: rows.reduce((s, r) => s + r.tds, 0) }
  }, [payments, from, to])

  const RangeNote = () => <p className="text-[11px] text-[#5a5a7a]">From {formatDate(from)} to {formatDate(to)}. Figures are from the posted voucher ledger.</p>

  return (
    <div className="space-y-5">
      <PageHeader title="Statements" subtitle="P&L, Balance Sheet, Cash, GST & TDS — straight off the ledger" />

      <div className="flex flex-wrap items-end gap-3">
        <Input label={tab === 'bs' ? 'As of (start)' : 'From'} type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <Input label={tab === 'bs' ? 'As of (date)' : 'To'} type="date" value={to} onChange={e => setTo(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-[#2a2a3a] pb-px">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium rounded-t-lg ${tab === t.id ? 'text-white border-b-2 border-white' : 'text-[#8888aa] hover:text-white'}`}>{t.label}</button>
        ))}
      </div>

      {/* PROFIT & LOSS */}
      {tab === 'pnl' && (
        <Card title="Profit & Loss" onExport={() => download('profit-loss.csv', [['Type', 'Ledger', 'Amount'], ...pnl.inc.map(r => ['Income', r.name, r.amt]), ...pnl.exp.map(r => ['Expense', r.name, r.amt]), ['', 'Net Profit', pnl.net]])}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Ledgerlist title="Income" rows={pnl.inc} total={pnl.incTotal} pos />
            <Ledgerlist title="Expenses" rows={pnl.exp} total={pnl.expTotal} />
          </div>
          <Total label={pnl.net >= 0 ? 'Net Profit' : 'Net Loss'} amt={Math.abs(pnl.net)} good={pnl.net >= 0} />
          <RangeNote />
        </Card>
      )}

      {/* BALANCE SHEET */}
      {tab === 'bs' && (
        <Card title={`Balance Sheet as of ${formatDate(to)}`} onExport={() => download('balance-sheet.csv', [['Side', 'Ledger', 'Amount'], ...bs.liabs.map(r => ['Liabilities', r.name, r.amt]), ...bs.assets.map(r => ['Assets', r.name, r.amt])])}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Ledgerlist title="Liabilities" rows={bs.liabs} total={bs.lTot} />
            <Ledgerlist title="Assets" rows={bs.assets} total={bs.aTot} pos />
          </div>
          {Math.abs(bs.diff) >= 1 && <div className="text-[11px] text-amber-400">Difference of {formatCurrency(Math.abs(bs.diff))} — opening balances may be incomplete. Set them on the Vouchers page (per ledger).</div>}
          <RangeNote />
        </Card>
      )}

      {/* CASH & BANK */}
      {tab === 'cash' && (
        <Card title="Cash & Bank Movement" onExport={() => download('cash-bank.csv', [['Ledger', 'Opening', 'In', 'Out', 'Closing'], ...cash.map(c => [c.name, c.opening, c.inn, c.out, c.closing])])}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] uppercase tracking-wide text-[#8888aa] text-right"><th className="text-left py-2">Ledger</th><th>Opening</th><th>In</th><th>Out</th><th>Closing</th></tr></thead>
              <tbody>
                {cash.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-[#8888aa]">No cash/bank movement in range.</td></tr> :
                  cash.map(c => (
                    <tr key={c.name} className="border-t border-[#2a2a3a] text-right tabular-nums">
                      <td className="text-left py-2 text-white">{c.name}</td>
                      <td className="text-[#c8c8da]">{formatCurrency(c.opening)}</td>
                      <td className="text-emerald-400">{formatCurrency(c.inn)}</td>
                      <td className="text-red-400">{formatCurrency(c.out)}</td>
                      <td className="text-white font-semibold">{formatCurrency(c.closing)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <RangeNote />
        </Card>
      )}

      {/* GST */}
      {tab === 'gst' && (
        <Card title="GST Summary (GSTR-3B working)" onExport={() => download('gst-summary.csv', [['', 'CGST', 'SGST', 'IGST', 'Single', 'Total'], ['Output (on sales)', gst.out.cgst, gst.out.sgst, gst.out.igst, gst.out.single, gst.outTot], ['Input (ITC)', gst.inp.cgst, gst.inp.sgst, gst.inp.igst, gst.inp.single, gst.inpTot], ['Net payable', '', '', '', '', gst.payable]])}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] uppercase tracking-wide text-[#8888aa] text-right"><th className="text-left py-2"></th><th>CGST</th><th>SGST</th><th>IGST</th><th>Single</th><th>Total</th></tr></thead>
              <tbody className="tabular-nums text-right">
                <tr className="border-t border-[#2a2a3a]"><td className="text-left py-2 text-white">Output GST (on sales)</td><td>{formatCurrency(gst.out.cgst)}</td><td>{formatCurrency(gst.out.sgst)}</td><td>{formatCurrency(gst.out.igst)}</td><td>{formatCurrency(gst.out.single)}</td><td className="text-white font-semibold">{formatCurrency(gst.outTot)}</td></tr>
                <tr className="border-t border-[#2a2a3a]"><td className="text-left py-2 text-white">Input GST (ITC)</td><td>{formatCurrency(gst.inp.cgst)}</td><td>{formatCurrency(gst.inp.sgst)}</td><td>{formatCurrency(gst.inp.igst)}</td><td>{formatCurrency(gst.inp.single)}</td><td className="text-white font-semibold">{formatCurrency(gst.inpTot)}</td></tr>
              </tbody>
            </table>
          </div>
          <Total label={gst.payable >= 0 ? 'Net GST Payable' : 'Net ITC Carry-forward'} amt={Math.abs(gst.payable)} good={gst.payable < 0} />
          <RangeNote />
        </Card>
      )}

      {/* TDS */}
      {tab === 'tds' && (
        <Card title="TDS Deducted (26Q working)" onExport={() => download('tds-26q.csv', [['Date', 'Deductee', 'PAN', 'Section', 'Amount Paid', 'TDS'], ...tds.rows.map(r => [r.date, r.payee, r.pan, r.section, r.base, r.tds])])}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] uppercase tracking-wide text-[#8888aa]"><th className="text-left py-2">Date</th><th className="text-left">Deductee</th><th className="text-left">PAN</th><th className="text-left">Section</th><th className="text-right">Base</th><th className="text-right">TDS</th></tr></thead>
              <tbody>
                {tds.rows.length === 0 ? <tr><td colSpan={6} className="py-6 text-center text-[#8888aa]">No TDS deducted in range.</td></tr> :
                  tds.rows.map((r, i) => (
                    <tr key={i} className="border-t border-[#2a2a3a]">
                      <td className="py-2 text-[#c8c8da]">{formatDate(r.date)}</td>
                      <td className="text-white">{r.payee}</td>
                      <td className={r.pan ? 'text-[#c8c8da]' : 'text-amber-400'}>{r.pan || 'no PAN'}</td>
                      <td className="text-[#c8c8da]">{r.section || '—'}</td>
                      <td className="text-right tabular-nums text-[#c8c8da]">{formatCurrency(r.base)}</td>
                      <td className="text-right tabular-nums text-white">{formatCurrency(r.tds)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <Total label="Total TDS Deducted" amt={tds.total} />
          <RangeNote />
        </Card>
      )}

      <p className="text-[11px] text-[#5a5a7a]">Working figures from your books — have your CA review before filing. Statements reflect what's posted to the voucher ledger (sync payments &amp; income on the Vouchers page to keep them complete).</p>
    </div>
  )
}

function Card({ title, onExport, children }: { title: string; onExport: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <button onClick={onExport} className="text-xs text-white/70 hover:text-white inline-flex items-center gap-1.5"><Download size={13} /> CSV</button>
      </div>
      {children}
    </div>
  )
}

function Ledgerlist({ title, rows, total, pos }: { title: string; rows: { name: string; amt: number }[]; total: number; pos?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8888aa] mb-2">{title}</div>
      <div className="space-y-1">
        {rows.length === 0 ? <div className="text-xs text-[#5a5a7a] py-2">Nothing posted.</div> :
          rows.map(r => (
            <div key={r.name} className="flex items-center justify-between text-sm">
              <span className="text-[#c8c8da] truncate pr-2">{r.name}</span>
              <span className={`tabular-nums shrink-0 ${pos ? 'text-emerald-300' : 'text-[#c8c8da]'}`}>{formatCurrency(r.amt)}</span>
            </div>
          ))}
      </div>
      <div className="flex items-center justify-between text-sm font-semibold border-t border-[#2a2a3a] mt-2 pt-2">
        <span className="text-white">Total</span><span className="text-white tabular-nums">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}

function Total({ label, amt, good }: { label: string; amt: number; good?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-xl px-4 py-3 border ${good ? 'bg-[#0e1f17] border-emerald-500/20' : 'bg-[#1a1a24] border-[#2a2a3a]'}`}>
      <span className="text-sm font-semibold text-white">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${good ? 'text-emerald-300' : 'text-white'}`}>{formatCurrency(amt)}</span>
    </div>
  )
}
