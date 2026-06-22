'use client'

import { useMemo, useState } from 'react'
import { MapPin, ClipboardCheck, Plus, Pencil, Trash2, Crosshair, ShieldCheck, ShieldAlert } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface Geofence { id: string; name: string; latitude: number | null; longitude: number | null; radius_m: number; active: boolean; notes: string | null }
export interface AttLog {
  id: string; onboarding_id: string | null; crew_name: string | null; geofence_id: string | null
  log_date: string; check_in_at: string | null; check_out_at: string | null; method: string; consent_ok: boolean; notes: string | null
}
export interface CrewOpt { id: string; full_name: string; location_consent: boolean }

const fmtTime = (t: string | null) => t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'

interface Props { projectId: string; geofences: Geofence[]; logs: AttLog[]; crew: CrewOpt[]; userId: string; canManage: boolean; canDelete: boolean }

export function AttendanceClient({ projectId, geofences, logs, crew, userId, canManage, canDelete }: Props) {
  const [tab, setTab] = useState<'log' | 'zones'>('log')
  const crewName = (id: string | null) => crew.find(c => c.id === id)?.full_name
  const zoneName = (id: string | null) => geofences.find(g => g.id === id)?.name ?? '—'

  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return logs.filter(l => l.log_date === today && l.check_in_at).length
  }, [logs])

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Present today" value={String(todayCount)} />
        <Stat label="Logged total" value={String(logs.length)} />
        <Stat label="Work zones" value={String(geofences.length)} />
      </div>
      <div className="flex gap-1 mb-4">
        {([['log', 'Attendance', ClipboardCheck], ['zones', 'Work Zones', MapPin]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg ${tab === id ? 'bg-white/10 text-white' : 'text-[#8888aa] hover:text-white'}`}><Icon size={13} /> {label}</button>
        ))}
      </div>
      {tab === 'log'
        ? <Logs {...{ projectId, geofences, crew, rows: logs, crewName, zoneName, userId, canManage, canDelete }} />
        : <Zones {...{ projectId, rows: geofences, userId, canManage, canDelete }} />}
    </div>
  )
}

const LOG_EMPTY = { onboarding_id: '', crew_name: '', geofence_id: '', log_date: new Date().toISOString().slice(0, 10), check_in_at: '', check_out_at: '', method: 'manual', notes: '' }

function Logs({ projectId, geofences, crew, rows, crewName, zoneName, userId, canManage, canDelete }: { projectId: string; geofences: Geofence[]; crew: CrewOpt[]; rows: AttLog[]; crewName: (id: string | null) => string | undefined; zoneName: (id: string | null) => string; userId: string; canManage: boolean; canDelete: boolean }) {
  const router = useRouter(); const toast = useToast()
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(LOG_EMPTY)

  function openNew() { setForm(LOG_EMPTY); setOpen(true) }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.onboarding_id && !form.crew_name.trim()) return toast.error('Pick a crew member or enter a name')
    setSaving(true)
    const person = crew.find(c => c.id === form.onboarding_id)
    const consent_ok = person ? person.location_consent : false
    const supabase = createClient()
    const { data, error } = await supabase.from('attendance_logs').insert({
      project_id: projectId, onboarding_id: form.onboarding_id || null, crew_name: person?.full_name ?? (form.crew_name || null),
      geofence_id: form.geofence_id || null, log_date: form.log_date,
      check_in_at: form.check_in_at ? new Date(form.check_in_at).toISOString() : null,
      check_out_at: form.check_out_at ? new Date(form.check_out_at).toISOString() : null,
      method: 'manual', consent_ok, notes: form.notes || null, created_by: userId,
    }).select().single()
    if (error) { toast.error("Couldn't save"); setSaving(false); return }
    await logAction('create', 'attendance_logs', data.id, undefined, { log_date: form.log_date })
    toast.success('Attendance logged'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: AttLog) {
    if (!window.confirm('Delete this attendance record?')) return
    const supabase = createClient()
    const { error } = await supabase.from('attendance_logs').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'attendance_logs', r.id); toast.success('Deleted'); router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center justify-between">
        <span className="text-[11px] text-[#8888aa] flex items-center gap-1.5"><ShieldCheck size={12} /> GPS capture is consent-gated; manual time-cards don't need location.</span>
        {canManage && <Button size="sm" icon={Plus} onClick={openNew}>Log attendance</Button>}
      </div>
      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No attendance logged yet.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {rows.map(r => (
            <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{r.crew_name || crewName(r.onboarding_id) || 'Unknown'}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[#8888aa]">{r.method}</span>
                  {r.method !== 'manual' && (r.consent_ok
                    ? <span className="text-[10px] text-emerald-400 inline-flex items-center gap-0.5"><ShieldCheck size={10} /> consented</span>
                    : <span className="text-[10px] text-amber-400 inline-flex items-center gap-0.5"><ShieldAlert size={10} /> no consent</span>)}
                </div>
                <div className="text-[11px] text-[#8888aa] mt-0.5">{formatDate(r.log_date)} · {zoneName(r.geofence_id)} · in {fmtTime(r.check_in_at)} · out {fmtTime(r.check_out_at)}</div>
              </div>
              {canDelete && <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Log Attendance" size="sm">
        <form onSubmit={save} className="space-y-4">
          <Select label="Crew member" value={form.onboarding_id} onChange={e => setForm({ ...form, onboarding_id: e.target.value })}
            options={[{ value: '', label: '— Manual name —' }, ...crew.map(c => ({ value: c.id, label: c.full_name }))]} />
          {!form.onboarding_id && <Input label="Name" value={form.crew_name} onChange={e => setForm({ ...form, crew_name: e.target.value })} />}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={form.log_date} onChange={e => setForm({ ...form, log_date: e.target.value })} />
            <Select label="Work zone" value={form.geofence_id} onChange={e => setForm({ ...form, geofence_id: e.target.value })} options={[{ value: '', label: '—' }, ...geofences.map(g => ({ value: g.id, label: g.name }))]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Check-in" type="datetime-local" value={form.check_in_at} onChange={e => setForm({ ...form, check_in_at: e.target.value })} />
            <Input label="Check-out" type="datetime-local" value={form.check_out_at} onChange={e => setForm({ ...form, check_out_at: e.target.value })} />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Log</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

const ZONE_EMPTY = { name: '', latitude: '', longitude: '', radius_m: '200', active: true, notes: '' }

function Zones({ projectId, rows, userId, canManage, canDelete }: { projectId: string; rows: Geofence[]; userId: string; canManage: boolean; canDelete: boolean }) {
  const router = useRouter(); const toast = useToast()
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Geofence | null>(null); const [form, setForm] = useState(ZONE_EMPTY)
  const [locating, setLocating] = useState(false)

  function openNew() { setEditing(null); setForm(ZONE_EMPTY); setOpen(true) }
  function openEdit(r: Geofence) { setEditing(r); setForm({ name: r.name, latitude: r.latitude?.toString() ?? '', longitude: r.longitude?.toString() ?? '', radius_m: r.radius_m?.toString() ?? '200', active: r.active, notes: r.notes ?? '' }); setOpen(true) }

  function useMyLocation() {
    if (!navigator.geolocation) { toast.error('Geolocation not available'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => { setForm(f => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) })); setLocating(false); toast.success('Location captured') },
      () => { setLocating(false); toast.error('Could not get location') },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, name: form.name.trim(),
      latitude: form.latitude ? Number(form.latitude) : null, longitude: form.longitude ? Number(form.longitude) : null,
      radius_m: form.radius_m ? parseInt(form.radius_m) : 200, active: form.active, notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('geofences').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'geofences', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('geofences').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'geofences', data.id, undefined, payload)
    }
    toast.success(editing ? 'Zone updated' : 'Zone added'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: Geofence) {
    if (!window.confirm(`Delete zone "${r.name}"?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('geofences').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'geofences', r.id); toast.success('Deleted'); router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center justify-end">{canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add zone</Button>}</div>
      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No work zones yet. Add a geofenced location for auto check-in.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {rows.map(r => (
            <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white truncate">{r.name}</span>
                  {!r.active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-[#8888aa] border border-[#2a2a3a]">inactive</span>}
                </div>
                <div className="text-[11px] text-[#8888aa] mt-0.5">{r.latitude != null && r.longitude != null ? `${r.latitude}, ${r.longitude}` : 'no coordinates'} · {r.radius_m}m radius</div>
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
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Zone' : 'Add Work Zone'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Main location" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Latitude" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} />
            <Input label="Longitude" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} />
          </div>
          <Button type="button" variant="secondary" size="sm" icon={Crosshair} loading={locating} onClick={useMyLocation}>Use my current location</Button>
          <div className="grid grid-cols-2 gap-3 items-center">
            <Input label="Radius (m)" type="number" value={form.radius_m} onChange={e => setForm({ ...form, radius_m: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-[#c8c8da] pt-5"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active</label>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wide text-[#8888aa]">{label}</div>
      <div className="text-lg font-bold tabular-nums mt-0.5 text-white">{value}</div>
    </div>
  )
}
