'use client'

import { useMemo, useState } from 'react'
import { Upload, Plus, Wand2, Link2, Unlink, Check, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BankTransaction } from '@/lib/types'
import { useRouter } from 'next/navigation'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>
interface Props { accounts: Row[]; txns: BankTransaction[]; payments: Row[]; incomes: Row[]; userId: string }

// outflow that actually hit the bank = base + GST − TDS (net paid)
const payOut = (p: Row) => Number(p.net_payable ?? ((Number(p.amount || 0) + Number(p.gst_amount || 0)) - Number(p.tds_amount || 0)))
// inflow received = base + GST
const incIn = (i: Row) => Number(i.amount || 0) + Number(i.gst_amount || 0)

function parseDate(s: string): string | null {
  s = s.trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/) // DD/MM/YYYY
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` }
  const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}
function splitCsvLine(line: string): string[] {
  const out: string[] = []; let cur = '', q = false
  for (const ch of line) {
    if (ch === '"') q = !q
    else if (ch === ',' && !q) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur); return out.map(c => c.trim().replace(/^"|"$/g, ''))
}
const num = (s: string) => parseFloat((s || '').replace(/[^0-9.-]/g, '')) || 0

export function ReconcileClient({ accounts, txns, payments, incomes, userId }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '')
  const [importOpen, setImportOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ txn_date: new Date().toISOString().slice(0, 10), description: '', amount: '', kind: 'out' })
  const [matchFor, setMatchFor] = useState<BankTransaction | null>(null)

  const rows = useMemo(() => txns.filter(t => !accountId || t.account_id === accountId || t.account_id == null), [txns, accountId])
  const unmatched = rows.filter(t => !t.matched_type)
  const matched = rows.filter(t => t.matched_type)
  const inflow = rows.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const outflow = rows.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  // candidates not yet matched to a bank line
  const matchedIds = new Set(txns.filter(t => t.matched_id).map(t => `${t.matched_type}:${t.matched_id}`))
  const openPays = payments.filter(p => (p.approval_status === 'approved' || p.payment_status === 'paid' || p.approval_status === 'paid') && !matchedIds.has(`payment:${p.id}`))
  const openIncs = incomes.filter(i => (!i.status || i.status === 'received') && !matchedIds.has(`income:${i.id}`))

  function candidatesFor(t: BankTransaction) {
    const within = (d: string) => Math.abs((new Date(t.txn_date).getTime() - new Date(d).getTime()) / 86400000) <= 12
    if (t.amount < 0) return openPays.filter(p => Math.abs(payOut(p) - Math.abs(t.amount)) <= 1 && within((p.paid_at ?? p.created_at)))
      .map(p => ({ type: 'payment' as const, id: p.id, label: p.payee, amount: payOut(p), date: (p.paid_at ?? p.created_at) }))
    return openIncs.filter(i => Math.abs(incIn(i) - t.amount) <= 1 && within(i.income_date))
      .map(i => ({ type: 'income' as const, id: i.id, label: i.project?.name ? `${i.source} (${i.project.name})` : i.source, amount: incIn(i), date: i.income_date }))
  }

  async function importCsv() {
    const lines = csv.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return toast.error('Paste a CSV with a header row + lines')
    const header = splitCsvLine(lines[0]).map(h => h.toLowerCase())
    const idx = (names: string[]) => header.findIndex(h => names.some(n => h.includes(n)))
    const di = idx(['date']), desc = idx(['description', 'narration', 'particular', 'remark']),
      wi = idx(['withdrawal', 'debit', 'dr']), ci = idx(['deposit', 'credit', 'cr']), ai = idx(['amount'])
    if (di === -1) return toast.error('No "Date" column found')
    const recs: Row[] = []
    for (const line of lines.slice(1)) {
      const c = splitCsvLine(line)
      const date = parseDate(c[di] ?? ''); if (!date) continue
      let amount = 0
      if (wi !== -1 || ci !== -1) amount = num(c[ci] ?? '') - num(c[wi] ?? '')
      else if (ai !== -1) amount = num(c[ai] ?? '')
      if (!amount) continue
      recs.push({ account_id: accountId || null, txn_date: date, description: desc !== -1 ? c[desc] : null, amount, created_by: userId })
    }
    if (!recs.length) return toast.error('No transactions parsed — check the columns')
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('bank_transactions').insert(recs)
    if (error) { toast.error(/relation .*bank_transactions.* does not exist/i.test(error.message) ? 'run migration-bank-recon.sql first' : 'Import failed'); setBusy(false); return }
    toast.success(`Imported ${recs.length} transactions`); setBusy(false); setImportOpen(false); setCsv(''); router.refresh()
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault()
    const amt = (parseFloat(addForm.amount) || 0) * (addForm.kind === 'out' ? -1 : 1)
    if (!amt) return toast.error('Enter an amount')
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('bank_transactions').insert({ account_id: accountId || null, txn_date: addForm.txn_date, description: addForm.description || null, amount: amt, created_by: userId })
    if (error) { toast.error('Could not add'); setBusy(false); return }
    toast.success('Added'); setBusy(false); setAddOpen(false); setAddForm({ txn_date: new Date().toISOString().slice(0, 10), description: '', amount: '', kind: 'out' }); router.refresh()
  }

  async function link(t: BankTransaction, type: 'payment' | 'income', id: string) {
    const supabase = createClient()
    await supabase.from('bank_transactions').update({ matched_type: type, matched_id: id }).eq('id', t.id)
    setMatchFor(null); router.refresh()
  }
  async function unlink(t: BankTransaction) {
    const supabase = createClient()
    await supabase.from('bank_transactions').update({ matched_type: null, matched_id: null }).eq('id', t.id)
    router.refresh()
  }

  async function autoMatch() {
    setBusy(true)
    const supabase = createClient()
    const used = new Set<string>()
    let n = 0
    for (const t of unmatched) {
      const cands = candidatesFor(t).filter(c => !used.has(`${c.type}:${c.id}`))
      if (cands.length === 1) {
        used.add(`${cands[0].type}:${cands[0].id}`)
        await supabase.from('bank_transactions').update({ matched_type: cands[0].type, matched_id: cands[0].id }).eq('id', t.id)
        n++
      }
    }
    toast.success(n ? `Matched ${n} transaction${n > 1 ? 's' : ''}` : 'No confident matches found'); setBusy(false); router.refresh()
  }

  function matchLabel(t: BankTransaction): string {
    if (t.matched_type === 'payment') return payments.find(p => p.id === t.matched_id)?.payee ?? 'payment'
    if (t.matched_type === 'income') { const i = incomes.find(x => x.id === t.matched_id); return i ? (i.project?.name ? `${i.source} (${i.project.name})` : i.source) : 'income' }
    return 'manual'
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Bank Reconciliation" subtitle="Match your bank statement to the books"
        action={<div className="flex gap-2">
          <Button variant="secondary" icon={Plus} onClick={() => setAddOpen(true)}>Add line</Button>
          <Button variant="secondary" icon={Upload} onClick={() => setImportOpen(true)}>Import CSV</Button>
          <Button icon={Wand2} loading={busy} onClick={autoMatch} disabled={unmatched.length === 0}>Auto-match</Button>
        </div>} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-4"><div className="text-[10px] text-[#8888aa] uppercase tracking-wide">Deposits</div><div className="text-base font-bold text-emerald-400 tabular-nums">{formatCurrency(inflow)}</div></div>
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-4"><div className="text-[10px] text-[#8888aa] uppercase tracking-wide">Withdrawals</div><div className="text-base font-bold text-red-400 tabular-nums">{formatCurrency(outflow)}</div></div>
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-4"><div className="text-[10px] text-[#8888aa] uppercase tracking-wide">Matched</div><div className="text-base font-bold text-white tabular-nums">{matched.length}</div></div>
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-4"><div className="text-[10px] text-[#8888aa] uppercase tracking-wide">Unmatched</div><div className={`text-base font-bold tabular-nums ${unmatched.length ? 'text-amber-400' : 'text-emerald-400'}`}>{unmatched.length}</div></div>
      </div>

      {accounts.length > 0 && (
        <Select label="Bank account" value={accountId} onChange={e => setAccountId(e.target.value)}
          options={[{ value: '', label: 'All accounts' }, ...accounts.map(a => ({ value: a.id, label: a.name }))]} />
      )}

      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#8888aa]">No bank transactions yet — import a statement CSV or add a line.</div>
        ) : (
          <div className="divide-y divide-[#2a2a3a]">
            {rows.map(t => {
              const cands = !t.matched_type ? candidatesFor(t) : []
              return (
                <div key={t.id} className="px-5 py-3 flex items-center gap-3">
                  {t.amount < 0 ? <ArrowUpRight size={16} className="text-red-400 shrink-0" /> : <ArrowDownLeft size={16} className="text-emerald-400 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white truncate">{t.description || (t.amount < 0 ? 'Withdrawal' : 'Deposit')}</div>
                    <div className="text-xs text-[#8888aa]">{formatDate(t.txn_date)}
                      {t.matched_type && <span className="text-emerald-400"> · matched to {matchLabel(t)}</span>}
                      {!t.matched_type && cands.length > 0 && <span className="text-amber-400"> · {cands.length} possible match{cands.length > 1 ? 'es' : ''}</span>}
                    </div>
                  </div>
                  <div className={`text-sm font-semibold tabular-nums shrink-0 ${t.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{t.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(t.amount))}</div>
                  {t.matched_type
                    ? <button onClick={() => unlink(t)} title="Unmatch" className="text-[#5a5a7a] hover:text-red-400 shrink-0"><Unlink size={15} /></button>
                    : <button onClick={() => setMatchFor(t)} className="text-xs text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1 shrink-0"><Link2 size={13} /> Match</button>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Manual match modal */}
      <Modal open={matchFor !== null} onClose={() => setMatchFor(null)} title="Match transaction">
        {matchFor && (() => {
          const cands = candidatesFor(matchFor)
          const pool = matchFor.amount < 0 ? openPays.map(p => ({ type: 'payment' as const, id: p.id, label: p.payee, amount: payOut(p), date: (p.paid_at ?? p.created_at) }))
            : openIncs.map(i => ({ type: 'income' as const, id: i.id, label: i.project?.name ? `${i.source} (${i.project.name})` : i.source, amount: incIn(i), date: i.income_date }))
          const list = cands.length ? cands : pool.slice(0, 30)
          return (
            <div className="space-y-2">
              <div className="text-xs text-[#8888aa] mb-1">{formatDate(matchFor.txn_date)} · {matchFor.amount < 0 ? 'paid' : 'received'} {formatCurrency(Math.abs(matchFor.amount))}{cands.length ? ' — suggested matches:' : ' — pick an entry:'}</div>
              {list.length === 0 ? <div className="text-sm text-[#8888aa] py-4 text-center">No open {matchFor.amount < 0 ? 'payments' : 'income'} to match.</div> :
                list.map(c => (
                  <button key={`${c.type}:${c.id}`} onClick={() => link(matchFor, c.type, c.id)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#1a1a24] border border-[#2a2a3a] hover:border-white/30 text-left">
                    <div className="min-w-0"><div className="text-sm text-white truncate">{c.label}</div><div className="text-[11px] text-[#8888aa]">{formatDate(c.date)}</div></div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm text-white tabular-nums">{formatCurrency(c.amount)}</span>
                      {Math.abs(c.amount - Math.abs(matchFor.amount)) <= 1 && <Check size={14} className="text-emerald-400" />}
                    </div>
                  </button>
                ))}
            </div>
          )
        })()}
      </Modal>

      {/* Import modal */}
      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import bank statement (CSV)">
        <div className="space-y-3">
          <p className="text-xs text-[#8888aa] leading-relaxed">Paste your statement CSV. It auto-detects <span className="text-white">Date</span>, <span className="text-white">Description</span>, and either <span className="text-white">Withdrawal/Deposit</span> (or Debit/Credit) or a single signed <span className="text-white">Amount</span> column.</p>
          <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={8} placeholder="Date,Description,Withdrawal,Deposit&#10;01/06/2026,UPI Vendor ABC,11800,&#10;03/06/2026,Satellite advance,,500000"
            className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-white/40" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button loading={busy} icon={Upload} onClick={importCsv}>Import</Button>
          </div>
        </div>
      </Modal>

      {/* Add manual line modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add bank line" size="sm">
        <form onSubmit={addManual} className="space-y-3">
          <Input label="Date" type="date" value={addForm.txn_date} onChange={e => setAddForm({ ...addForm, txn_date: e.target.value })} />
          <Input label="Description" value={addForm.description} onChange={e => setAddForm({ ...addForm, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={addForm.kind} onChange={e => setAddForm({ ...addForm, kind: e.target.value })} options={[{ value: 'out', label: 'Withdrawal (out)' }, { value: 'in', label: 'Deposit (in)' }]} />
            <Input label="Amount (₹)" type="number" value={addForm.amount} onChange={e => setAddForm({ ...addForm, amount: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit" loading={busy}>Add</Button></div>
        </form>
      </Modal>
    </div>
  )
}
