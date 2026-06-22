'use client'

import { useMemo, useState } from 'react'
import { Fuel, Plus, Pencil, Trash2, Car, Zap } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatCurrency } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface FuelEstimate {
  id: string; source_type: string; label: string; basis: string
  units: number; rate_per_unit: number; notes: string | null
}

const SOURCES = ['vehicle', 'generator', 'other']
const SOURCE_LABEL: Record<string, string> = { vehicle: 'Vehicle', generator: 'Generator', other: 'Other' }
const BASES = ['per_km', 'per_hour', 'per_day', 'flat']
const BASIS_LABEL: Record<string, string> = { per_km: 'per km', per_hour: 'per hour', per_day: 'per day', flat: 'flat' }
const UNIT_LABEL: Record<string, string> = { per_km: 'km', per_hour: 'hours', per_day: 'days', flat: '' }
const cost = (u: number | string, r: number | string) => (Number(u) || 0) * (Number(r) || 0)

const EMPTY = { source_type: 'vehicle', label: '', basis: 'per_km', units: '', rate_per_unit: '', notes: '' }

interface Props { projectId: string; rows: FuelEstimate[]; userId: string; canManage: boolean; canDelete: boolean }

export function FuelClient({ projectId, rows, userId, canManage, canDelete }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<FuelEstimate | null>(null)
  const [form, setForm] = useState(EMPTY)

  const total = useMemo(() => rows.reduce((s, r) => s + cost(r.units, r.rate_per_unit), 0), [rows])

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(r: FuelEstimate) {
    setEditing(r)
    setForm({ source_type: r.source_type, label: r.label, basis: r.basis, units: r.units?.toString() ?? '', rate_per_unit: r.rate_per_unit?.toString() ?? '', notes: r.notes ?? '' })
    setOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.label.trim()) return toast.error('Label is required')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, source_type: form.source_type, label: form.label.trim(), basis: form.basis,
      units: form.units ? Number(form.units) : 0, rate_per_unit: form.rate_per_unit ? Number(form.rate_per_unit) : 0, notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('fuel_estimates').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'fuel_estimates', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('fuel_estimates').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'fuel_estimates', data.id, undefined, payload)
    }
    toast.success(editing ? 'Updated' : 'Estimate added'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: FuelEstimate) {
    if (!window.confirm(`Delete "${r.label}"?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('fuel_estimates').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'fuel_estimates', r.id); toast.success('Deleted'); router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2"><Fuel size={16} className="text-white/70" /><h3 className="text-sm font-semibold text-white">Fuel Estimates</h3></div>
        {canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add estimate</Button>}
      </div>

      <div className="px-5 py-4 border-b border-[#2a2a3a]">
        <div className="bg-[#1a1a24] rounded-xl p-3 inline-block">
          <div className="text-[10px] uppercase tracking-wide text-[#8888aa]">Total estimated fuel</div>
          <div className="text-xl font-bold tabular-nums mt-0.5 text-white">{formatCurrency(total)}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No fuel estimates yet. Add vehicles (per-km) and generators (per-hour) to forecast fuel.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {rows.map(r => {
            const Icon = r.source_type === 'generator' ? Zap : r.source_type === 'vehicle' ? Car : Fuel
            return (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex items-center gap-2.5">
                  <Icon size={15} className="text-[#8888aa] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{r.label}</div>
                    <div className="text-[11px] text-[#8888aa] mt-0.5">{SOURCE_LABEL[r.source_type]} · {Number(r.units)} {UNIT_LABEL[r.basis]} × ₹{Number(r.rate_per_unit)} {BASIS_LABEL[r.basis]}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(cost(r.units, r.rate_per_unit))}</span>
                  {canManage && <button onClick={() => openEdit(r)} className="p-1.5 text-[#8888aa] hover:text-white"><Pencil size={14} /></button>}
                  {canDelete && <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Estimate' : 'Add Fuel Estimate'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Source" value={form.source_type} onChange={e => setForm({ ...form, source_type: e.target.value, basis: e.target.value === 'generator' ? 'per_hour' : form.basis })} options={SOURCES.map(s => ({ value: s, label: SOURCE_LABEL[s] }))} />
            <Select label="Basis" value={form.basis} onChange={e => setForm({ ...form, basis: e.target.value })} options={BASES.map(b => ({ value: b, label: BASIS_LABEL[b] }))} />
          </div>
          <Input label="Label" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Camera truck / Generator 250kVA" />
          <div className="grid grid-cols-2 gap-3">
            <Input label={`Units (${UNIT_LABEL[form.basis] || 'qty'})`} type="number" value={form.units} onChange={e => setForm({ ...form, units: e.target.value })} />
            <MoneyInput label="Rate / unit (₹)" value={form.rate_per_unit} onChange={v => setForm({ ...form, rate_per_unit: v })} />
          </div>
          <div className="text-[11px] text-[#8888aa]">Estimated: <span className="text-white">{formatCurrency(cost(form.units, form.rate_per_unit))}</span></div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
