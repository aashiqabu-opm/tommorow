'use client'

import { useMemo, useState } from 'react'
import { Plus, Clapperboard, Pencil, Trash2, MapPin, Clock } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import type { ProductionReport, DPRStatus } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  reports: ProductionReport[]
  userId: string
  canManage: boolean
  canDelete: boolean
}

const STATUS_META: Record<DPRStatus, { label: string; variant: 'green' | 'blue' | 'red' }> = {
  on_schedule: { label: 'On Schedule', variant: 'green' },
  ahead: { label: 'Ahead', variant: 'blue' },
  behind: { label: 'Behind', variant: 'red' },
}

const EMPTY = {
  report_date: new Date().toISOString().split('T')[0], day_number: '', location: '',
  call_time: '', wrap_time: '', scenes_planned: '', scenes_completed: '', shots_completed: '',
  cast_present: '', crew_count: '', status: 'on_schedule', weather: '', notes: '',
}

export function ProductionReportSection({ projectId, reports, userId, canManage, canDelete }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<ProductionReport | null>(null)
  const [form, setForm] = useState(EMPTY)

  const summary = useMemo(() => ({
    days: reports.length,
    scenes: reports.reduce((s, r) => s + Number(r.scenes_completed || 0), 0),
    behind: reports.filter(r => r.status === 'behind').length,
  }), [reports])

  function openNew() {
    const lastDay = reports.reduce((m, r) => Math.max(m, Number(r.day_number || 0)), 0)
    setEditing(null)
    setForm({ ...EMPTY, day_number: lastDay ? String(lastDay + 1) : '' })
    setOpen(true)
  }
  function openEdit(r: ProductionReport) {
    setEditing(r)
    setForm({
      report_date: r.report_date, day_number: r.day_number != null ? String(r.day_number) : '',
      location: r.location ?? '', call_time: r.call_time ?? '', wrap_time: r.wrap_time ?? '',
      scenes_planned: r.scenes_planned != null ? String(r.scenes_planned) : '',
      scenes_completed: r.scenes_completed != null ? String(r.scenes_completed) : '',
      shots_completed: r.shots_completed != null ? String(r.shots_completed) : '',
      cast_present: r.cast_present ?? '', crew_count: r.crew_count != null ? String(r.crew_count) : '',
      status: r.status ?? 'on_schedule', weather: r.weather ?? '', notes: r.notes ?? '',
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const num = (v: string) => (v === '' ? null : parseInt(v) || 0)
    const payload = {
      project_id: projectId, report_date: form.report_date, day_number: num(form.day_number),
      location: form.location || null, call_time: form.call_time || null, wrap_time: form.wrap_time || null,
      scenes_planned: parseInt(form.scenes_planned) || 0, scenes_completed: parseInt(form.scenes_completed) || 0,
      shots_completed: num(form.shots_completed), cast_present: form.cast_present || null,
      crew_count: num(form.crew_count), status: form.status, weather: form.weather || null, notes: form.notes || null,
    }
    if (editing) {
      const { data, error } = await supabase.from('production_reports').update(payload).eq('id', editing.id).select().single()
      if (error) { toast.error("Couldn't update — try again"); setSaving(false); return }
      if (data) await logAction('update', 'production_reports', editing.id, editing as unknown as Record<string, unknown>, data)
      toast.success('Report updated')
    } else {
      const { data, error } = await supabase.from('production_reports').insert({ ...payload, created_by: userId }).select().single()
      if (error) {
        const hint = /relation .*production_reports.* does not exist/i.test(error.message) ? 'run migration-dpr.sql first' : error.message
        toast.error(`Couldn't save — ${String(hint).slice(0, 80)}`); setSaving(false); return
      }
      if (data) await logAction('create', 'production_reports', data.id, undefined, data)
      toast.success('Daily report added')
    }
    setSaving(false); setOpen(false); setEditing(null); router.refresh()
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm(`Delete the report for ${formatDate(editing.report_date)}?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('production_reports').delete().eq('id', editing.id)
    if (error) { toast.error("Couldn't delete — try again"); return }
    await logAction('delete', 'production_reports', editing.id, editing as unknown as Record<string, unknown>, undefined)
    toast.success('Report deleted'); setOpen(false); setEditing(null); router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Daily Production Reports</h3>
          <p className="text-xs text-[#8888aa] mt-0.5">Shoot-day log — scenes, locations, schedule status</p>
        </div>
        {canManage && <Button icon={Plus} size="sm" onClick={openNew}>Add Report</Button>}
      </div>

      {reports.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard title="Shoot Days" value={summary.days} status="default" icon={Clapperboard} />
          <StatCard title="Scenes Completed" value={summary.scenes} status="green" />
          <StatCard title="Days Behind" value={summary.behind} status={summary.behind > 0 ? 'red' : 'green'} />
        </div>
      )}

      {reports.length === 0 ? (
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl py-10 text-center text-sm text-[#8888aa]">
          No production reports yet.{canManage ? ' Log a shoot day to start tracking progress.' : ''}
        </div>
      ) : (
        <div className="space-y-2.5">
          {reports.map(r => {
            const meta = STATUS_META[r.status] ?? STATUS_META.on_schedule
            return (
              <div key={r.id} className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {r.day_number != null && <span className="text-sm font-semibold text-white">Day {r.day_number}</span>}
                      <span className="text-sm text-[#c8c8da]">{formatDate(r.report_date)}</span>
                      <StatusBadge label={meta.label} variant={meta.variant} />
                    </div>
                    <div className="text-xs text-[#8888aa] flex flex-wrap gap-x-3 gap-y-0.5">
                      {r.location && <span className="inline-flex items-center gap-1"><MapPin size={11} />{r.location}</span>}
                      {(r.call_time || r.wrap_time) && <span className="inline-flex items-center gap-1"><Clock size={11} />{r.call_time || '—'} → {r.wrap_time || '—'}</span>}
                      {r.weather && <span>{r.weather}</span>}
                      {r.cast_present && <span>Cast: {r.cast_present}</span>}
                    </div>
                    {r.notes && <p className="text-xs text-[#b0b0c8] mt-1.5">{r.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base font-bold text-white tabular-nums">{r.scenes_completed}<span className="text-[#5a5a7a] text-sm">/{r.scenes_planned || '—'}</span></div>
                    <div className="text-[11px] text-[#8888aa]">scenes done</div>
                    {canManage && <button onClick={() => openEdit(r)} className="text-[11px] text-[#8888aa] hover:text-white inline-flex items-center gap-1 mt-1"><Pencil size={11} /> Edit</button>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Production Report' : 'Daily Production Report'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Input label="Date *" type="date" value={form.report_date} onChange={e => setForm({ ...form, report_date: e.target.value })} required />
            <Input label="Day #" inputMode="numeric" value={form.day_number} onChange={e => setForm({ ...form, day_number: e.target.value })} placeholder="e.g. 12" />
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              options={[{ value: 'on_schedule', label: 'On Schedule' }, { value: 'ahead', label: 'Ahead' }, { value: 'behind', label: 'Behind' }]} />
          </div>
          <Input label="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Fort Kochi" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Call Time" value={form.call_time} onChange={e => setForm({ ...form, call_time: e.target.value })} placeholder="e.g. 6:00 AM" />
            <Input label="Wrap Time" value={form.wrap_time} onChange={e => setForm({ ...form, wrap_time: e.target.value })} placeholder="e.g. 8:00 PM" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Scenes Planned" inputMode="numeric" value={form.scenes_planned} onChange={e => setForm({ ...form, scenes_planned: e.target.value })} />
            <Input label="Scenes Done" inputMode="numeric" value={form.scenes_completed} onChange={e => setForm({ ...form, scenes_completed: e.target.value })} />
            <Input label="Shots / Setups" inputMode="numeric" value={form.shots_completed} onChange={e => setForm({ ...form, shots_completed: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Cast Present" value={form.cast_present} onChange={e => setForm({ ...form, cast_present: e.target.value })} placeholder="names / count" />
            <Input label="Crew Count" inputMode="numeric" value={form.crew_count} onChange={e => setForm({ ...form, crew_count: e.target.value })} />
            <Input label="Weather" value={form.weather} onChange={e => setForm({ ...form, weather: e.target.value })} placeholder="e.g. Clear" />
          </div>
          <Textarea label="Notes / Incidents / Delays" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
          <div className="flex items-center justify-between gap-2 pt-2">
            {editing && canDelete ? (
              <Button variant="ghost" type="button" icon={Trash2} onClick={handleDelete} className="text-red-400 hover:text-red-300">Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Add Report'}</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
