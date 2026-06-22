'use client'

import { useMemo, useState } from 'react'
import { Shirt, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface CostumeLook {
  id: string; character: string | null; look_name: string; look_number: number | null
  costume_type: string; status: string; tailor_name: string | null
  fitting_date: string | null; deadline: string | null; notes: string | null
}

// 8-stage pipeline, in order. The last stage = ready.
const STAGES = ['research', 'design', 'fabric_sourced', 'in_fabrication', 'fitting_scheduled', 'fitting_done', 'alterations', 'ready'] as const
const STAGE_LABEL: Record<string, string> = {
  research: 'Research', design: 'Design', fabric_sourced: 'Fabric sourced', in_fabrication: 'In fabrication',
  fitting_scheduled: 'Fitting scheduled', fitting_done: 'Fitting done', alterations: 'Alterations', ready: 'Ready',
}
const TYPES = ['custom_fabrication', 'purchase', 'rental']
const TYPE_LABEL: Record<string, string> = { custom_fabrication: 'Custom', purchase: 'Purchase', rental: 'Rental' }

const TODAY = new Date().toISOString().slice(0, 10)
const EMPTY = { character: '', look_name: '', look_number: '', costume_type: 'custom_fabrication', status: 'research', tailor_name: '', fitting_date: '', deadline: '', notes: '' }

interface Props {
  projectId: string; rows: CostumeLook[]; shootStart: string | null
  userId: string; canManage: boolean; canDelete: boolean
}

export function CostumeClient({ projectId, rows, shootStart, userId, canManage, canDelete }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<CostumeLook | null>(null)
  const [form, setForm] = useState(EMPTY)

  const stats = useMemo(() => {
    const total = rows.length
    const ready = rows.filter(r => r.status === 'ready').length
    const notStarted = rows.filter(r => r.status === 'research').length
    const pct = total > 0 ? Math.round((ready / total) * 100) : 0
    return { total, ready, notStarted, pct, pending: total - ready }
  }, [rows])

  const daysToShoot = shootStart && shootStart >= TODAY
    ? Math.ceil((new Date(shootStart).getTime() - Date.now()) / 86400000)
    : null

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(r: CostumeLook) {
    setEditing(r)
    setForm({ character: r.character ?? '', look_name: r.look_name, look_number: r.look_number?.toString() ?? '', costume_type: r.costume_type, status: r.status, tailor_name: r.tailor_name ?? '', fitting_date: r.fitting_date ?? '', deadline: r.deadline ?? '', notes: r.notes ?? '' })
    setOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.look_name.trim()) return toast.error('Look name is required')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, character: form.character || null, look_name: form.look_name.trim(),
      look_number: form.look_number ? parseInt(form.look_number) : null, costume_type: form.costume_type,
      status: form.status, tailor_name: form.tailor_name || null, fitting_date: form.fitting_date || null,
      deadline: form.deadline || null, notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('costume_looks').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'costume_looks', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('costume_looks').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'costume_looks', data.id, undefined, payload)
    }
    toast.success(editing ? 'Look updated' : 'Look added'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: CostumeLook) {
    if (!window.confirm(`Delete "${r.look_name}"?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('costume_looks').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'costume_looks', r.id); toast.success('Deleted'); router.refresh()
  }

  const overdue = (r: CostumeLook) => r.status !== 'ready' && r.deadline && r.deadline < TODAY

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2"><Shirt size={16} className="text-white/70" /><h3 className="text-sm font-semibold text-white">Costume Readiness</h3></div>
        {canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add look</Button>}
      </div>

      {/* Readiness summary + days-to-shoot alert */}
      <div className="px-5 py-4 border-b border-[#2a2a3a]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Total looks" value={String(stats.total)} />
          <Stat label="Ready" value={`${stats.ready}`} tone="green" />
          <Stat label="Pending" value={`${stats.pending}`} tone={stats.pending ? 'amber' : 'default'} />
          <Stat label="% Ready" value={`${stats.pct}%`} tone={stats.pct === 100 ? 'green' : 'default'} />
        </div>
        <div className="mt-3 h-2 rounded-full bg-[#1a1a24] overflow-hidden">
          <div className="h-full bg-emerald-500/70" style={{ width: `${stats.pct}%` }} />
        </div>
        {daysToShoot != null && stats.pending > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400">
            <AlertTriangle size={13} /> {stats.pending} look{stats.pending > 1 ? 's' : ''} not ready · {daysToShoot} day{daysToShoot !== 1 ? 's' : ''} to shoot Day 1
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No looks yet. Add each character look to track it through research → ready.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {[...rows].sort((a, b) => (a.look_number ?? 999) - (b.look_number ?? 999)).map(r => {
            const stageIdx = STAGES.indexOf(r.status as typeof STAGES[number])
            const pct = Math.round(((stageIdx + 1) / STAGES.length) * 100)
            return (
              <div key={r.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{r.look_name}</span>
                      {r.character && <span className="text-xs text-[#8888aa]">· {r.character}</span>}
                      <span className="text-[10px] uppercase tracking-wide text-[#8888aa]">{TYPE_LABEL[r.costume_type]}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${r.status === 'ready' ? 'bg-green-500/15 text-green-400 border-green-500/30' : 'bg-white/5 text-[#8888aa] border-[#2a2a3a]'}`}>{STAGE_LABEL[r.status]}</span>
                      {overdue(r) && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">overdue</span>}
                    </div>
                    <div className="text-[11px] text-[#8888aa] mt-0.5">{[r.tailor_name, r.fitting_date ? `fitting ${formatDate(r.fitting_date)}` : null, r.deadline ? `due ${formatDate(r.deadline)}` : null].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(r)} className="p-1.5 text-[#8888aa] hover:text-white"><Pencil size={14} /></button>
                      {canDelete && <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>}
                    </div>
                  )}
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[#1a1a24] overflow-hidden"><div className={`h-full ${r.status === 'ready' ? 'bg-emerald-500/70' : 'bg-white/30'}`} style={{ width: `${pct}%` }} /></div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Look' : 'Add Costume Look'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Character" value={form.character} onChange={e => setForm({ ...form, character: e.target.value })} />
            <Input label="Look #" type="number" value={form.look_number} onChange={e => setForm({ ...form, look_number: e.target.value })} />
          </div>
          <Input label="Look name" value={form.look_name} onChange={e => setForm({ ...form, look_name: e.target.value })} placeholder="e.g. Court scene" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={form.costume_type} onChange={e => setForm({ ...form, costume_type: e.target.value })} options={TYPES.map(t => ({ value: t, label: TYPE_LABEL[t] }))} />
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STAGES.map(s => ({ value: s, label: STAGE_LABEL[s] }))} />
          </div>
          <Input label="Tailor / fabricator" value={form.tailor_name} onChange={e => setForm({ ...form, tailor_name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fitting date" type="date" value={form.fitting_date} onChange={e => setForm({ ...form, fitting_date: e.target.value })} />
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
