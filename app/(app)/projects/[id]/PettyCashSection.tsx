'use client'

import { useMemo, useState } from 'react'
import { Plus, Wallet, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { PettyCashFloat, PettyCashTxnType } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { useRouter } from 'next/navigation'

type Line = { id: string; section: string; head: string }

interface Props {
  projectId: string
  floats: PettyCashFloat[]
  budgetLines: Line[]
  userId: string
  canManage: boolean
}

const TXN_LABELS: Record<PettyCashTxnType, string> = { issue: 'Issued / Top-up', expense: 'Expense', return: 'Returned' }
const SECTION_LABELS: Record<string, string> = { above_line: 'Above the Line', below_line: 'Below the Line', post: 'Post-production', other: 'Other' }

function metrics(f: PettyCashFloat) {
  const t = f.txns ?? []
  const sum = (k: PettyCashTxnType) => t.filter(x => x.type === k).reduce((s, x) => s + Number(x.amount || 0), 0)
  const issued = sum('issue'), spent = sum('expense'), returned = sum('return')
  return { issued, spent, returned, balance: issued - spent - returned }
}

const TXN_EMPTY = { txn_date: new Date().toISOString().split('T')[0], type: 'expense' as PettyCashTxnType, amount: '', description: '', budget_line_id: '' }

export function PettyCashSection({ projectId, floats, budgetLines, userId, canManage }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<PettyCashFloat | null>(null)
  const [form, setForm] = useState({ holder_name: '', opening: '', notes: '' })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [txnForm, setTxnForm] = useState(TXN_EMPTY)
  const [savingTxn, setSavingTxn] = useState(false)

  const totals = useMemo(() => {
    return floats.reduce((acc, f) => {
      const m = metrics(f)
      acc.issued += m.issued; acc.spent += m.spent; acc.balance += m.balance
      return acc
    }, { issued: 0, spent: 0, balance: 0 })
  }, [floats])

  function openNew() { setEditing(null); setForm({ holder_name: '', opening: '', notes: '' }); setOpen(true) }
  function openEdit(f: PettyCashFloat) {
    setEditing(f)
    setForm({ holder_name: f.holder_name ?? '', opening: '', notes: f.notes ?? '' })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.holder_name.trim()) return toast.error('Enter the holder name')
    setSaving(true)
    const supabase = createClient()
    if (editing) {
      const payload = { holder_name: form.holder_name.trim(), notes: form.notes || null }
      const { data, error } = await supabase.from('petty_cash_floats').update(payload).eq('id', editing.id).select().single()
      if (error) { toast.error("Couldn't update — try again"); setSaving(false); return }
      if (data) await logAction('update', 'petty_cash_floats', editing.id, editing as unknown as Record<string, unknown>, data)
      toast.success('Float updated')
    } else {
      const { data, error } = await supabase.from('petty_cash_floats')
        .insert({ project_id: projectId, holder_name: form.holder_name.trim(), notes: form.notes || null, created_by: userId })
        .select().single()
      if (error) {
        const hint = /relation .*petty_cash.* does not exist/i.test(error.message) ? 'run migration-petty-cash.sql first' : error.message
        toast.error(`Couldn't create float — ${String(hint).slice(0, 80)}`); setSaving(false); return
      }
      if (data) {
        await logAction('create', 'petty_cash_floats', data.id, undefined, data)
        const opening = parseFloat(form.opening) || 0
        if (opening > 0) {
          await supabase.from('petty_cash_txns').insert({ float_id: data.id, type: 'issue', amount: opening, description: 'Opening float', created_by: userId })
        }
      }
      toast.success('Float created')
    }
    setSaving(false); setOpen(false); setEditing(null); router.refresh()
  }

  async function addTxn(floatId: string) {
    if (!txnForm.amount) return toast.error('Enter an amount')
    setSavingTxn(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('petty_cash_txns').insert({
      float_id: floatId,
      txn_date: txnForm.txn_date,
      type: txnForm.type,
      amount: parseFloat(txnForm.amount) || 0,
      description: txnForm.description || null,
      budget_line_id: txnForm.type === 'expense' && txnForm.budget_line_id ? txnForm.budget_line_id : null,
      created_by: userId,
    }).select().single()
    if (error) { toast.error("Couldn't log it — try again"); setSavingTxn(false); return }
    if (data) await logAction('create', 'petty_cash_txns', data.id, undefined, data)
    setSavingTxn(false); setTxnForm(TXN_EMPTY); router.refresh()
  }

  async function deleteTxn(id: string) {
    if (!window.confirm('Delete this transaction?')) return
    const supabase = createClient()
    const { error } = await supabase.from('petty_cash_txns').delete().eq('id', id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'petty_cash_txns', id, undefined, undefined)
    router.refresh()
  }

  async function deleteFloat() {
    if (!editing) return
    if (!window.confirm(`Delete ${editing.holder_name}'s float and all its transactions?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('petty_cash_floats').delete().eq('id', editing.id)
    if (error) { toast.error("Couldn't delete — try again"); return }
    await logAction('delete', 'petty_cash_floats', editing.id, editing as unknown as Record<string, unknown>, undefined)
    toast.success('Float deleted')
    setOpen(false); setEditing(null); router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Petty Cash Floats</h3>
          <p className="text-xs text-[#8888aa] mt-0.5">On-set cash issued to holders — expenses code into the cost report</p>
        </div>
        {canManage && <Button icon={Plus} size="sm" onClick={openNew}>New Float</Button>}
      </div>

      {floats.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard title="Issued" value={formatCurrency(totals.issued)} status="default" />
          <StatCard title="Spent" value={formatCurrency(totals.spent)} status="red" />
          <StatCard title="Cash With Holders" value={formatCurrency(totals.balance)} status={totals.balance < 0 ? 'red' : 'yellow'} subtitle="Unreconciled balance" />
        </div>
      )}

      {floats.length === 0 ? (
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl py-10 text-center text-sm text-[#8888aa]">
          No petty cash floats yet.{canManage ? ' Issue one to a production manager to track on-set spending.' : ''}
        </div>
      ) : (
        <div className="space-y-3">
          {floats.map(f => {
            const m = metrics(f)
            const isOpen = expanded === f.id
            const txns = (f.txns ?? []).slice().sort((a, b) => b.txn_date.localeCompare(a.txn_date))
            return (
              <div key={f.id} className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Wallet size={15} className="text-white/70 shrink-0" />
                        <span className="text-sm font-semibold text-white">{f.holder_name}</span>
                        {f.status === 'closed' && <StatusBadge label="Closed" variant="gray" />}
                      </div>
                      <div className="text-xs text-[#8888aa]">Opened {formatDate(f.opened_date)}{f.notes ? ` · ${f.notes}` : ''}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-white tabular-nums">{formatCurrency(m.balance)}</div>
                      <div className="text-[11px] text-[#8888aa]">balance in hand</div>
                      {canManage && <button onClick={() => openEdit(f)} className="text-[11px] text-[#8888aa] hover:text-white inline-flex items-center gap-1 mt-1"><Pencil size={11} /> Edit</button>}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[['Issued', m.issued, 'text-white'], ['Spent', m.spent, 'text-red-400'], ['Returned', m.returned, 'text-emerald-400']].map(([l, v, c]) => (
                      <div key={l as string} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2">
                        <div className="text-[10px] text-[#8888aa] uppercase tracking-wide">{l as string}</div>
                        <div className={`text-sm font-semibold tabular-nums mt-0.5 ${c as string}`}>{formatCurrency(v as number)}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { setExpanded(isOpen ? null : f.id); setTxnForm(TXN_EMPTY) }}
                    className="mt-3 text-xs text-[#8888aa] hover:text-white inline-flex items-center gap-1">
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Transactions ({txns.length})
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-[#2a2a3a] bg-[#0f0f16] px-5 py-4 space-y-3">
                    {txns.length === 0 ? <p className="text-xs text-[#5a5a7a]">No transactions yet.</p> : (
                      <div className="divide-y divide-[#2a2a3a]">
                        {txns.map(t => {
                          const line = budgetLines.find(l => l.id === t.budget_line_id)
                          return (
                            <div key={t.id} className="py-2 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-xs text-white">{TXN_LABELS[t.type]}{t.description ? <span className="text-[#8888aa]"> · {t.description}</span> : ''}{line ? <span className="text-indigo-300"> · {line.head}</span> : ''}</div>
                                <div className="text-[11px] text-[#5a5a7a]">{formatDate(t.txn_date)}</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-xs font-semibold tabular-nums ${t.type === 'issue' ? 'text-white' : t.type === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>{formatCurrency(t.amount)}</span>
                                {canManage && <button onClick={() => deleteTxn(t.id)} className="text-[#5a5a7a] hover:text-red-400"><Trash2 size={12} /></button>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {canManage && (
                      <div className="flex flex-wrap items-end gap-2 pt-1">
                        <input type="date" value={txnForm.txn_date} onChange={e => setTxnForm({ ...txnForm, txn_date: e.target.value })}
                          className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40" />
                        <select value={txnForm.type} onChange={e => setTxnForm({ ...txnForm, type: e.target.value as PettyCashTxnType })}
                          className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40">
                          {(Object.keys(TXN_LABELS) as PettyCashTxnType[]).map(k => <option key={k} value={k}>{TXN_LABELS[k]}</option>)}
                        </select>
                        <input inputMode="decimal" placeholder="Amount" value={txnForm.amount} onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })}
                          className="w-24 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-white/40" />
                        <input placeholder="Description" value={txnForm.description} onChange={e => setTxnForm({ ...txnForm, description: e.target.value })}
                          className="flex-1 min-w-[100px] bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-white/40" />
                        {txnForm.type === 'expense' && budgetLines.length > 0 && (
                          <select value={txnForm.budget_line_id} onChange={e => setTxnForm({ ...txnForm, budget_line_id: e.target.value })}
                            className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40 max-w-[160px]">
                            <option value="">Code to head…</option>
                            {['above_line', 'below_line', 'post', 'other'].map(s => {
                              const ls = budgetLines.filter(l => l.section === s)
                              if (!ls.length) return null
                              return <optgroup key={s} label={SECTION_LABELS[s]}>{ls.map(l => <option key={l.id} value={l.id}>{l.head}</option>)}</optgroup>
                            })}
                          </select>
                        )}
                        <Button size="sm" onClick={() => addTxn(f.id)} loading={savingTxn}>Log</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Float' : 'New Petty Cash Float'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Holder Name *" value={form.holder_name} onChange={e => setForm({ ...form, holder_name: e.target.value })} required placeholder="e.g. Production Manager name" />
          {!editing && <MoneyInput label="Opening Float (₹)" value={form.opening} onChange={v => setForm({ ...form, opening: v })} />}
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex items-center justify-between gap-2 pt-2">
            {editing && canManage ? (
              <Button variant="ghost" type="button" icon={Trash2} onClick={deleteFloat} className="text-red-400 hover:text-red-300">Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Create Float'}</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
