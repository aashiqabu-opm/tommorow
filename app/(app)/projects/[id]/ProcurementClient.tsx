'use client'

import { useState } from 'react'
import { ClipboardList, Coins, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface PO {
  id: string; po_number: string | null; vendor_id: string | null; department: string | null
  description: string | null; order_amount: number | null; status: string; expected_delivery_date: string | null
}
export interface Advance {
  id: string; vendor_id: string | null; purchase_order_id: string | null; amount: number | null
  paid_date: string | null; expected_delivery_date: string | null; status: string; payment_request_id: string | null; notes: string | null
}
type VendorOpt = { id: string; name: string }

const PO_STATUS = ['draft', 'raised', 'approved', 'confirmed', 'partial', 'delivered', 'closed', 'cancelled']
const ADV_STATUS = ['advance_paid', 'partial_delivery', 'full_delivery', 'balance_paid', 'closed']
const statusCls: Record<string, string> = {
  delivered: 'text-emerald-400', closed: 'text-[#8888aa]', balance_paid: 'text-emerald-400', full_delivery: 'text-emerald-400',
  cancelled: 'text-red-400', advance_paid: 'text-amber-400', partial: 'text-amber-400', partial_delivery: 'text-amber-400',
}
const badge = (s: string) => <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/5 border border-[#2a2a3a] ${statusCls[s] ?? 'text-[#8888aa]'}`}>{s.replace(/_/g, ' ')}</span>

interface Props {
  projectId: string; vendors: VendorOpt[]; pos: PO[]; advances: Advance[]
  userId: string; canManage: boolean; canDelete: boolean
}

export function ProcurementClient({ projectId, vendors, pos, advances, userId, canManage, canDelete }: Props) {
  const [tab, setTab] = useState<'pos' | 'advances'>('pos')
  const vendorName = (id: string | null) => vendors.find(v => v.id === id)?.name ?? '—'

  const outstanding = advances.filter(a => a.status !== 'closed' && a.status !== 'balance_paid')
    .reduce((s, a) => s + Number(a.amount || 0), 0)
  const openPo = pos.filter(p => !['closed', 'cancelled', 'delivered'].includes(p.status))
    .reduce((s, p) => s + Number(p.order_amount || 0), 0)

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-3"><div className="text-[10px] uppercase tracking-wide text-[#8888aa]">Open PO value</div><div className="text-lg font-bold text-white mt-0.5 tabular-nums">{formatCurrency(openPo)}</div></div>
        <div className="bg-[#1a1a24] border border-amber-500/20 rounded-xl p-3"><div className="text-[10px] uppercase tracking-wide text-[#8888aa]">Outstanding advances (in field)</div><div className="text-lg font-bold text-amber-300 mt-0.5 tabular-nums">{formatCurrency(outstanding)}</div></div>
      </div>

      <div className="flex gap-1 mb-4">
        {([['pos', 'Purchase Orders', ClipboardList], ['advances', 'Vendor Advances', Coins]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg ${tab === id ? 'bg-white/10 text-white' : 'text-[#8888aa] hover:text-white'}`}><Icon size={13} /> {label}</button>
        ))}
      </div>

      {tab === 'pos'
        ? <Pos {...{ projectId, vendors, vendorName, rows: pos, userId, canManage, canDelete }} />
        : <Advances {...{ projectId, vendors, vendorName, pos, rows: advances, userId, canManage, canDelete }} />}
    </div>
  )
}

const PO_EMPTY = { po_number: '', vendor_id: '', department: '', description: '', order_amount: '', status: 'draft', expected_delivery_date: '' }

function Pos({ projectId, vendors, vendorName, rows, userId, canManage, canDelete }: { projectId: string; vendors: VendorOpt[]; vendorName: (id: string | null) => string; rows: PO[]; userId: string; canManage: boolean; canDelete: boolean }) {
  const router = useRouter(); const toast = useToast()
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<PO | null>(null); const [form, setForm] = useState(PO_EMPTY)

  function openNew() { setEditing(null); setForm(PO_EMPTY); setOpen(true) }
  function openEdit(r: PO) { setEditing(r); setForm({ po_number: r.po_number ?? '', vendor_id: r.vendor_id ?? '', department: r.department ?? '', description: r.description ?? '', order_amount: r.order_amount?.toString() ?? '', status: r.status, expected_delivery_date: r.expected_delivery_date ?? '' }); setOpen(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, po_number: form.po_number || null, vendor_id: form.vendor_id || null,
      department: form.department || null, description: form.description || null,
      order_amount: form.order_amount ? Number(form.order_amount) : 0, status: form.status,
      expected_delivery_date: form.expected_delivery_date || null,
    }
    if (editing) {
      const { error } = await supabase.from('purchase_orders').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'purchase_orders', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('purchase_orders').insert({ ...payload, raised_by: userId, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'purchase_orders', data.id, undefined, payload)
    }
    toast.success(editing ? 'PO updated' : 'PO created'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: PO) {
    if (!window.confirm('Delete this PO?')) return
    const supabase = createClient()
    const { error } = await supabase.from('purchase_orders').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'purchase_orders', r.id); toast.success('Deleted'); router.refresh()
  }

  return (
    <div>
      {canManage && <div className="flex justify-end mb-3"><Button size="sm" icon={Plus} onClick={openNew}>New PO</Button></div>}
      {rows.length === 0 ? (
        <div className="text-center text-sm text-[#8888aa] bg-[#1a1a24] border border-dashed border-[#2a2a3a] rounded-lg py-8 px-4">No purchase orders yet. Raise one to track an order from raised → delivered.</div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm text-white font-medium flex items-center gap-2 flex-wrap">
                  {r.po_number && <span className="text-[#8888aa]">{r.po_number}</span>} {vendorName(r.vendor_id)} {badge(r.status)}
                </div>
                <div className="text-xs text-[#8888aa] mt-0.5">{[r.department, r.description].filter(Boolean).join(' · ') || '—'}{r.expected_delivery_date ? ` · due ${formatDate(r.expected_delivery_date)}` : ''}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(Number(r.order_amount || 0))}</span>
                {canManage && <button onClick={() => openEdit(r)} className="text-[#8888aa] hover:text-white"><Pencil size={14} /></button>}
                {canDelete && <button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit PO' : 'New Purchase Order'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="PO number" value={form.po_number} onChange={e => setForm({ ...form, po_number: e.target.value })} />
            <Select label="Vendor" value={form.vendor_id} onChange={e => setForm({ ...form, vendor_id: e.target.value })} options={[{ value: '', label: '— Select —' }, ...vendors.map(v => ({ value: v.id, label: v.name }))]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="Art / Costume…" />
            <MoneyInput label="Order amount (₹)" value={form.order_amount} onChange={v => setForm({ ...form, order_amount: v })} />
          </div>
          <Textarea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={PO_STATUS.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
            <Input label="Expected delivery" type="date" value={form.expected_delivery_date} onChange={e => setForm({ ...form, expected_delivery_date: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

const ADV_EMPTY = { vendor_id: '', purchase_order_id: '', amount: '', paid_date: new Date().toISOString().slice(0, 10), expected_delivery_date: '', status: 'advance_paid', notes: '' }

function Advances({ projectId, vendors, vendorName, pos, rows, userId, canManage, canDelete }: { projectId: string; vendors: VendorOpt[]; vendorName: (id: string | null) => string; pos: PO[]; rows: Advance[]; userId: string; canManage: boolean; canDelete: boolean }) {
  const router = useRouter(); const toast = useToast()
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Advance | null>(null); const [form, setForm] = useState(ADV_EMPTY)

  function openNew() { setEditing(null); setForm(ADV_EMPTY); setOpen(true) }
  function openEdit(r: Advance) { setEditing(r); setForm({ vendor_id: r.vendor_id ?? '', purchase_order_id: r.purchase_order_id ?? '', amount: r.amount?.toString() ?? '', paid_date: r.paid_date ?? '', expected_delivery_date: r.expected_delivery_date ?? '', status: r.status, notes: r.notes ?? '' }); setOpen(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, vendor_id: form.vendor_id || null, purchase_order_id: form.purchase_order_id || null,
      amount: form.amount ? Number(form.amount) : 0, paid_date: form.paid_date || null,
      expected_delivery_date: form.expected_delivery_date || null, status: form.status, notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('vendor_advances').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'vendor_advances', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('vendor_advances').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'vendor_advances', data.id, undefined, payload)
    }
    toast.success(editing ? 'Advance updated' : 'Advance recorded'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: Advance) {
    if (!window.confirm('Delete this advance?')) return
    const supabase = createClient()
    const { error } = await supabase.from('vendor_advances').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'vendor_advances', r.id); toast.success('Deleted'); router.refresh()
  }

  return (
    <div>
      {canManage && <div className="flex justify-end mb-3"><Button size="sm" icon={Plus} onClick={openNew}>Record advance</Button></div>}
      {rows.length === 0 ? (
        <div className="text-center text-sm text-[#8888aa] bg-[#1a1a24] border border-dashed border-[#2a2a3a] rounded-lg py-8 px-4">No advances yet. Record money paid to vendors before delivery — "money in the field".</div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm text-white font-medium flex items-center gap-2 flex-wrap">
                  {vendorName(r.vendor_id)} {badge(r.status)}
                  {r.payment_request_id && <span className="text-[10px] text-emerald-400 inline-flex items-center gap-0.5"><CheckCircle2 size={11} /> settled</span>}
                </div>
                <div className="text-xs text-[#8888aa] mt-0.5">{[r.paid_date ? `paid ${formatDate(r.paid_date)}` : null, r.expected_delivery_date ? `delivery ${formatDate(r.expected_delivery_date)}` : null, r.notes].filter(Boolean).join(' · ') || '—'}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(Number(r.amount || 0))}</span>
                {canManage && <button onClick={() => openEdit(r)} className="text-[#8888aa] hover:text-white"><Pencil size={14} /></button>}
                {canDelete && <button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Advance' : 'Record Vendor Advance'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Vendor" value={form.vendor_id} onChange={e => setForm({ ...form, vendor_id: e.target.value })} options={[{ value: '', label: '— Select —' }, ...vendors.map(v => ({ value: v.id, label: v.name }))]} />
            <MoneyInput label="Advance amount (₹)" value={form.amount} onChange={v => setForm({ ...form, amount: v })} />
          </div>
          <Select label="Against PO (optional)" value={form.purchase_order_id} onChange={e => setForm({ ...form, purchase_order_id: e.target.value })}
            options={[{ value: '', label: '— None —' }, ...pos.map(p => ({ value: p.id, label: `${p.po_number || 'PO'} · ${vendorName(p.vendor_id)}` }))]} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Paid date" type="date" value={form.paid_date} onChange={e => setForm({ ...form, paid_date: e.target.value })} />
            <Input label="Expected delivery" type="date" value={form.expected_delivery_date} onChange={e => setForm({ ...form, expected_delivery_date: e.target.value })} />
          </div>
          <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={ADV_STATUS.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Record'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
