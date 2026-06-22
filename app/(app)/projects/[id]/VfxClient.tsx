'use client'

import { useMemo, useState } from 'react'
import { Clapperboard, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface VfxShot {
  id: string; shot_code: string; scene: string | null; description: string | null; vendor: string | null
  complexity: string; shoot_date: string | null; status: string; revisions: number
  ref_hdri: boolean; ref_clean_plate: boolean; ref_chrome_grey_ball: boolean
  ref_tracking_markers: boolean; ref_set_measurements: boolean; ref_witness_camera: boolean
  notes: string | null
}

const STATUSES = ['planned', 'reference_captured', 'data_handover', 'in_progress', 'first_pass', 'revision', 'approved', 'rejected']
const statusCls: Record<string, string> = {
  planned: 'bg-white/5 text-[#8888aa] border-[#2a2a3a]', reference_captured: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  data_handover: 'bg-sky-500/15 text-sky-400 border-sky-500/30', in_progress: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  first_pass: 'bg-amber-500/15 text-amber-400 border-amber-500/30', revision: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  approved: 'bg-green-500/15 text-green-400 border-green-500/30', rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
}
const REF_FIELDS = [
  ['ref_hdri', 'HDRI'], ['ref_clean_plate', 'Clean plate'], ['ref_chrome_grey_ball', 'Chrome/grey ball'],
  ['ref_tracking_markers', 'Tracking markers'], ['ref_set_measurements', 'Set measurements'], ['ref_witness_camera', 'Witness camera'],
] as const

const EMPTY = { shot_code: '', scene: '', description: '', vendor: '', complexity: 'medium', shoot_date: '', status: 'planned', revisions: '0', ref_hdri: false, ref_clean_plate: false, ref_chrome_grey_ball: false, ref_tracking_markers: false, ref_set_measurements: false, ref_witness_camera: false, notes: '' }

function refCount(s: VfxShot) { return REF_FIELDS.filter(([k]) => s[k as keyof VfxShot]).length }

interface Props { projectId: string; rows: VfxShot[]; userId: string; canManage: boolean; canDelete: boolean }

export function VfxClient({ projectId, rows, userId, canManage, canDelete }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<VfxShot | null>(null)
  const [form, setForm] = useState(EMPTY)

  const stats = useMemo(() => ({
    total: rows.length,
    approved: rows.filter(r => r.status === 'approved').length,
    inProgress: rows.filter(r => ['in_progress', 'first_pass', 'revision', 'data_handover'].includes(r.status)).length,
    refIncomplete: rows.filter(r => refCount(r) < REF_FIELDS.length).length,
  }), [rows])

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(r: VfxShot) {
    setEditing(r)
    setForm({ shot_code: r.shot_code, scene: r.scene ?? '', description: r.description ?? '', vendor: r.vendor ?? '', complexity: r.complexity, shoot_date: r.shoot_date ?? '', status: r.status, revisions: r.revisions?.toString() ?? '0', ref_hdri: r.ref_hdri, ref_clean_plate: r.ref_clean_plate, ref_chrome_grey_ball: r.ref_chrome_grey_ball, ref_tracking_markers: r.ref_tracking_markers, ref_set_measurements: r.ref_set_measurements, ref_witness_camera: r.ref_witness_camera, notes: r.notes ?? '' })
    setOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.shot_code.trim()) return toast.error('Shot code is required')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, shot_code: form.shot_code.trim(), scene: form.scene || null, description: form.description || null,
      vendor: form.vendor || null, complexity: form.complexity, shoot_date: form.shoot_date || null, status: form.status,
      revisions: parseInt(form.revisions) || 0,
      ref_hdri: form.ref_hdri, ref_clean_plate: form.ref_clean_plate, ref_chrome_grey_ball: form.ref_chrome_grey_ball,
      ref_tracking_markers: form.ref_tracking_markers, ref_set_measurements: form.ref_set_measurements, ref_witness_camera: form.ref_witness_camera,
      notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('vfx_shots').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'vfx_shots', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('vfx_shots').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'vfx_shots', data.id, undefined, payload)
    }
    toast.success(editing ? 'Shot updated' : 'Shot added'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: VfxShot) {
    if (!window.confirm(`Delete shot ${r.shot_code}?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('vfx_shots').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'vfx_shots', r.id); toast.success('Deleted'); router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2"><Clapperboard size={16} className="text-white/70" /><h3 className="text-sm font-semibold text-white">VFX Shots</h3></div>
        {canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add shot</Button>}
      </div>

      <div className="px-5 py-4 border-b border-[#2a2a3a] grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total shots" value={String(stats.total)} />
        <Stat label="Approved" value={String(stats.approved)} tone="green" />
        <Stat label="In progress" value={String(stats.inProgress)} tone="amber" />
        <Stat label="Ref incomplete" value={String(stats.refIncomplete)} tone={stats.refIncomplete ? 'amber' : 'green'} />
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No VFX shots yet. Add each shot to track it from on-set reference capture to final approval.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {rows.map(r => {
            const rc = refCount(r)
            return (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{r.shot_code}</span>
                    {r.scene && <span className="text-[11px] text-[#8888aa]">sc {r.scene}</span>}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusCls[r.status]}`}>{r.status.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] uppercase tracking-wide text-[#8888aa]">{r.complexity}</span>
                    {r.revisions > 0 && <span className="text-[10px] text-amber-400">rev {r.revisions}</span>}
                  </div>
                  <div className="text-[11px] text-[#8888aa] mt-0.5">
                    {[r.vendor, r.shoot_date ? formatDate(r.shoot_date) : null].filter(Boolean).join(' · ')}
                    <span className={`ml-1 ${rc === REF_FIELDS.length ? 'text-emerald-400' : 'text-amber-400'}`}>· ref {rc}/{REF_FIELDS.length}</span>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit VFX Shot' : 'Add VFX Shot'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Shot code" value={form.shot_code} onChange={e => setForm({ ...form, shot_code: e.target.value })} placeholder="VFX_001" />
            <Input label="Scene" value={form.scene} onChange={e => setForm({ ...form, scene: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Vendor (VFX house)" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
            <Select label="Complexity" value={form.complexity} onChange={e => setForm({ ...form, complexity: e.target.value })} options={['low', 'medium', 'high'].map(v => ({ value: v, label: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Shoot date" type="date" value={form.shoot_date} onChange={e => setForm({ ...form, shoot_date: e.target.value })} />
            <Input label="Revisions" type="number" value={form.revisions} onChange={e => setForm({ ...form, revisions: e.target.value })} />
          </div>
          <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          <div className="rounded-lg border border-[#2a2a3a] p-3 space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-[#8888aa]">On-set reference checklist</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {REF_FIELDS.map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm text-[#c8c8da]"><input type="checkbox" checked={form[k] as boolean} onChange={e => setForm({ ...form, [k]: e.target.checked })} /> {label}</label>
              ))}
            </div>
          </div>
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

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'green' | 'amber' }) {
  const c = tone === 'green' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : 'text-white'
  return (
    <div className="bg-[#1a1a24] rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wide text-[#8888aa]">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${c}`}>{value}</div>
    </div>
  )
}
