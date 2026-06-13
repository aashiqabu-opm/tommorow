'use client'

import { useMemo, useState } from 'react'
import { Plus, Users, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ProjectCrew, CrewPaymentType } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { useRouter } from 'next/navigation'

type Line = { id: string; section: string; head: string }

interface Props {
  projectId: string
  crew: ProjectCrew[]
  budgetLines: Line[]
  userId: string
  canManage: boolean
}

const PAY_LABELS: Record<CrewPaymentType, string> = { advance: 'Advance', payment: 'Payment', final: 'Final Settlement' }
const SECTION_LABELS: Record<string, string> = { above_line: 'Above the Line', below_line: 'Below the Line', post: 'Post-production', other: 'Other' }

function metrics(c: ProjectCrew) {
  const fee = Number(c.agreed_fee || 0)
  const tds = fee * Number(c.tds_percent || 0) / 100
  const net = fee - tds
  const paid = (c.payments ?? []).reduce((s, p) => s + Number(p.amount || 0), 0)
  return { fee, tds, net, paid, balance: net - paid }
}

const EMPTY = { name: '', role_title: '', agreed_fee: '', tds_percent: '0', budget_line_id: '', phone: '', email: '', pan: '', status: 'active', notes: '' }
const PAY_EMPTY = { payment_date: new Date().toISOString().split('T')[0], type: 'advance' as CrewPaymentType, amount: '', notes: '' }

export function CrewLedgerSection({ projectId, crew, budgetLines, userId, canManage }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<ProjectCrew | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [payForm, setPayForm] = useState(PAY_EMPTY)
  const [savingPay, setSavingPay] = useState(false)

  const totals = useMemo(() => crew.reduce((acc, c) => {
    const m = metrics(c)
    acc.fee += m.fee; acc.tds += m.tds; acc.paid += m.paid; acc.balance += m.balance
    return acc
  }, { fee: 0, tds: 0, paid: 0, balance: 0 }), [crew])

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(c: ProjectCrew) {
    setEditing(c)
    setForm({
      name: c.name ?? '', role_title: c.role_title ?? '',
      agreed_fee: c.agreed_fee != null ? String(c.agreed_fee) : '',
      tds_percent: c.tds_percent != null ? String(c.tds_percent) : '0',
      budget_line_id: c.budget_line_id ?? '', phone: c.phone ?? '', email: c.email ?? '',
      pan: c.pan ?? '', status: c.status ?? 'active', notes: c.notes ?? '',
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Enter a name')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, name: form.name.trim(), role_title: form.role_title || null,
      agreed_fee: parseFloat(form.agreed_fee) || 0, tds_percent: parseFloat(form.tds_percent) || 0,
      budget_line_id: form.budget_line_id || null, phone: form.phone || null, email: form.email || null,
      pan: form.pan || null, status: form.status, notes: form.notes || null,
    }
    if (editing) {
      const { data, error } = await supabase.from('project_crew').update(payload).eq('id', editing.id).select().single()
      if (error) { toast.error("Couldn't update — try again"); setSaving(false); return }
      if (data) await logAction('update', 'project_crew', editing.id, editing as unknown as Record<string, unknown>, data)
      toast.success('Updated')
    } else {
      const { data, error } = await supabase.from('project_crew').insert({ ...payload, created_by: userId }).select().single()
      if (error) {
        const hint = /relation .*project_crew.* does not exist/i.test(error.message) ? 'run migration-crew.sql first' : error.message
        toast.error(`Couldn't save — ${String(hint).slice(0, 80)}`); setSaving(false); return
      }
      if (data) await logAction('create', 'project_crew', data.id, undefined, data)
      toast.success('Added to crew')
    }
    setSaving(false); setOpen(false); setEditing(null); router.refresh()
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm(`Remove ${editing.name} and their payment history?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('project_crew').delete().eq('id', editing.id)
    if (error) { toast.error("Couldn't delete — try again"); return }
    await logAction('delete', 'project_crew', editing.id, editing as unknown as Record<string, unknown>, undefined)
    toast.success('Removed'); setOpen(false); setEditing(null); router.refresh()
  }

  async function addPayment(crewId: string) {
    if (!payForm.amount) return toast.error('Enter an amount')
    setSavingPay(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('crew_payments').insert({
      crew_id: crewId, amount: parseFloat(payForm.amount) || 0, payment_date: payForm.payment_date,
      type: payForm.type, notes: payForm.notes || null, created_by: userId,
    }).select().single()
    if (error) { toast.error("Couldn't log payment — try again"); setSavingPay(false); return }
    if (data) await logAction('create', 'crew_payments', data.id, undefined, data)
    setSavingPay(false); setPayForm(PAY_EMPTY); router.refresh()
  }

  async function deletePayment(id: string) {
    if (!window.confirm('Delete this payment?')) return
    const supabase = createClient()
    const { error } = await supabase.from('crew_payments').delete().eq('id', id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'crew_payments', id, undefined, undefined)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Crew &amp; Cast Ledger</h3>
          <p className="text-xs text-[#8888aa] mt-0.5">Fees, advances, TDS &amp; balance due per person</p>
        </div>
        {canManage && <Button icon={Plus} size="sm" onClick={openNew}>Add Person</Button>}
      </div>

      {crew.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Agreed Fees" value={formatCurrency(totals.fee)} status="default" />
          <StatCard title="Paid" value={formatCurrency(totals.paid)} status="green" />
          <StatCard title="Balance Due" value={formatCurrency(totals.balance)} status={totals.balance > 0 ? 'yellow' : 'green'} />
          <StatCard title="TDS (on fees)" value={formatCurrency(totals.tds)} status="default" subtitle="To deposit" />
        </div>
      )}

      {crew.length === 0 ? (
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl py-10 text-center text-sm text-[#8888aa]">
          No crew or cast added yet.{canManage ? ' Add artists and technicians with their agreed fees.' : ''}
        </div>
      ) : (
        <div className="space-y-3">
          {crew.map(c => {
            const m = metrics(c)
            const line = budgetLines.find(l => l.id === c.budget_line_id)
            const isOpen = expanded === c.id
            const pays = (c.payments ?? []).slice().sort((a, b) => b.payment_date.localeCompare(a.payment_date))
            return (
              <div key={c.id} className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Users size={15} className="text-white/70 shrink-0" />
                        <span className="text-sm font-semibold text-white">{c.name}</span>
                        {c.role_title && <StatusBadge label={c.role_title} variant="gray" />}
                        {c.status === 'closed' && <StatusBadge label="Settled" variant="green" />}
                      </div>
                      <div className="text-xs text-[#8888aa] flex flex-wrap gap-x-3">
                        {c.tds_percent > 0 && <span>TDS {c.tds_percent}%</span>}
                        {line && <span className="text-indigo-300">{line.head}</span>}
                        {c.pan && <span>PAN {c.pan}</span>}
                        {c.phone && <span>{c.phone}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-base font-bold tabular-nums ${m.balance > 0 ? 'text-amber-300' : 'text-white'}`}>{formatCurrency(m.balance)}</div>
                      <div className="text-[11px] text-[#8888aa]">balance due</div>
                      {canManage && <button onClick={() => openEdit(c)} className="text-[11px] text-[#8888aa] hover:text-white inline-flex items-center gap-1 mt-1"><Pencil size={11} /> Edit</button>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    {[['Agreed fee', m.fee], ['TDS', m.tds], ['Net payable', m.net], ['Paid', m.paid]].map(([l, v]) => (
                      <div key={l as string} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2">
                        <div className="text-[10px] text-[#8888aa] uppercase tracking-wide">{l as string}</div>
                        <div className="text-sm font-semibold text-white tabular-nums mt-0.5">{formatCurrency(v as number)}</div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { setExpanded(isOpen ? null : c.id); setPayForm(PAY_EMPTY) }}
                    className="mt-3 text-xs text-[#8888aa] hover:text-white inline-flex items-center gap-1">
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Payments ({pays.length})
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-[#2a2a3a] bg-[#0f0f16] px-5 py-4 space-y-3">
                    {pays.length === 0 ? <p className="text-xs text-[#5a5a7a]">No payments yet.</p> : (
                      <div className="divide-y divide-[#2a2a3a]">
                        {pays.map(p => (
                          <div key={p.id} className="py-2 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs text-white">{PAY_LABELS[p.type]}{p.notes ? <span className="text-[#8888aa]"> · {p.notes}</span> : ''}</div>
                              <div className="text-[11px] text-[#5a5a7a]">{formatDate(p.payment_date)}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-semibold tabular-nums text-emerald-400">{formatCurrency(p.amount)}</span>
                              {canManage && <button onClick={() => deletePayment(p.id)} className="text-[#5a5a7a] hover:text-red-400"><Trash2 size={12} /></button>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {canManage && (
                      <div className="flex flex-wrap items-end gap-2 pt-1">
                        <input type="date" value={payForm.payment_date} onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })}
                          className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40" />
                        <select value={payForm.type} onChange={e => setPayForm({ ...payForm, type: e.target.value as CrewPaymentType })}
                          className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40">
                          {(Object.keys(PAY_LABELS) as CrewPaymentType[]).map(k => <option key={k} value={k}>{PAY_LABELS[k]}</option>)}
                        </select>
                        <input inputMode="decimal" placeholder="Amount" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                          className="w-28 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-white/40" />
                        <input placeholder="Note (optional)" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })}
                          className="flex-1 min-w-[120px] bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-white/40" />
                        <Button size="sm" onClick={() => addPayment(c.id)} loading={savingPay}>Log</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Crew / Cast' : 'Add Crew / Cast'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Shaji Kumar" />
            <Input label="Role / Title" value={form.role_title} onChange={e => setForm({ ...form, role_title: e.target.value })} placeholder="e.g. Cinematographer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Agreed Fee (₹)" value={form.agreed_fee} onChange={v => setForm({ ...form, agreed_fee: v })} />
            <Input label="TDS %" inputMode="decimal" value={form.tds_percent} onChange={e => setForm({ ...form, tds_percent: e.target.value })} placeholder="e.g. 10" />
          </div>
          {budgetLines.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[#8888aa] mb-1.5">Budget Head (cost report)</label>
              <select value={form.budget_line_id} onChange={e => setForm({ ...form, budget_line_id: e.target.value })}
                className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/40">
                <option value="">— Not coded —</option>
                {['above_line', 'below_line', 'post', 'other'].map(s => {
                  const ls = budgetLines.filter(l => l.section === s)
                  if (!ls.length) return null
                  return <optgroup key={s} label={SECTION_LABELS[s]}>{ls.map(l => <option key={l.id} value={l.id}>{l.head}</option>)}</optgroup>
                })}
              </select>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Input label="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <Input label="PAN" value={form.pan} onChange={e => setForm({ ...form, pan: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              options={[{ value: 'active', label: 'Active' }, { value: 'closed', label: 'Settled' }]} />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex items-center justify-between gap-2 pt-2">
            {editing && canManage ? (
              <Button variant="ghost" type="button" icon={Trash2} onClick={handleDelete} className="text-red-400 hover:text-red-300">Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Add Person'}</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
