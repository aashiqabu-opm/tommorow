'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Briefcase, Users, Plus, Pencil, Trash2, ChevronRight, ArrowUpRight } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'

export interface JobPosition {
  id: string; title: string; department: string | null; type: string; description: string | null; status: string; created_at: string
}
export interface JobApplication {
  id: string; position_id: string | null; applicant_name: string; email: string | null; phone: string | null
  portfolio_url: string | null; cover_note: string | null; status: string; assigned_to: string | null
  founder_notes: string | null; created_at: string; position?: { title: string } | null
}
export interface AssigneeOpt { id: string; full_name: string; role: string }

const TYPE_LABEL: Record<string, string> = { permanent: 'Permanent', project: 'Project', freelance: 'Freelance' }
const POS_STATUS: Record<string, string> = { open: 'bg-green-500/15 text-green-400 border-green-500/30', on_hold: 'bg-amber-500/15 text-amber-400 border-amber-500/30', closed: 'bg-white/5 text-[#8888aa] border-[#2a2a3a]' }
const APP_STATUS = ['new', 'shortlisted', 'rejected', 'escalated']
const APP_STATUS_CLS: Record<string, string> = {
  new: 'bg-sky-500/15 text-sky-400 border-sky-500/30', shortlisted: 'bg-green-500/15 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30', escalated: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
}

interface Props {
  positions: JobPosition[]; applications: JobApplication[]; assignees: AssigneeOpt[]
  defaultAssignee: string | null; userId: string; isFounder: boolean
}

export function HrClient({ positions, applications, assignees, defaultAssignee, userId, isFounder }: Props) {
  const [tab, setTab] = useState<'positions' | 'applications'>('positions')
  const appCountByPos = useMemo(() => {
    const m: Record<string, number> = {}
    for (const a of applications) if (a.position_id) m[a.position_id] = (m[a.position_id] ?? 0) + 1
    return m
  }, [applications])

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {([['positions', 'Positions', Briefcase], ['applications', 'Applications', Users]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg ${tab === id ? 'bg-white/10 text-white' : 'text-[#8888aa] hover:text-white'}`}><Icon size={13} /> {label}</button>
        ))}
      </div>
      {tab === 'positions'
        ? <Positions rows={positions} counts={appCountByPos} userId={userId} isFounder={isFounder} />
        : <Applications rows={applications} positions={positions} assignees={assignees} defaultAssignee={defaultAssignee} userId={userId} isFounder={isFounder} />}
    </div>
  )
}

const POS_EMPTY = { title: '', department: '', type: 'permanent', description: '', status: 'open' }

function Positions({ rows, counts, userId, isFounder }: { rows: JobPosition[]; counts: Record<string, number>; userId: string; isFounder: boolean }) {
  const router = useRouter(); const toast = useToast()
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<JobPosition | null>(null); const [form, setForm] = useState(POS_EMPTY)

  function openNew() { setEditing(null); setForm(POS_EMPTY); setOpen(true) }
  function openEdit(r: JobPosition) { setEditing(r); setForm({ title: r.title, department: r.department ?? '', type: r.type, description: r.description ?? '', status: r.status }); setOpen(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Title is required')
    setSaving(true)
    const supabase = createClient()
    const payload = { title: form.title.trim(), department: form.department || null, type: form.type, description: form.description || null, status: form.status }
    if (editing) {
      const { error } = await supabase.from('job_positions').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'job_positions', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('job_positions').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'job_positions', data.id, undefined, payload)
    }
    toast.success(editing ? 'Position updated' : 'Position created'); setSaving(false); setOpen(false); router.refresh()
  }
  async function setStatus(r: JobPosition, status: string) {
    const supabase = createClient()
    const { error } = await supabase.from('job_positions').update({ status }).eq('id', r.id)
    if (error) { toast.error("Couldn't update"); return }
    await logAction('update', 'job_positions', r.id, undefined, { status }); router.refresh()
  }
  async function remove(r: JobPosition) {
    if (!window.confirm(`Delete "${r.title}"? Its applications are deleted too.`)) return
    const supabase = createClient()
    const { error } = await supabase.from('job_positions').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'job_positions', r.id); toast.success('Deleted'); router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center justify-end">{isFounder && <Button size="sm" icon={Plus} onClick={openNew}>New Position</Button>}</div>
      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No positions yet.{isFounder ? ' Create one to start receiving applications.' : ''}</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {rows.map(r => (
            <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{r.title}</span>
                  {r.department && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#8888aa]">{r.department}</span>}
                  <span className="text-[10px] uppercase tracking-wide text-[#8888aa]">{TYPE_LABEL[r.type] ?? r.type}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${POS_STATUS[r.status]}`}>{r.status.replace('_', ' ')}</span>
                </div>
                <div className="text-[11px] text-[#8888aa] mt-0.5">{counts[r.id] ?? 0} application(s) · {formatDate(r.created_at)}</div>
              </div>
              {isFounder && (
                <div className="flex items-center gap-1 shrink-0">
                  <select value={r.status} onChange={e => setStatus(r, e.target.value)} className="bg-[#1a1a24] border border-[#2a2a3a] rounded text-xs text-white px-1.5 py-1">
                    {['open', 'on_hold', 'closed'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                  <button onClick={() => openEdit(r)} className="p-1.5 text-[#8888aa] hover:text-white"><Pencil size={14} /></button>
                  <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Position' : 'New Position'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <Input label="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
            <Select label="Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} options={['permanent', 'project', 'freelance'].map(v => ({ value: v, label: TYPE_LABEL[v] }))} />
          </div>
          <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={['open', 'on_hold', 'closed'].map(v => ({ value: v, label: v.replace('_', ' ') }))} />
          <Textarea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function Applications({ rows, positions, assignees, defaultAssignee, userId, isFounder }: { rows: JobApplication[]; positions: JobPosition[]; assignees: AssigneeOpt[]; defaultAssignee: string | null; userId: string; isFounder: boolean }) {
  const router = useRouter(); const toast = useToast()
  const [posFilter, setPosFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<JobApplication | null>(null)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const assigneeName = (id: string | null) => assignees.find(a => a.id === id)?.full_name ?? '—'
  const shown = rows.filter(r => (!posFilter || r.position_id === posFilter) && (!statusFilter || r.status === statusFilter))

  async function setStatus(r: JobApplication, status: string) {
    const supabase = createClient()
    // first time a 'new' app is touched, default the assignee to Madan if unset
    const patch: Record<string, unknown> = { status }
    if (!r.assigned_to && defaultAssignee) patch.assigned_to = defaultAssignee
    const { error } = await supabase.from('job_applications').update(patch).eq('id', r.id)
    if (error) { toast.error("Couldn't update"); return }
    await logAction('update', 'job_applications', r.id, undefined, patch)
    if (selected?.id === r.id) setSelected({ ...selected, status, assigned_to: (patch.assigned_to as string) ?? selected.assigned_to })
    router.refresh()
  }
  async function setAssignee(r: JobApplication, assigned_to: string) {
    const supabase = createClient()
    const { error } = await supabase.from('job_applications').update({ assigned_to: assigned_to || null }).eq('id', r.id)
    if (error) { toast.error("Couldn't assign"); return }
    await logAction('update', 'job_applications', r.id, undefined, { assigned_to }); router.refresh()
  }
  async function saveNotes() {
    if (!selected) return
    setSavingNotes(true)
    const supabase = createClient()
    const { error } = await supabase.from('job_applications').update({ founder_notes: notes || null }).eq('id', selected.id)
    if (error) { toast.error("Couldn't save"); setSavingNotes(false); return }
    await logAction('update', 'job_applications', selected.id, undefined, { founder_notes: true })
    toast.success('Notes saved'); setSavingNotes(false); router.refresh()
  }
  function openPanel(r: JobApplication) { setSelected(r); setNotes(r.founder_notes ?? '') }

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-4">
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center gap-2 flex-wrap">
          <Select label="" value={posFilter} onChange={e => setPosFilter(e.target.value)} options={[{ value: '', label: 'All positions' }, ...positions.map(p => ({ value: p.id, label: p.title }))]} />
          <Select label="" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[{ value: '', label: 'All statuses' }, ...APP_STATUS.map(s => ({ value: s, label: s }))]} />
        </div>
        {shown.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#8888aa]">No applications.</div>
        ) : (
          <div className="divide-y divide-[#2a2a3a]">
            {shown.map(r => (
              <button key={r.id} onClick={() => openPanel(r)} className={`w-full text-left px-5 py-3 flex items-center justify-between gap-3 hover:bg-[#1a1a24] ${r.status === 'escalated' ? 'bg-amber-500/5' : ''}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white truncate">{r.applicant_name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${APP_STATUS_CLS[r.status]}`}>{r.status}</span>
                    {r.status === 'escalated' && <ArrowUpRight size={12} className="text-amber-400" />}
                  </div>
                  <div className="text-[11px] text-[#8888aa] mt-0.5">{r.position?.title ?? '—'} · {formatDate(r.created_at)} · {assigneeName(r.assigned_to)}</div>
                </div>
                <ChevronRight size={15} className="text-[#5a5a7a] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Side panel */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 h-fit lg:sticky lg:top-4">
        {!selected ? (
          <p className="text-sm text-[#8888aa] text-center py-8">Select an application to review.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-white">{selected.applicant_name}</h3>
              <p className="text-[11px] text-[#8888aa]">{selected.position?.title ?? '—'}</p>
            </div>
            <Field label="Email" value={selected.email} />
            <Field label="Phone" value={selected.phone} />
            {selected.portfolio_url && <div><div className="text-[10px] uppercase tracking-wide text-[#666688]">Portfolio</div><a href={selected.portfolio_url} target="_blank" rel="noreferrer" className="text-xs text-sky-400 hover:underline break-all">{selected.portfolio_url}</a></div>}
            {selected.cover_note && <div><div className="text-[10px] uppercase tracking-wide text-[#666688]">Cover note</div><p className="text-xs text-[#c8c8da] whitespace-pre-wrap">{selected.cover_note}</p></div>}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Select label="Status" value={selected.status} onChange={e => setStatus(selected, e.target.value)} options={APP_STATUS.map(s => ({ value: s, label: s }))} />
              <Select label="Assigned to" value={selected.assigned_to ?? ''} onChange={e => setAssignee(selected, e.target.value)} options={[{ value: '', label: '—' }, ...assignees.map(a => ({ value: a.id, label: a.full_name }))]} />
            </div>
            {selected.status === 'escalated' && <p className="text-[11px] text-amber-400">Escalated — routed to the founder.</p>}

            {isFounder && (
              <div className="pt-2">
                <Textarea label="Founder notes" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
                <Button size="sm" className="mt-2" loading={savingNotes} onClick={saveNotes}>Save notes</Button>
              </div>
            )}
            {!isFounder && selected.founder_notes && (
              <div><div className="text-[10px] uppercase tracking-wide text-[#666688]">Founder notes</div><p className="text-xs text-[#c8c8da] whitespace-pre-wrap">{selected.founder_notes}</p></div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return <div><div className="text-[10px] uppercase tracking-wide text-[#666688]">{label}</div><p className="text-xs text-[#c8c8da] break-all">{value}</p></div>
}
