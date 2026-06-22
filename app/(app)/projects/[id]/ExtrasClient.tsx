'use client'

import { useMemo, useState } from 'react'
import { Users, Plus, Pencil, Trash2, BadgeCheck } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface ExtrasDay {
  id: string; call_date: string; category: string; description: string | null; coordinator: string | null
  count_required: number; count_present: number; rate_per_head: number; meals_count: number | null
  total_paid: number | null; supervisor_signoff: boolean; status: string; notes: string | null
}

const CATEGORIES = ['period', 'contemporary', 'specialty', 'other']
const CAT_LABEL: Record<string, string> = { period: 'Period', contemporary: 'Contemporary', specialty: 'Specialty', other: 'Other' }
const STATUSES = ['planned', 'confirmed', 'paid']
const statusCls: Record<string, string> = {
  planned: 'bg-white/5 text-[#8888aa] border-[#2a2a3a]', confirmed: 'bg-sky-500/15 text-sky-400 border-sky-500/30', paid: 'bg-green-500/15 text-green-400 border-green-500/30',
}
const EMPTY = { call_date: new Date().toISOString().slice(0, 10), category: 'contemporary', description: '', coordinator: '', count_required: '', count_present: '', rate_per_head: '', meals_count: '', total_paid: '', supervisor_signoff: false, status: 'planned', notes: '' }

interface Props { projectId: string; rows: ExtrasDay[]; userId: string; canManage: boolean; canDelete: boolean }

export function ExtrasClient({ projectId, rows, userId, canManage, canDelete }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<ExtrasDay | null>(null)
  const [form, setForm] = useState(EMPTY)

  const totals = useMemo(() => ({
    days: rows.length,
    present: rows.reduce((s, r) => s + (r.count_present || 0), 0),
    cash: rows.reduce((s, r) => s + Number(r.total_paid || 0), 0),
  }), [rows])

  const suggested = (count: string | number, rate: string | number) => (Number(count) || 0) * (Number(rate) || 0)

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(r: ExtrasDay) {
    setEditing(r)
    setForm({ call_date: r.call_date, category: r.category, description: r.description ?? '', coordinator: r.coordinator ?? '', count_required: r.count_required?.toString() ?? '', count_present: r.count_present?.toString() ?? '', rate_per_head: r.rate_per_head?.toString() ?? '', meals_count: r.meals_count?.toString() ?? '', total_paid: r.total_paid?.toString() ?? '', supervisor_signoff: r.supervisor_signoff, status: r.status, notes: r.notes ?? '' })
    setOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, call_date: form.call_date, category: form.category, description: form.description || null,
      coordinator: form.coordinator || null, count_required: parseInt(form.count_required) || 0, count_present: parseInt(form.count_present) || 0,
      rate_per_head: form.rate_per_head ? Number(form.rate_per_head) : 0, meals_count: form.meals_count ? parseInt(form.meals_count) : null,
      total_paid: form.total_paid ? Number(form.total_paid) : null, supervisor_signoff: form.supervisor_signoff, status: form.status, notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('extras_days').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'extras_days', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('extras_days').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'extras_days', data.id, undefined, payload)
    }
    toast.success(editing ? 'Updated' : 'Extras day added'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: ExtrasDay) {
    if (!window.confirm(`Delete the ${formatDate(r.call_date)} extras day?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('extras_days').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'extras_days', r.id); toast.success('Deleted'); router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2"><Users size={16} className="text-white/70" /><h3 className="text-sm font-semibold text-white">Extras / Background</h3></div>
        {canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add day</Button>}
      </div>

      <div className="px-5 py-4 border-b border-[#2a2a3a] grid grid-cols-3 gap-3">
        <Stat label="Extras days" value={String(totals.days)} />
        <Stat label="Total present" value={String(totals.present)} />
        <Stat label="Cash paid" value={formatCurrency(totals.cash)} />
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No extras days yet. Log each day's background call, headcount and cash paid.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {rows.map(r => {
            const cash = r.total_paid != null ? Number(r.total_paid) : suggested(r.count_present, r.rate_per_head)
            return (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{formatDate(r.call_date)}</span>
                    <span className="text-[10px] uppercase tracking-wide text-[#8888aa]">{CAT_LABEL[r.category]}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusCls[r.status]}`}>{r.status}</span>
                    {r.supervisor_signoff && <span className="text-[10px] text-emerald-400 inline-flex items-center gap-0.5"><BadgeCheck size={11} /> signed off</span>}
                  </div>
                  <div className="text-[11px] text-[#8888aa] mt-0.5">
                    {r.count_present}/{r.count_required} present · ₹{Number(r.rate_per_head)}/head{r.meals_count ? ` · ${r.meals_count} meals` : ''}{r.coordinator ? ` · ${r.coordinator}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white tabular-nums">{formatCurrency(cash)}</div>
                    {r.total_paid == null && <div className="text-[10px] text-[#5a5a7a]">suggested</div>}
                  </div>
                  {canManage && <button onClick={() => openEdit(r)} className="p-1.5 text-[#8888aa] hover:text-white"><Pencil size={14} /></button>}
                  {canDelete && <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Extras Day' : 'Add Extras Day'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Call date" type="date" value={form.call_date} onChange={e => setForm({ ...form, call_date: e.target.value })} />
            <Select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} options={CATEGORIES.map(c => ({ value: c, label: CAT_LABEL[c] }))} />
          </div>
          <Input label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Scene / purpose" />
          <Input label="Coordinator" value={form.coordinator} onChange={e => setForm({ ...form, coordinator: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Required" type="number" value={form.count_required} onChange={e => setForm({ ...form, count_required: e.target.value })} />
            <Input label="Present" type="number" value={form.count_present} onChange={e => setForm({ ...form, count_present: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Rate / head (₹)" value={form.rate_per_head} onChange={v => setForm({ ...form, rate_per_head: v })} />
            <Input label="Meals count" type="number" value={form.meals_count} onChange={e => setForm({ ...form, meals_count: e.target.value })} />
          </div>
          <div className="text-[11px] text-[#8888aa]">Suggested cash (present × rate): <span className="text-white">{formatCurrency(suggested(form.count_present, form.rate_per_head))}</span></div>
          <MoneyInput label="Cash actually paid (₹)" value={form.total_paid} onChange={v => setForm({ ...form, total_paid: v })} />
          <div className="grid grid-cols-2 gap-3 items-center">
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STATUSES.map(s => ({ value: s, label: s }))} />
            <label className="flex items-center gap-2 text-sm text-[#c8c8da] pt-5"><input type="checkbox" checked={form.supervisor_signoff} onChange={e => setForm({ ...form, supervisor_signoff: e.target.checked })} /> Supervisor signed off</label>
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          <p className="text-[11px] text-[#5a5a7a]">Cash paid is reconciled against petty cash — record the petty-cash expense there too so the budget actual stays accurate.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1a1a24] rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wide text-[#8888aa]">{label}</div>
      <div className="text-lg font-bold tabular-nums mt-0.5 text-white">{value}</div>
    </div>
  )
}
