'use client'

import { useState } from 'react'
import { KeyRound, Plus, Trash2, Pencil, Check } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface KdmRow {
  id: string
  theatre_name: string
  theatre_location: string | null
  territory: string | null
  dcp_delivered: boolean
  dcp_delivered_date: string | null
  kdm_issued: boolean
  kdm_issued_date: string | null
  valid_from: string | null
  valid_to: string | null
  status: string
  notes: string | null
}

const TODAY = new Date().toISOString().slice(0, 10)
const IN7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
// Display badge derived from validity window (the cron persists status; this keeps the UI live)
function validity(r: KdmRow): { cls: string; label: string } {
  if (!r.valid_to) return { cls: 'bg-white/5 text-[#8888aa] border-[#2a2a3a]', label: r.status.replace(/_/g, ' ') }
  if (r.valid_to < TODAY) return { cls: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Expired' }
  if (r.valid_to <= IN7) return { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: 'Expiring' }
  return { cls: 'bg-green-500/15 text-green-400 border-green-500/30', label: 'Active' }
}

const EMPTY = {
  theatre_name: '', theatre_location: '', territory: '', dcp_delivered: false, dcp_delivered_date: '',
  kdm_issued: false, kdm_issued_date: '', valid_from: '', valid_to: '', status: 'pending', notes: '',
}

interface Props { projectId: string; rows: KdmRow[]; userId: string; canManage: boolean; canDelete: boolean }

export function KdmClient({ projectId, rows, userId, canManage, canDelete }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<KdmRow | null>(null)
  const [form, setForm] = useState(EMPTY)

  const sorted = [...rows].sort((a, b) => (a.valid_to ?? '9999').localeCompare(b.valid_to ?? '9999'))
  const expiring = rows.filter(r => r.valid_to && r.valid_to <= IN7).length

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(r: KdmRow) {
    setEditing(r)
    setForm({
      theatre_name: r.theatre_name, theatre_location: r.theatre_location ?? '', territory: r.territory ?? '',
      dcp_delivered: r.dcp_delivered, dcp_delivered_date: r.dcp_delivered_date ?? '',
      kdm_issued: r.kdm_issued, kdm_issued_date: r.kdm_issued_date ?? '',
      valid_from: r.valid_from ?? '', valid_to: r.valid_to ?? '', status: r.status, notes: r.notes ?? '',
    })
    setOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.theatre_name.trim()) return toast.error('Theatre name is required')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, theatre_name: form.theatre_name.trim(),
      theatre_location: form.theatre_location || null, territory: form.territory || null,
      dcp_delivered: form.dcp_delivered, dcp_delivered_date: form.dcp_delivered_date || null,
      kdm_issued: form.kdm_issued, kdm_issued_date: form.kdm_issued_date || null,
      valid_from: form.valid_from || null, valid_to: form.valid_to || null,
      status: form.status, notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('kdm').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'kdm', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('kdm').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'kdm', data.id, undefined, payload)
    }
    toast.success(editing ? 'KDM updated' : 'Theatre added')
    setSaving(false); setOpen(false); router.refresh()
  }

  async function remove(r: KdmRow) {
    if (!window.confirm(`Delete ${r.theatre_name}?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('kdm').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'kdm', r.id)
    toast.success('Deleted'); router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-white/70" />
          <h3 className="text-sm font-semibold text-white">KDM &amp; DCP Delivery</h3>
          {expiring > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">{expiring} expiring ≤7d</span>}
        </div>
        {canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add theatre</Button>}
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No theatres yet. Add one to track DCP + KDM delivery.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {sorted.map(r => {
            const v = validity(r)
            return (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white truncate">{r.theatre_name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${v.cls}`}>{v.label}</span>
                  </div>
                  <div className="text-[11px] text-[#8888aa] mt-0.5">
                    {[r.theatre_location, r.territory].filter(Boolean).join(' · ')}
                    {r.valid_to && <span className="text-[#5a5a7a]"> · valid to {formatDate(r.valid_to)}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px]">
                    <span className={r.dcp_delivered ? 'text-emerald-400' : 'text-[#5a5a7a]'}>{r.dcp_delivered ? <Check size={10} className="inline" /> : '○'} DCP</span>
                    <span className={r.kdm_issued ? 'text-emerald-400' : 'text-[#5a5a7a]'}>{r.kdm_issued ? <Check size={10} className="inline" /> : '○'} KDM</span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(r)} className="p-1.5 text-[#8888aa] hover:text-white"><Pencil size={14} /></button>
                    {canDelete && <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Theatre KDM' : 'Add Theatre'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <Input label="Theatre name" value={form.theatre_name} onChange={e => setForm({ ...form, theatre_name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Location" value={form.theatre_location} onChange={e => setForm({ ...form, theatre_location: e.target.value })} />
            <Input label="Territory" value={form.territory} onChange={e => setForm({ ...form, territory: e.target.value })} placeholder="Kerala / TN" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-[#c8c8da]"><input type="checkbox" checked={form.dcp_delivered} onChange={e => setForm({ ...form, dcp_delivered: e.target.checked })} /> DCP delivered</label>
            <Input label="DCP date" type="date" value={form.dcp_delivered_date} onChange={e => setForm({ ...form, dcp_delivered_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm text-[#c8c8da]"><input type="checkbox" checked={form.kdm_issued} onChange={e => setForm({ ...form, kdm_issued: e.target.checked })} /> KDM issued</label>
            <Input label="KDM date" type="date" value={form.kdm_issued_date} onChange={e => setForm({ ...form, kdm_issued_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valid from" type="date" value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} />
            <Input label="Valid to" type="date" value={form.valid_to} onChange={e => setForm({ ...form, valid_to: e.target.value })} />
          </div>
          <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
            options={['pending', 'dcp_delivered', 'active', 'expiring', 'expired', 'reissue_needed'].map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
