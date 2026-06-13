'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2, BookOpen, FileCode, Check, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatCurrency, formatDate } from '@/lib/utils'
import { buildVoucherXml, type TallyVoucher } from '@/lib/tally'
import type { Ledger, Voucher } from '@/lib/types'
import { useRouter } from 'next/navigation'

const VOUCHER_TYPES = ['Payment', 'Receipt', 'Contra', 'Journal', 'Sales', 'Purchase']
const TALLY_GROUPS = [
  'Cash-in-Hand', 'Bank Accounts', 'Sundry Creditors', 'Sundry Debtors', 'Duties & Taxes',
  'Direct Expenses', 'Indirect Expenses', 'Direct Incomes', 'Indirect Incomes', 'Sales Accounts',
  'Purchase Accounts', 'Fixed Assets', 'Loans (Liability)', 'Capital Account', 'Current Assets',
  'Current Liabilities', 'Suspense A/c',
]

interface Props { ledgers: Ledger[]; vouchers: Voucher[]; userId: string }

type Line = { ledger_name: string; dr: boolean; amount: string }

export function VouchersClient({ ledgers, vouchers, userId }: Props) {
  const router = useRouter()
  const toast = useToast()
  const today = new Date().toISOString().slice(0, 10)

  // ── Voucher entry state ──
  const [vType, setVType] = useState('Payment')
  const [vDate, setVDate] = useState(today)
  const [vNumber, setVNumber] = useState('')
  const [narration, setNarration] = useState('')
  const [lines, setLines] = useState<Line[]>([{ ledger_name: '', dr: true, amount: '' }, { ledger_name: '', dr: false, amount: '' }])
  const [saving, setSaving] = useState(false)

  // ── Ledger master modal ──
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const [ledgerForm, setLedgerForm] = useState({ name: '', parent: 'Sundry Creditors', opening: '' })
  const [ledgerSaving, setLedgerSaving] = useState(false)

  const ledgerOptions = useMemo(() => [{ value: '', label: 'Select ledger…' }, ...ledgers.map(l => ({ value: l.name, label: `${l.name} (${l.parent})` }))], [ledgers])

  const drTotal = lines.filter(l => l.dr).reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const crTotal = lines.filter(l => !l.dr).reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)
  const diff = Math.round((drTotal - crTotal) * 100) / 100
  const balanced = diff === 0 && drTotal > 0

  function setLine(i: number, patch: Partial<Line>) { setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l)) }
  function addLine() { setLines(ls => [...ls, { ledger_name: '', dr: false, amount: '' }]) }
  function removeLine(i: number) { setLines(ls => ls.length > 2 ? ls.filter((_, idx) => idx !== i) : ls) }

  async function saveLedger(e: React.FormEvent) {
    e.preventDefault()
    if (!ledgerForm.name.trim()) return toast.error('Enter a ledger name')
    setLedgerSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('ledgers').insert({ name: ledgerForm.name.trim(), parent: ledgerForm.parent, opening_balance: parseFloat(ledgerForm.opening) || 0, created_by: userId }).select().single()
    if (error) {
      const hint = /relation .*ledgers.* does not exist/i.test(error.message) ? 'run migration-vouchers.sql first' : /duplicate|unique/i.test(error.message) ? 'a ledger with that name already exists' : error.message
      toast.error(`Couldn't add — ${String(hint).slice(0, 80)}`); setLedgerSaving(false); return
    }
    if (data) await logAction('create', 'ledgers', data.id, undefined, data)
    toast.success('Ledger added')
    setLedgerSaving(false); setLedgerOpen(false); setLedgerForm({ name: '', parent: 'Sundry Creditors', opening: '' })
    router.refresh()
  }

  async function saveVoucher(e: React.FormEvent) {
    e.preventDefault()
    const clean = lines.filter(l => l.ledger_name && (parseFloat(l.amount) || 0) > 0)
    if (clean.length < 2) return toast.error('Add at least two ledger lines')
    if (!balanced) return toast.error(`Debit and Credit must match (diff ${formatCurrency(Math.abs(diff))})`)
    setSaving(true)
    const supabase = createClient()
    const { data: v, error } = await supabase.from('vouchers').insert({
      voucher_type: vType, voucher_date: vDate, voucher_number: vNumber.trim() || null, narration: narration.trim() || null, created_by: userId,
    }).select().single()
    if (error || !v) {
      const hint = /relation .*vouchers.* does not exist/i.test(error?.message ?? '') ? 'run migration-vouchers.sql first' : error?.message
      toast.error(`Couldn't save — ${String(hint).slice(0, 80)}`); setSaving(false); return
    }
    const entries = clean.map((l, idx) => ({ voucher_id: v.id, ledger_name: l.ledger_name, dr: l.dr, amount: parseFloat(l.amount), sort_order: idx }))
    const { error: eErr } = await supabase.from('voucher_entries').insert(entries)
    if (eErr) { toast.error('Voucher saved but lines failed — check migration'); setSaving(false); return }
    await logAction('create', 'vouchers', v.id, undefined, { type: vType, lines: entries.length })
    toast.success(`${vType} voucher saved`)
    setSaving(false); setVNumber(''); setNarration(''); setLines([{ ledger_name: '', dr: true, amount: '' }, { ledger_name: '', dr: false, amount: '' }])
    router.refresh()
  }

  async function deleteVoucher(v: Voucher) {
    if (!window.confirm('Delete this voucher?')) return
    const supabase = createClient()
    const { error } = await supabase.from('vouchers').delete().eq('id', v.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'vouchers', v.id, undefined, undefined)
    router.refresh()
  }

  function exportXml() {
    if (!vouchers.length) return toast.error('No vouchers to export yet')
    const tv: TallyVoucher[] = vouchers.map(v => ({
      date: v.voucher_date, type: v.voucher_type, number: v.voucher_number ?? undefined, narration: v.narration ?? undefined,
      lines: (v.entries ?? []).map(e => ({ ledger: e.ledger_name, dr: e.dr, amount: Number(e.amount) })),
    }))
    const blob = new Blob([buildVoucherXml(tv)], { type: 'application/xml' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `tally-vouchers.xml`; a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Vouchers" subtitle="Tally-style double-entry — Dr/Cr ledger postings, exportable to Tally"
        action={<div className="flex gap-2">
          <Button variant="secondary" icon={BookOpen} onClick={() => setLedgerOpen(true)}>Add Ledger</Button>
          <Button variant="secondary" icon={FileCode} onClick={exportXml}>Export to Tally</Button>
        </div>} />

      {/* Voucher entry — Tally accounting voucher style */}
      <form onSubmit={saveVoucher} className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Select label="Voucher Type" value={vType} onChange={e => setVType(e.target.value)} options={VOUCHER_TYPES.map(t => ({ value: t, label: t }))} />
          <Input label="Date" type="date" value={vDate} onChange={e => setVDate(e.target.value)} />
          <Input label="Voucher No (optional)" value={vNumber} onChange={e => setVNumber(e.target.value)} placeholder="auto" />
          <div className="flex items-end">
            <div className={`w-full text-center rounded-lg py-2 text-xs font-medium border ${balanced ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}>
              {balanced ? 'Balanced' : `Diff ${formatCurrency(Math.abs(diff))}`}
            </div>
          </div>
        </div>

        {/* Dr/Cr lines */}
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_90px_140px_32px] gap-2 text-[10px] uppercase tracking-wide text-[#8888aa] px-1">
            <span>Ledger</span><span>Dr/Cr</span><span className="text-right">Amount</span><span></span>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_140px_32px] gap-2 items-center">
              <Select value={l.ledger_name} onChange={e => setLine(i, { ledger_name: e.target.value })} options={ledgerOptions} />
              <button type="button" onClick={() => setLine(i, { dr: !l.dr })}
                className={`h-9 rounded-lg text-xs font-bold border ${l.dr ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' : 'text-sky-400 border-sky-500/30 bg-sky-500/10'}`}>
                {l.dr ? 'Dr' : 'Cr'}
              </button>
              <Input type="number" value={l.amount} onChange={e => setLine(i, { amount: e.target.value })} placeholder="0.00" className="text-right" />
              <button type="button" onClick={() => removeLine(i)} className="text-[#3a3a4a] hover:text-red-400 flex justify-center"><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" onClick={addLine} className="text-xs text-[#8888aa] hover:text-white flex items-center gap-1.5 px-1"><Plus size={13} /> Add line</button>
        </div>

        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-[#8888aa]">Dr <span className="text-rose-400 font-semibold tabular-nums">{formatCurrency(drTotal)}</span> · Cr <span className="text-sky-400 font-semibold tabular-nums">{formatCurrency(crTotal)}</span></span>
        </div>

        <Textarea label="Narration" value={narration} onChange={e => setNarration(e.target.value)} rows={2} placeholder="Being…" />
        <div className="flex justify-end">
          <Button type="submit" loading={saving} icon={Check} disabled={!balanced}>Save Voucher</Button>
        </div>
      </form>

      {/* Recent vouchers */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2a3a]"><h3 className="text-sm font-semibold text-white">Recent Vouchers</h3></div>
        {vouchers.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#8888aa]">No vouchers yet.</div>
        ) : (
          <div className="divide-y divide-[#2a2a3a]">
            {vouchers.map(v => {
              const dr = (v.entries ?? []).filter(e => e.dr).reduce((s, e) => s + Number(e.amount), 0)
              return (
                <div key={v.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-white/80 bg-white/10 border border-white/15 rounded px-1.5 py-0.5">{v.voucher_type}</span>
                      <span className="text-sm text-white tabular-nums">{formatCurrency(dr)}</span>
                      <span className="text-xs text-[#8888aa]">{formatDate(v.voucher_date)}{v.voucher_number ? ` · #${v.voucher_number}` : ''}</span>
                    </div>
                    <button onClick={() => deleteVoucher(v)} className="text-[#3a3a4a] hover:text-red-400"><Trash2 size={13} /></button>
                  </div>
                  <div className="mt-1.5 space-y-0.5">
                    {(v.entries ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((e, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className={`${e.dr ? 'text-rose-300' : 'text-sky-300'}`}>{e.dr ? 'Dr' : '   Cr'} &nbsp;{e.ledger_name}</span>
                        <span className="text-[#c8c8da] tabular-nums">{formatCurrency(Number(e.amount))}</span>
                      </div>
                    ))}
                  </div>
                  {v.narration && <div className="text-[11px] text-[#5a5a7a] mt-1 italic">{v.narration}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Ledger master modal */}
      <Modal open={ledgerOpen} onClose={() => setLedgerOpen(false)} title="Add Ledger" size="sm">
        <form onSubmit={saveLedger} className="space-y-4">
          <Input label="Ledger Name *" value={ledgerForm.name} onChange={e => setLedgerForm({ ...ledgerForm, name: e.target.value })} placeholder="e.g. ABC Studios" />
          <Select label="Under Group (Tally)" value={ledgerForm.parent} onChange={e => setLedgerForm({ ...ledgerForm, parent: e.target.value })} options={TALLY_GROUPS.map(g => ({ value: g, label: g }))} />
          <Input label="Opening Balance (optional)" type="number" value={ledgerForm.opening} onChange={e => setLedgerForm({ ...ledgerForm, opening: e.target.value })} placeholder="0" hint="Positive = Debit balance, negative = Credit" />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" icon={X} onClick={() => setLedgerOpen(false)}>Cancel</Button>
            <Button type="submit" loading={ledgerSaving} icon={Plus}>Add</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
