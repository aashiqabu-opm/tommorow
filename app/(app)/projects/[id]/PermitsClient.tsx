'use client'

import { useMemo, useState } from 'react'
import { Stamp, Plus, Pencil, Trash2, ShieldAlert } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface Permit {
  id: string; permit_type: string; authority: string | null; description: string | null
  status: string; reference_no: string | null; applied_date: string | null; approved_date: string | null
  valid_from: string | null; valid_to: string | null; is_legal_gate: boolean; notes: string | null
}

const TYPES = ['ksfdc', 'forest', 'police', 'fire', 'awbi', 'traffic', 'municipal', 'heritage', 'dgca_drone', 'railway', 'other']
const TYPE_LABEL: Record<string, string> = {
  ksfdc: 'KSFDC', forest: 'Forest Dept', police: 'Police', fire: 'Fire Safety', awbi: 'AWBI (Animals)',
  traffic: 'Traffic', municipal: 'Municipal', heritage: 'Heritage / ASI', dgca_drone: 'DGCA (Drone)', railway: 'Railway', other: 'Other',
}
const STATUSES = ['not_applied', 'applied', 'pending', 'approved', 'rejected', 'expired']
const statusCls: Record<string, string> = {
  not_applied: 'bg-white/5 text-[#8888aa] border-[#2a2a3a]', applied: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30', approved: 'bg-green-500/15 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30', expired: 'bg-red-500/15 text-red-400 border-red-500/30',
}
const TODAY = new Date().toISOString().slice(0, 10)
const EMPTY = { permit_type: 'ksfdc', authority: '', description: '', status: 'not_applied', reference_no: '', applied_date: '', approved_date: '', valid_from: '', valid_to: '', is_legal_gate: false, notes: '' }

interface Props { projectId: string; rows: Permit[]; userId: string; canManage: boolean; canDelete: boolean }

export function PermitsClient({ projectId, rows, userId, canManage, canDelete }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Permit | null>(null)
  const [form, setForm] = useState(EMPTY)

  const stats = useMemo(() => {
    const approved = rows.filter(r => r.status === 'approved').length
    const pending = rows.filter(r => !['approved', 'rejected'].includes(r.status)).length
    const gatesBlocked = rows.filter(r => r.is_legal_gate && r.status !== 'approved').length
    return { total: rows.length, approved, pending, gatesBlocked }
  }, [rows])

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(r: Permit) {
    setEditing(r)
    setForm({ permit_type: r.permit_type, authority: r.authority ?? '', description: r.description ?? '', status: r.status, reference_no: r.reference_no ?? '', applied_date: r.applied_date ?? '', approved_date: r.approved_date ?? '', valid_from: r.valid_from ?? '', valid_to: r.valid_to ?? '', is_legal_gate: r.is_legal_gate, notes: r.notes ?? '' })
    setOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, permit_type: form.permit_type, authority: form.authority || null,
      description: form.description || null, status: form.status, reference_no: form.reference_no || null,
      applied_date: form.applied_date || null, approved_date: form.approved_date || null,
      valid_from: form.valid_from || null, valid_to: form.valid_to || null, is_legal_gate: form.is_legal_gate, notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('permits').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'permits', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('permits').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'permits', data.id, undefined, payload)
    }
    toast.success(editing ? 'Permit updated' : 'Permit added'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: Permit) {
    if (!window.confirm(`Delete this ${TYPE_LABEL[r.permit_type]} permit?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('permits').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'permits', r.id); toast.success('Deleted'); router.refresh()
  }

  const expiringSoon = (r: Permit) => r.valid_to && r.valid_to >= TODAY && r.valid_to <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2"><Stamp size={16} className="text-white/70" /><h3 className="text-sm font-semibold text-white">Permit Tracker</h3></div>
        {canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add permit</Button>}
      </div>

      <div className="px-5 py-4 border-b border-[#2a2a3a] grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total" value={String(stats.total)} />
        <Stat label="Approved" value={String(stats.approved)} tone="green" />
        <Stat label="Pending" value={String(stats.pending)} tone={stats.pending ? 'amber' : 'default'} />
        <Stat label="Legal gates open" value={String(stats.gatesBlocked)} tone={stats.gatesBlocked ? 'red' : 'green'} />
      </div>
      {stats.gatesBlocked > 0 && (
        <div className="px-5 py-2.5 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 text-xs text-red-400">
          <ShieldAlert size={14} /> {stats.gatesBlocked} legal-gate permit{stats.gatesBlocked > 1 ? 's' : ''} not yet approved — shoot days needing {stats.gatesBlocked > 1 ? 'them' : 'it'} are blocked.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No permits yet. Track each application from not-applied → approved.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {rows.map(r => (
            <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">{TYPE_LABEL[r.permit_type]}</span>
                  {r.is_legal_gate && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 inline-flex items-center gap-0.5"><ShieldAlert size={10} /> gate</span>}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusCls[r.status]}`}>{r.status.replace(/_/g, ' ')}</span>
                  {expiringSoon(r) && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">expiring</span>}
                </div>
                <div className="text-[11px] text-[#8888aa] mt-0.5">{[r.authority, r.reference_no, r.description].filter(Boolean).join(' · ') || '—'}{r.valid_to ? ` · valid to ${formatDate(r.valid_to)}` : ''}</div>
              </div>
              {canManage && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(r)} className="p-1.5 text-[#8888aa] hover:text-white"><Pencil size={14} /></button>
                  {canDelete && <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Permit' : 'Add Permit'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={form.permit_type} onChange={e => setForm({ ...form, permit_type: e.target.value })} options={TYPES.map(t => ({ value: t, label: TYPE_LABEL[t] }))} />
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Authority" value={form.authority} onChange={e => setForm({ ...form, authority: e.target.value })} placeholder="Issuing office" />
            <Input label="Reference no." value={form.reference_no} onChange={e => setForm({ ...form, reference_no: e.target.value })} />
          </div>
          <Textarea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Location / scene / purpose" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Applied date" type="date" value={form.applied_date} onChange={e => setForm({ ...form, applied_date: e.target.value })} />
            <Input label="Approved date" type="date" value={form.approved_date} onChange={e => setForm({ ...form, approved_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valid from" type="date" value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} />
            <Input label="Valid to" type="date" value={form.valid_to} onChange={e => setForm({ ...form, valid_to: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#c8c8da]">
            <input type="checkbox" checked={form.is_legal_gate} onChange={e => setForm({ ...form, is_legal_gate: e.target.checked })} />
            Legal gate — shoot is blocked until this is approved (e.g. AWBI)
          </label>
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

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'green' | 'amber' | 'red' }) {
  const c = tone === 'green' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : tone === 'red' ? 'text-red-300' : 'text-white'
  return (
    <div className="bg-[#1a1a24] rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wide text-[#8888aa]">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${c}`}>{value}</div>
    </div>
  )
}
