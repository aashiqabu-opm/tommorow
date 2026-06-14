'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { RECURRING_CATEGORY_LABELS, type PersonalRecurring } from '@/lib/types'

const thisMonth = () => new Date().toISOString().slice(0, 7)

export function RecurringTab({ ownerId, rows, onChange }: { ownerId: string; rows: PersonalRecurring[]; onChange: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalRecurring | null>(null)
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<PersonalRecurring['category']>('rent')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [autopay, setAutopay] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const month = thisMonth()
  const active = rows.filter(r => r.active)
  const monthlyTotal = active.reduce((s, r) => s + Number(r.amount), 0)
  const unpaid = active.filter(r => r.last_paid_month !== month && !r.autopay)
  const unpaidTotal = unpaid.reduce((s, r) => s + Number(r.amount), 0)

  function openNew() { setEditing(null); setLabel(''); setCategory('rent'); setAmount(''); setDueDay(''); setAutopay(false); setNotes(''); setOpen(true) }
  function openEdit(r: PersonalRecurring) { setEditing(r); setLabel(r.label); setCategory(r.category); setAmount(String(r.amount)); setDueDay(r.due_day ? String(r.due_day) : ''); setAutopay(r.autopay); setNotes(r.notes ?? ''); setOpen(true) }

  async function save() {
    if (!label) { toast.error('Label required'); return }
    setSaving(true); const supabase = createClient()
    const payload = { label, category, amount: Number(amount || 0), due_day: dueDay ? Number(dueDay) : null, autopay, notes: notes || null }
    if (editing) { const { error } = await supabase.from('personal_recurring').update(payload).eq('id', editing.id); if (error) { toast.error("Couldn't save"); setSaving(false); return } await logAction('update', 'personal_recurring', editing.id) }
    else { const { data, error } = await supabase.from('personal_recurring').insert({ ...payload, owner_id: ownerId, active: true }).select().single(); if (error) { toast.error("Couldn't save"); setSaving(false); return } if (data) await logAction('create', 'personal_recurring', data.id) }
    setSaving(false); setOpen(false); toast.success('Saved'); onChange()
  }
  async function togglePaid(r: PersonalRecurring) {
    const supabase = createClient()
    const next = r.last_paid_month === month ? null : month
    await supabase.from('personal_recurring').update({ last_paid_month: next }).eq('id', r.id)
    onChange()
  }
  async function remove(r: PersonalRecurring) { if (!confirm('Delete?')) return; const supabase = createClient(); await supabase.from('personal_recurring').delete().eq('id', r.id); await logAction('delete', 'personal_recurring', r.id); toast.success('Deleted'); onChange() }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-[#8888aa]">This month: <span className="text-white font-medium">{formatCurrency(monthlyTotal)}</span> committed · <span className={unpaidTotal ? 'text-amber-300' : 'text-emerald-300'}>{formatCurrency(unpaidTotal)} unpaid</span></p>
        <Button icon={Plus} onClick={openNew}>Add</Button>
      </div>
      {active.length === 0 ? (
        <div className="text-center text-sm text-[#8888aa] bg-[#13131a] border border-dashed border-[#2a2a3a] rounded-xl py-10 px-6">Add rent, utilities, subscriptions and EMIs to see what's due each month.</div>
      ) : (
        <div className="space-y-2">
          {active.map(r => {
            const paid = r.last_paid_month === month || r.autopay
            return (
              <div key={r.id} className="flex items-center justify-between bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => togglePaid(r)} title={r.autopay ? 'Autopay' : paid ? 'Paid' : 'Mark paid'}
                    className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${paid ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'border-[#3a3a4a] text-transparent hover:border-white/40'}`}>
                    <Check size={13} />
                  </button>
                  <div className="min-w-0">
                    <div className="text-sm text-white font-medium truncate">{r.label} <span className="text-[#8888aa] font-normal">· {RECURRING_CATEGORY_LABELS[r.category]}</span></div>
                    <div className="text-xs text-[#8888aa] mt-0.5">{r.due_day ? `Due day ${r.due_day}` : 'No due day'}{r.autopay ? ' · autopay' : paid ? ' · paid' : ' · unpaid'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-white">{formatCurrency(Number(r.amount))}</span>
                  <button onClick={() => openEdit(r)} className="text-[#8888aa] hover:text-white"><Pencil size={15} /></button>
                  <button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit recurring item' : 'Add recurring item'}>
        <div className="space-y-3">
          <Input label="Label" value={label} onChange={e => setLabel(e.target.value)} placeholder="House rent / Netflix / car EMI" />
          <Select label="Category" value={category} onChange={e => setCategory(e.target.value as PersonalRecurring['category'])} options={Object.entries(RECURRING_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
          <MoneyInput label="Amount" value={amount} onChange={setAmount} />
          <Input label="Due day of month (1-31)" type="number" value={dueDay} onChange={e => setDueDay(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={autopay} onChange={e => setAutopay(e.target.checked)} /> Autopay enabled</label>
          <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}
