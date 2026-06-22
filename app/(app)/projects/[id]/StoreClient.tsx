'use client'

import { useMemo, useState } from 'react'
import { Package, Plus, Pencil, Trash2, ChevronDown, ChevronRight, ArrowDownUp, AlertTriangle, Leaf } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface Movement { id: string; log_date: string; change_type: string; quantity: number; notes: string | null }
export interface StoreItem {
  id: string; name: string; department: string | null; unit: string | null
  quantity_on_hand: number; reorder_level: number | null; is_perishable: boolean
  shelf_life_days: number | null; supplier: string | null; notes: string | null
  movements?: Movement[]
}

const EMPTY = { name: '', department: '', unit: '', reorder_level: '', is_perishable: false, shelf_life_days: '', supplier: '', notes: '' }
const MOVE_EMPTY = { change_type: 'consumption', quantity: '', log_date: new Date().toISOString().slice(0, 10), notes: '' }

interface Props { projectId: string; rows: StoreItem[]; userId: string; canManage: boolean; canDelete: boolean }

export function StoreClient({ projectId, rows, userId, canManage, canDelete }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<StoreItem | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [moveFor, setMoveFor] = useState<StoreItem | null>(null)
  const [moveForm, setMoveForm] = useState(MOVE_EMPTY)
  const [movingSave, setMovingSave] = useState(false)

  const lowStock = useMemo(() => rows.filter(r => r.reorder_level != null && r.quantity_on_hand <= r.reorder_level).length, [rows])
  const byDept = useMemo(() => {
    const m = new Map<string, StoreItem[]>()
    for (const r of rows) { const d = r.department || 'Unassigned'; if (!m.has(d)) m.set(d, []); m.get(d)!.push(r) }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(r: StoreItem) {
    setEditing(r)
    setForm({ name: r.name, department: r.department ?? '', unit: r.unit ?? '', reorder_level: r.reorder_level?.toString() ?? '', is_perishable: r.is_perishable, shelf_life_days: r.shelf_life_days?.toString() ?? '', supplier: r.supplier ?? '', notes: r.notes ?? '' })
    setOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, name: form.name.trim(), department: form.department || null, unit: form.unit || null,
      reorder_level: form.reorder_level ? Number(form.reorder_level) : null, is_perishable: form.is_perishable,
      shelf_life_days: form.shelf_life_days ? parseInt(form.shelf_life_days) : null, supplier: form.supplier || null, notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('store_items').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'store_items', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('store_items').insert({ ...payload, quantity_on_hand: 0, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'store_items', data.id, undefined, payload)
    }
    toast.success(editing ? 'Item updated' : 'Item added'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: StoreItem) {
    if (!window.confirm(`Delete "${r.name}" and its movement history?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('store_items').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'store_items', r.id); toast.success('Deleted'); router.refresh()
  }

  function openMove(r: StoreItem) { setMoveFor(r); setMoveForm(MOVE_EMPTY) }
  async function logMovement(e: React.FormEvent) {
    e.preventDefault()
    if (!moveFor) return
    const mag = Number(moveForm.quantity)
    if (!mag) return toast.error('Enter a quantity')
    setMovingSave(true)
    // signed delta: purchase +, consumption −, adjustment as typed (allow negative)
    const delta = moveForm.change_type === 'purchase' ? Math.abs(mag) : moveForm.change_type === 'consumption' ? -Math.abs(mag) : mag
    const supabase = createClient()
    const { error } = await supabase.from('consumption_logs').insert({
      store_item_id: moveFor.id, project_id: projectId, log_date: moveForm.log_date,
      change_type: moveForm.change_type, quantity: delta, notes: moveForm.notes || null, created_by: userId,
    })
    if (error) { toast.error("Couldn't log movement"); setMovingSave(false); return }
    const newQty = Number(moveFor.quantity_on_hand) + delta
    await supabase.from('store_items').update({ quantity_on_hand: newQty }).eq('id', moveFor.id)
    await logAction('create', 'consumption_logs', moveFor.id, undefined, { change_type: moveForm.change_type, delta })
    toast.success('Movement logged'); setMovingSave(false); setMoveFor(null); router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2"><Package size={16} className="text-white/70" /><h3 className="text-sm font-semibold text-white">Store &amp; Inventory</h3>
          {lowStock > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">{lowStock} low / reorder</span>}
        </div>
        {canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add item</Button>}
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No store items yet. Add materials per department and log purchases &amp; consumption.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {byDept.map(([dept, items]) => (
            <div key={dept}>
              <div className="px-5 py-2 bg-[#0f0f16] text-[10px] uppercase tracking-wide text-[#666688]">{dept}</div>
              {items.map(r => {
                const isOpen = expanded === r.id
                const low = r.reorder_level != null && r.quantity_on_hand <= r.reorder_level
                return (
                  <div key={r.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <button onClick={() => setExpanded(isOpen ? null : r.id)} className="flex items-center gap-2 min-w-0 text-left">
                        {isOpen ? <ChevronDown size={14} className="text-[#8888aa] shrink-0" /> : <ChevronRight size={14} className="text-[#8888aa] shrink-0" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white truncate">{r.name}</span>
                            {r.is_perishable && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-0.5"><Leaf size={9} /> perishable{r.shelf_life_days ? ` ${r.shelf_life_days}d` : ''}</span>}
                            {low && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 inline-flex items-center gap-0.5"><AlertTriangle size={9} /> reorder</span>}
                          </div>
                          <div className="text-[11px] text-[#8888aa] mt-0.5">{r.reorder_level != null ? `reorder ≤ ${r.reorder_level}` : ''}{r.supplier ? ` · ${r.supplier}` : ''}</div>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-semibold text-white tabular-nums">{Number(r.quantity_on_hand)}{r.unit ? ` ${r.unit}` : ''}</span>
                        {canManage && <button onClick={() => openMove(r)} title="Log movement" className="p-1.5 text-[#8888aa] hover:text-white"><ArrowDownUp size={14} /></button>}
                        {canManage && <button onClick={() => openEdit(r)} className="p-1.5 text-[#8888aa] hover:text-white"><Pencil size={14} /></button>}
                        {canDelete && <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>}
                      </div>
                    </div>
                    {isOpen && (
                      <div className="mt-2 ml-6">
                        <div className="text-[10px] uppercase tracking-wide text-[#666688] mb-1">Recent movements</div>
                        {(r.movements ?? []).length === 0 ? <div className="text-[11px] text-[#5a5a7a]">No movements logged.</div> : (
                          <ul className="space-y-1">
                            {[...(r.movements ?? [])].slice(0, 8).map(m => (
                              <li key={m.id} className="text-[11px] flex items-center gap-2">
                                <span className={`tabular-nums ${m.quantity >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{m.quantity >= 0 ? '+' : ''}{m.quantity}</span>
                                <span className="text-[#8888aa]">{m.change_type}</span>
                                <span className="text-[#5a5a7a]">{formatDate(m.log_date)}{m.notes ? ` · ${m.notes}` : ''}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Add / edit item */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Item' : 'Add Store Item'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Coconut palm fronds" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="Art / Catering…" />
            <Input label="Unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="bundles / kg / pcs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Reorder level" type="number" value={form.reorder_level} onChange={e => setForm({ ...form, reorder_level: e.target.value })} />
            <Input label="Supplier" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#c8c8da]">
            <input type="checkbox" checked={form.is_perishable} onChange={e => setForm({ ...form, is_perishable: e.target.checked })} /> Perishable (buy day-of — no bulk)
          </label>
          {form.is_perishable && <Input label="Shelf life (days)" type="number" value={form.shelf_life_days} onChange={e => setForm({ ...form, shelf_life_days: e.target.value })} />}
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          {!editing && <p className="text-[11px] text-[#5a5a7a]">Starts at 0 on hand — log a purchase to add stock.</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>

      {/* Log movement */}
      <Modal open={!!moveFor} onClose={() => setMoveFor(null)} title={`Log movement — ${moveFor?.name ?? ''}`} size="sm">
        <form onSubmit={logMovement} className="space-y-4">
          <div className="text-[11px] text-[#8888aa]">On hand: <span className="text-white">{Number(moveFor?.quantity_on_hand ?? 0)}{moveFor?.unit ? ` ${moveFor.unit}` : ''}</span></div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={moveForm.change_type} onChange={e => setMoveForm({ ...moveForm, change_type: e.target.value })} options={[{ value: 'purchase', label: 'Purchase (+)' }, { value: 'consumption', label: 'Consumption (−)' }, { value: 'adjustment', label: 'Adjustment (±)' }]} />
            <Input label="Quantity" type="number" value={moveForm.quantity} onChange={e => setMoveForm({ ...moveForm, quantity: e.target.value })} placeholder={moveForm.change_type === 'adjustment' ? '± value' : 'amount'} />
          </div>
          <Input label="Date" type="date" value={moveForm.log_date} onChange={e => setMoveForm({ ...moveForm, log_date: e.target.value })} />
          <Input label="Notes" value={moveForm.notes} onChange={e => setMoveForm({ ...moveForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setMoveFor(null)}>Cancel</Button>
            <Button type="submit" loading={movingSave}>Log</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
