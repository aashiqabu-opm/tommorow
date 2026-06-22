'use client'

import { useMemo, useState } from 'react'
import { Hammer, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface ArtSet {
  id: string; set_name: string; build_location: string | null; status: string
  assigned_to: string | null; start_date: string | null; deadline: string | null; notes: string | null
}

// Build pipeline in order. 'struck' = dismantled after the shoot (end of life).
const STAGES = ['design', 'materials_sourced', 'under_construction', 'set_dressing', 'ready', 'struck'] as const
const STAGE_LABEL: Record<string, string> = {
  design: 'Design', materials_sourced: 'Materials sourced', under_construction: 'Under construction',
  set_dressing: 'Set dressing', ready: 'Ready', struck: 'Struck',
}
const TODAY = new Date().toISOString().slice(0, 10)
const EMPTY = { set_name: '', build_location: '', status: 'design', assigned_to: '', start_date: '', deadline: '', notes: '' }

interface Props { projectId: string; rows: ArtSet[]; shootStart: string | null; userId: string; canManage: boolean; canDelete: boolean }

export function ArtSetsClient({ projectId, rows, shootStart, userId, canManage, canDelete }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<ArtSet | null>(null)
  const [form, setForm] = useState(EMPTY)

  const stats = useMemo(() => {
    const total = rows.length
    const done = rows.filter(r => r.status === 'ready' || r.status === 'struck').length
    const pending = rows.filter(r => r.status !== 'ready' && r.status !== 'struck').length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, done, pending, pct }
  }, [rows])

  const daysToShoot = shootStart && shootStart >= TODAY ? Math.ceil((new Date(shootStart).getTime() - Date.now()) / 86400000) : null

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(r: ArtSet) {
    setEditing(r)
    setForm({ set_name: r.set_name, build_location: r.build_location ?? '', status: r.status, assigned_to: r.assigned_to ?? '', start_date: r.start_date ?? '', deadline: r.deadline ?? '', notes: r.notes ?? '' })
    setOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.set_name.trim()) return toast.error('Set name is required')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, set_name: form.set_name.trim(), build_location: form.build_location || null,
      status: form.status, assigned_to: form.assigned_to || null, start_date: form.start_date || null,
      deadline: form.deadline || null, notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('art_sets').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'art_sets', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('art_sets').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'art_sets', data.id, undefined, payload)
    }
    toast.success(editing ? 'Set updated' : 'Set added'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: ArtSet) {
    if (!window.confirm(`Delete "${r.set_name}"?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('art_sets').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'art_sets', r.id); toast.success('Deleted'); router.refresh()
  }

  const overdue = (r: ArtSet) => r.status !== 'ready' && r.status !== 'struck' && r.deadline && r.deadline < TODAY

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2"><Hammer size={16} className="text-white/70" /><h3 className="text-sm font-semibold text-white">Art Dept — Set Construction</h3></div>
        {canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add set</Button>}
      </div>

      <div className="px-5 py-4 border-b border-[#2a2a3a]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Total sets" value={String(stats.total)} />
          <Stat label="Ready / struck" value={String(stats.done)} tone="green" />
          <Stat label="In progress" value={String(stats.pending)} tone={stats.pending ? 'amber' : 'default'} />
          <Stat label="% Ready" value={`${stats.pct}%`} tone={stats.pct === 100 ? 'green' : 'default'} />
        </div>
        <div className="mt-3 h-2 rounded-full bg-[#1a1a24] overflow-hidden"><div className="h-full bg-emerald-500/70" style={{ width: `${stats.pct}%` }} /></div>
        {daysToShoot != null && stats.pending > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400"><AlertTriangle size={13} /> {stats.pending} set{stats.pending > 1 ? 's' : ''} not ready · {daysToShoot} day{daysToShoot !== 1 ? 's' : ''} to shoot Day 1</div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No sets yet. Add each set to track it from design → ready.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {rows.map(r => {
            const idx = STAGES.indexOf(r.status as typeof STAGES[number])
            const pct = Math.round(((idx + 1) / STAGES.length) * 100)
            const done = r.status === 'ready' || r.status === 'struck'
            return (
              <div key={r.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{r.set_name}</span>
                      {r.build_location && <span className="text-xs text-[#8888aa]">· {r.build_location}</span>}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${done ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-white/5 text-[#8888aa] border-[#2a2a3a]'}`}>{STAGE_LABEL[r.status]}</span>
                      {overdue(r) && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">overdue</span>}
                    </div>
                    <div className="text-[11px] text-[#8888aa] mt-0.5">{[r.assigned_to, r.deadline ? `due ${formatDate(r.deadline)}` : null].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(r)} className="p-1.5 text-[#8888aa] hover:text-white"><Pencil size={14} /></button>
                      {canDelete && <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>}
                    </div>
                  )}
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[#1a1a24] overflow-hidden"><div className={`h-full ${done ? 'bg-emerald-500/70' : 'bg-white/30'}`} style={{ width: `${pct}%` }} /></div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Set' : 'Add Set'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <Input label="Set name" value={form.set_name} onChange={e => setForm({ ...form, set_name: e.target.value })} placeholder="e.g. Ayyankali's village" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Build location" value={form.build_location} onChange={e => setForm({ ...form, build_location: e.target.value })} placeholder="Studio / on-location" />
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STAGES.map(s => ({ value: s, label: STAGE_LABEL[s] }))} />
          </div>
          <Input label="Assigned to" value={form.assigned_to} onChange={e => setForm({ ...form, assigned_to: e.target.value })} placeholder="Art director / contractor" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start date" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            <Input label="Deadline" type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
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
