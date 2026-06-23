'use client'

import { useMemo, useState } from 'react'
import { Swords, PawPrint, Music, Wrench, Plus, Pencil, Trash2, ShieldCheck, ShieldAlert, Check, X } from 'lucide-react'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { formatCurrency } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface Stunt {
  id: string; name: string; scenes: string | null; shoot_date: string | null; coordinator: string | null
  performers_count: number | null; risk_level: string; description: string | null
  medical_standby: boolean; safety_equipment_ok: boolean; risk_assessment_signed: boolean; insurance_rider_active: boolean
  status: string; notes: string | null
}
export interface Animal {
  id: string; name: string; scenes: string | null; shoot_date: string | null; animals: string | null; handler: string | null; description: string | null
  awbi_permission: boolean; vet_standby: boolean; welfare_officer_required: boolean; welfare_officer_present: boolean
  status: string; notes: string | null
}

export interface Song {
  id: string; name: string; choreographer: string | null; dancers_count: number | null
  rehearsal_days: number | null; shoot_days: number | null; location: string | null
  shoot_date: string | null; status: string; notes: string | null
}
export interface Equipment {
  id: string; name: string; vendor: string | null; days_required: number; daily_rate: number
  permit_required: string | null; operator_included: boolean; shoot_dates: string | null; status: string; notes: string | null
}

// Gate evaluators — derived, never stored
function stuntGate(s: Stunt) {
  const checks = [
    { label: 'Medical standby', ok: s.medical_standby },
    { label: 'Safety equipment', ok: s.safety_equipment_ok },
    { label: 'Risk assessment signed', ok: s.risk_assessment_signed },
    { label: 'Insurance rider active', ok: s.insurance_rider_active },
  ]
  return { checks, cleared: checks.every(c => c.ok) }
}
function animalGate(a: Animal) {
  const checks = [
    { label: 'AWBI permission', ok: a.awbi_permission },
    { label: 'Vet standby', ok: a.vet_standby },
    ...(a.welfare_officer_required ? [{ label: 'Welfare officer present', ok: a.welfare_officer_present }] : []),
  ]
  return { checks, cleared: checks.every(c => c.ok) }
}

function GateBanner({ cleared, checks }: { cleared: boolean; checks: { label: string; ok: boolean }[] }) {
  return (
    <div className={`mt-2 rounded-lg border px-3 py-2 ${cleared ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${cleared ? 'text-emerald-400' : 'text-red-400'}`}>
        {cleared ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
        {cleared ? 'CLEARED to shoot' : 'BLOCKED — cannot shoot until all conditions are met'}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {checks.map(c => (
          <span key={c.label} className={`text-[10px] inline-flex items-center gap-0.5 ${c.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {c.ok ? <Check size={10} /> : <X size={10} />} {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

interface Props { projectId: string; stunts: Stunt[]; animals: Animal[]; songs: Song[]; equipment: Equipment[]; userId: string; canManage: boolean; canDelete: boolean }

export function SequencesClient({ projectId, stunts, animals, songs, equipment, userId, canManage, canDelete }: Props) {
  const [tab, setTab] = useState<'stunts' | 'animals' | 'songs' | 'equipment'>('stunts')
  const blocked = useMemo(() =>
    stunts.filter(s => s.status !== 'cancelled' && !stuntGate(s).cleared).length +
    animals.filter(a => a.status !== 'cancelled' && !animalGate(a).cleared).length, [stunts, animals])

  return (
    <div>
      {blocked > 0 && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-2 text-sm text-red-400">
          <ShieldAlert size={16} /> {blocked} special sequence{blocked > 1 ? 's are' : ' is'} BLOCKED — safety/legal conditions not met. These shoot days cannot proceed.
        </div>
      )}
      <div className="flex gap-1 mb-4">
        {([['stunts', 'Action / Stunts', Swords], ['animals', 'Animals', PawPrint], ['songs', 'Songs / Dance', Music], ['equipment', 'Special Equipment', Wrench]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg ${tab === id ? 'bg-white/10 text-white' : 'text-[#8888aa] hover:text-white'}`}><Icon size={13} /> {label}</button>
        ))}
      </div>
      {tab === 'stunts' && <Stunts {...{ projectId, rows: stunts, userId, canManage, canDelete }} />}
      {tab === 'animals' && <Animals {...{ projectId, rows: animals, userId, canManage, canDelete }} />}
      {tab === 'songs' && <Songs {...{ projectId, rows: songs, userId, canManage, canDelete }} />}
      {tab === 'equipment' && <Equipments {...{ projectId, rows: equipment, userId, canManage, canDelete }} />}
    </div>
  )
}

const STUNT_EMPTY = { name: '', scenes: '', shoot_date: '', coordinator: '', performers_count: '', risk_level: 'high', description: '', medical_standby: false, safety_equipment_ok: false, risk_assessment_signed: false, insurance_rider_active: false, status: 'planned', notes: '' }

function Stunts({ projectId, rows, userId, canManage, canDelete }: { projectId: string; rows: Stunt[]; userId: string; canManage: boolean; canDelete: boolean }) {
  const router = useRouter(); const toast = useToast()
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Stunt | null>(null); const [form, setForm] = useState(STUNT_EMPTY)

  function openNew() { setEditing(null); setForm(STUNT_EMPTY); setOpen(true) }
  function openEdit(r: Stunt) { setEditing(r); setForm({ name: r.name, scenes: r.scenes ?? '', shoot_date: r.shoot_date ?? '', coordinator: r.coordinator ?? '', performers_count: r.performers_count?.toString() ?? '', risk_level: r.risk_level, description: r.description ?? '', medical_standby: r.medical_standby, safety_equipment_ok: r.safety_equipment_ok, risk_assessment_signed: r.risk_assessment_signed, insurance_rider_active: r.insurance_rider_active, status: r.status, notes: r.notes ?? '' }); setOpen(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, name: form.name.trim(), scenes: form.scenes || null, shoot_date: form.shoot_date || null,
      coordinator: form.coordinator || null, performers_count: form.performers_count ? parseInt(form.performers_count) : null,
      risk_level: form.risk_level, description: form.description || null,
      medical_standby: form.medical_standby, safety_equipment_ok: form.safety_equipment_ok,
      risk_assessment_signed: form.risk_assessment_signed, insurance_rider_active: form.insurance_rider_active,
      status: form.status, notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('stunt_sequences').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'stunt_sequences', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('stunt_sequences').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'stunt_sequences', data.id, undefined, payload)
    }
    toast.success(editing ? 'Updated' : 'Sequence added'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: Stunt) {
    if (!window.confirm(`Delete "${r.name}"?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('stunt_sequences').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'stunt_sequences', r.id); toast.success('Deleted'); router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center justify-end">{canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add stunt sequence</Button>}</div>
      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No stunt sequences yet. Each action day is gated on medical standby, safety, risk assessment and insurance.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {rows.map(r => {
            const gate = stuntGate(r)
            return (
              <div key={r.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{r.name}</span>
                      <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${r.risk_level === 'high' ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-[#8888aa]'}`}>{r.risk_level} risk</span>
                      {r.status !== 'planned' && <span className="text-[10px] text-[#8888aa]">{r.status}</span>}
                    </div>
                    <div className="text-[11px] text-[#8888aa] mt-0.5">{[r.coordinator, r.scenes, r.shoot_date ? formatDate(r.shoot_date) : null, r.performers_count ? `${r.performers_count} performers` : null].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(r)} className="p-1.5 text-[#8888aa] hover:text-white"><Pencil size={14} /></button>
                      {canDelete && <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>}
                    </div>
                  )}
                </div>
                <GateBanner cleared={gate.cleared} checks={gate.checks} />
              </div>
            )
          })}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Stunt Sequence' : 'Add Stunt Sequence'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Mass fight — village" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Coordinator" value={form.coordinator} onChange={e => setForm({ ...form, coordinator: e.target.value })} />
            <Select label="Risk level" value={form.risk_level} onChange={e => setForm({ ...form, risk_level: e.target.value })} options={['low', 'medium', 'high'].map(v => ({ value: v, label: v }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Scenes" value={form.scenes} onChange={e => setForm({ ...form, scenes: e.target.value })} />
            <Input label="Shoot date" type="date" value={form.shoot_date} onChange={e => setForm({ ...form, shoot_date: e.target.value })} />
          </div>
          <Input label="Performers" type="number" value={form.performers_count} onChange={e => setForm({ ...form, performers_count: e.target.value })} />
          <div className="rounded-lg border border-[#2a2a3a] p-3 space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-[#8888aa]">Safety gate — all required to shoot</div>
            {([['medical_standby', 'Medical standby (ambulance + doctor)'], ['safety_equipment_ok', 'Safety equipment checklist complete'], ['risk_assessment_signed', 'Risk assessment signed'], ['insurance_rider_active', 'Stunt insurance rider active']] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-[#c8c8da]"><input type="checkbox" checked={form[k] as boolean} onChange={e => setForm({ ...form, [k]: e.target.checked })} /> {label}</label>
            ))}
          </div>
          <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={['planned', 'completed', 'cancelled'].map(v => ({ value: v, label: v }))} />
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

const ANIMAL_EMPTY = { name: '', scenes: '', shoot_date: '', animals: '', handler: '', description: '', awbi_permission: false, vet_standby: false, welfare_officer_required: false, welfare_officer_present: false, status: 'planned', notes: '' }

function Animals({ projectId, rows, userId, canManage, canDelete }: { projectId: string; rows: Animal[]; userId: string; canManage: boolean; canDelete: boolean }) {
  const router = useRouter(); const toast = useToast()
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Animal | null>(null); const [form, setForm] = useState(ANIMAL_EMPTY)

  function openNew() { setEditing(null); setForm(ANIMAL_EMPTY); setOpen(true) }
  function openEdit(r: Animal) { setEditing(r); setForm({ name: r.name, scenes: r.scenes ?? '', shoot_date: r.shoot_date ?? '', animals: r.animals ?? '', handler: r.handler ?? '', description: r.description ?? '', awbi_permission: r.awbi_permission, vet_standby: r.vet_standby, welfare_officer_required: r.welfare_officer_required, welfare_officer_present: r.welfare_officer_present, status: r.status, notes: r.notes ?? '' }); setOpen(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, name: form.name.trim(), scenes: form.scenes || null, shoot_date: form.shoot_date || null,
      animals: form.animals || null, handler: form.handler || null, description: form.description || null,
      awbi_permission: form.awbi_permission, vet_standby: form.vet_standby,
      welfare_officer_required: form.welfare_officer_required, welfare_officer_present: form.welfare_officer_present,
      status: form.status, notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('animal_usage').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'animal_usage', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('animal_usage').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'animal_usage', data.id, undefined, payload)
    }
    toast.success(editing ? 'Updated' : 'Sequence added'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: Animal) {
    if (!window.confirm(`Delete "${r.name}"?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('animal_usage').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'animal_usage', r.id); toast.success('Deleted'); router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center justify-between">
        <span className="text-[11px] text-[#8888aa]">AWBI permission + vet standby are legally mandatory in India.</span>
        {canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add animal sequence</Button>}
      </div>
      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No animal sequences yet. Each is gated on AWBI permission and vet standby.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {rows.map(r => {
            const gate = animalGate(r)
            return (
              <div key={r.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{r.name}</span>
                      {r.animals && <span className="text-[11px] text-[#8888aa]">{r.animals}</span>}
                      {r.status !== 'planned' && <span className="text-[10px] text-[#8888aa]">{r.status}</span>}
                    </div>
                    <div className="text-[11px] text-[#8888aa] mt-0.5">{[r.handler, r.scenes, r.shoot_date ? formatDate(r.shoot_date) : null].filter(Boolean).join(' · ') || '—'}</div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openEdit(r)} className="p-1.5 text-[#8888aa] hover:text-white"><Pencil size={14} /></button>
                      {canDelete && <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>}
                    </div>
                  )}
                </div>
                <GateBanner cleared={gate.cleared} checks={gate.checks} />
              </div>
            )
          })}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Animal Sequence' : 'Add Animal Sequence'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Elephant procession" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Animals" value={form.animals} onChange={e => setForm({ ...form, animals: e.target.value })} placeholder="3 elephants" />
            <Input label="Handler / mahout" value={form.handler} onChange={e => setForm({ ...form, handler: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Scenes" value={form.scenes} onChange={e => setForm({ ...form, scenes: e.target.value })} />
            <Input label="Shoot date" type="date" value={form.shoot_date} onChange={e => setForm({ ...form, shoot_date: e.target.value })} />
          </div>
          <div className="rounded-lg border border-[#2a2a3a] p-3 space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-[#8888aa]">Legal gate — required to shoot</div>
            <label className="flex items-center gap-2 text-sm text-[#c8c8da]"><input type="checkbox" checked={form.awbi_permission} onChange={e => setForm({ ...form, awbi_permission: e.target.checked })} /> AWBI permission obtained</label>
            <label className="flex items-center gap-2 text-sm text-[#c8c8da]"><input type="checkbox" checked={form.vet_standby} onChange={e => setForm({ ...form, vet_standby: e.target.checked })} /> Veterinary standby confirmed</label>
            <label className="flex items-center gap-2 text-sm text-[#c8c8da]"><input type="checkbox" checked={form.welfare_officer_required} onChange={e => setForm({ ...form, welfare_officer_required: e.target.checked })} /> Welfare officer required</label>
            {form.welfare_officer_required && <label className="flex items-center gap-2 text-sm text-[#c8c8da] pl-5"><input type="checkbox" checked={form.welfare_officer_present} onChange={e => setForm({ ...form, welfare_officer_present: e.target.checked })} /> Welfare officer present</label>}
          </div>
          <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={['planned', 'completed', 'cancelled'].map(v => ({ value: v, label: v }))} />
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

const SONG_EMPTY = { name: '', choreographer: '', dancers_count: '', rehearsal_days: '', shoot_days: '', location: '', shoot_date: '', status: 'planned', notes: '' }

function Songs({ projectId, rows, userId, canManage, canDelete }: { projectId: string; rows: Song[]; userId: string; canManage: boolean; canDelete: boolean }) {
  const router = useRouter(); const toast = useToast()
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Song | null>(null); const [form, setForm] = useState(SONG_EMPTY)

  function openNew() { setEditing(null); setForm(SONG_EMPTY); setOpen(true) }
  function openEdit(r: Song) { setEditing(r); setForm({ name: r.name, choreographer: r.choreographer ?? '', dancers_count: r.dancers_count?.toString() ?? '', rehearsal_days: r.rehearsal_days?.toString() ?? '', shoot_days: r.shoot_days?.toString() ?? '', location: r.location ?? '', shoot_date: r.shoot_date ?? '', status: r.status, notes: r.notes ?? '' }); setOpen(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    setSaving(true)
    const supabase = createClient()
    const payload = { project_id: projectId, name: form.name.trim(), choreographer: form.choreographer || null, dancers_count: form.dancers_count ? parseInt(form.dancers_count) : null, rehearsal_days: form.rehearsal_days ? parseInt(form.rehearsal_days) : null, shoot_days: form.shoot_days ? parseInt(form.shoot_days) : null, location: form.location || null, shoot_date: form.shoot_date || null, status: form.status, notes: form.notes || null }
    if (editing) {
      const { error } = await supabase.from('song_sequences').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'song_sequences', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('song_sequences').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'song_sequences', data.id, undefined, payload)
    }
    toast.success(editing ? 'Updated' : 'Song added'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: Song) {
    if (!window.confirm(`Delete "${r.name}"?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('song_sequences').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'song_sequences', r.id); toast.success('Deleted'); router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center justify-end">{canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add song</Button>}</div>
      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No song/dance sequences yet.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {rows.map(r => (
            <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{r.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[#8888aa]">{r.status}</span>
                </div>
                <div className="text-[11px] text-[#8888aa] mt-0.5">{[r.choreographer, r.dancers_count ? `${r.dancers_count} dancers` : null, r.rehearsal_days ? `${r.rehearsal_days}d rehearsal` : null, r.location, r.shoot_date ? formatDate(r.shoot_date) : null].filter(Boolean).join(' · ') || '—'}</div>
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
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Song' : 'Add Song / Dance'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Folk dance number" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Choreographer" value={form.choreographer} onChange={e => setForm({ ...form, choreographer: e.target.value })} />
            <Input label="Dancers" type="number" value={form.dancers_count} onChange={e => setForm({ ...form, dancers_count: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Rehearsal days" type="number" value={form.rehearsal_days} onChange={e => setForm({ ...form, rehearsal_days: e.target.value })} />
            <Input label="Shoot days" type="number" value={form.shoot_days} onChange={e => setForm({ ...form, shoot_days: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            <Input label="Shoot date" type="date" value={form.shoot_date} onChange={e => setForm({ ...form, shoot_date: e.target.value })} />
          </div>
          <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={['planned', 'rehearsing', 'shot', 'completed', 'cancelled'].map(v => ({ value: v, label: v }))} />
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

const EQUIP_EMPTY = { name: '', vendor: '', days_required: '', daily_rate: '', permit_required: '', operator_included: false, shoot_dates: '', status: 'planned', notes: '' }

function Equipments({ projectId, rows, userId, canManage, canDelete }: { projectId: string; rows: Equipment[]; userId: string; canManage: boolean; canDelete: boolean }) {
  const router = useRouter(); const toast = useToast()
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Equipment | null>(null); const [form, setForm] = useState(EQUIP_EMPTY)
  const est = (d: string | number, r: string | number) => (Number(d) || 0) * (Number(r) || 0)
  const total = rows.reduce((s, r) => s + est(r.days_required, r.daily_rate), 0)

  function openNew() { setEditing(null); setForm(EQUIP_EMPTY); setOpen(true) }
  function openEdit(r: Equipment) { setEditing(r); setForm({ name: r.name, vendor: r.vendor ?? '', days_required: r.days_required?.toString() ?? '', daily_rate: r.daily_rate?.toString() ?? '', permit_required: r.permit_required ?? '', operator_included: r.operator_included, shoot_dates: r.shoot_dates ?? '', status: r.status, notes: r.notes ?? '' }); setOpen(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    setSaving(true)
    const supabase = createClient()
    const payload = { project_id: projectId, name: form.name.trim(), vendor: form.vendor || null, days_required: form.days_required ? parseInt(form.days_required) : 0, daily_rate: form.daily_rate ? Number(form.daily_rate) : 0, permit_required: form.permit_required || null, operator_included: form.operator_included, shoot_dates: form.shoot_dates || null, status: form.status, notes: form.notes || null }
    if (editing) {
      const { error } = await supabase.from('special_equipment').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'special_equipment', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('special_equipment').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'special_equipment', data.id, undefined, payload)
    }
    toast.success(editing ? 'Updated' : 'Equipment added'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: Equipment) {
    if (!window.confirm(`Delete "${r.name}"?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('special_equipment').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'special_equipment', r.id); toast.success('Deleted'); router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center justify-between">
        <span className="text-[11px] text-[#8888aa]">Est. total (planning): <span className="text-white">{formatCurrency(total)}</span></span>
        {canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add equipment</Button>}
      </div>
      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No special equipment yet.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {rows.map(r => (
            <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{r.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[#8888aa]">{r.status}</span>
                  {r.permit_required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{r.permit_required}</span>}
                </div>
                <div className="text-[11px] text-[#8888aa] mt-0.5">{[r.vendor, `${Number(r.days_required)}d × ₹${Number(r.daily_rate)}`, r.operator_included ? 'operator incl.' : null].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(est(r.days_required, r.daily_rate))}</span>
                {canManage && <button onClick={() => openEdit(r)} className="p-1.5 text-[#8888aa] hover:text-white"><Pencil size={14} /></button>}
                {canDelete && <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Equipment' : 'Add Special Equipment'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Technocrane / Drone" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Vendor" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
            <Input label="Permit required" value={form.permit_required} onChange={e => setForm({ ...form, permit_required: e.target.value })} placeholder="DGCA drone" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Days required" type="number" value={form.days_required} onChange={e => setForm({ ...form, days_required: e.target.value })} />
            <MoneyInput label="Daily rate (₹)" value={form.daily_rate} onChange={v => setForm({ ...form, daily_rate: v })} />
          </div>
          <div className="text-[11px] text-[#8888aa]">Estimated: <span className="text-white">{formatCurrency(est(form.days_required, form.daily_rate))}</span></div>
          <Input label="Shoot dates" value={form.shoot_dates} onChange={e => setForm({ ...form, shoot_dates: e.target.value })} placeholder="Days 34–37" />
          <div className="grid grid-cols-2 gap-3 items-center">
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={['planned', 'booked', 'on_set', 'returned', 'cancelled'].map(v => ({ value: v, label: v.replace('_', ' ') }))} />
            <label className="flex items-center gap-2 text-sm text-[#c8c8da] pt-5"><input type="checkbox" checked={form.operator_included} onChange={e => setForm({ ...form, operator_included: e.target.checked })} /> Operator included</label>
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
