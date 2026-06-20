'use client'

import { useState, useMemo } from 'react'
import { Building2, Plus, Pencil, Trash2, Pin, Megaphone, CheckCircle2, Clock, AlertTriangle, ListTodo, UserCircle, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { OFFICE_TASK_STATUS_LABELS, OFFICE_DEPT_LABELS, type OfficeTask, type OfficeNotice, type OfficeDepartment } from '@/lib/types'
import { useRouter } from 'next/navigation'

const ROLE_LABELS: Record<string, string> = { founder: 'Founder', accountant: 'Accountant', general_manager: 'General Manager', executive_producer: 'Executive Producer', legal_viewer: 'Legal', staff: 'Staff' }
const DEPT_OPTS = (Object.entries(OFFICE_DEPT_LABELS) as [OfficeDepartment, string][]).map(([value, label]) => ({ value, label }))
const ROLE_OPTS = [{ value: '', label: 'Anyone' }, ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))]

interface Props {
  tasks: OfficeTask[]
  notices: OfficeNotice[]
  team: { id: string; full_name: string }[]
  finance: { budget: number; spent: number; liabilities: number } | null
  userId: string
  role: string
}

const STATUS_ORDER: OfficeTask['status'][] = ['todo', 'in_progress', 'blocked', 'done']
const STATUS_VARIANT: Record<OfficeTask['status'], 'gray' | 'yellow' | 'red' | 'green'> = { todo: 'gray', in_progress: 'yellow', blocked: 'red', done: 'green' }
const PRIORITY_CLS: Record<OfficeTask['priority'], string> = {
  urgent: 'text-red-400 border-red-500/25 bg-red-500/10', high: 'text-amber-400 border-amber-500/25 bg-amber-500/10',
  normal: 'text-[#8888aa] border-[#2a2a3a] bg-[#1a1a24]', low: 'text-[#5a5a7a] border-[#2a2a3a] bg-[#1a1a24]',
}
const EMPTY = { title: '', description: '', department: 'administration', assigned_role: '', assignee_id: '', status: 'todo', priority: 'normal', recurrence: 'none', due_date: '' }

export function OfficeClient({ tasks, notices, team, finance, userId, role }: Props) {
  const router = useRouter()
  const toast = useToast()
  const canManage = ['founder', 'accountant', 'general_manager', 'executive_producer'].includes(role)

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<OfficeTask | null>(null)
  const [form, setForm] = useState(EMPTY)

  const [noticeOpen, setNoticeOpen] = useState(false)
  const [editingNotice, setEditingNotice] = useState<OfficeNotice | null>(null)
  const [nform, setNform] = useState({ title: '', body: '', pinned: true })

  const [deptFilter, setDeptFilter] = useState<OfficeDepartment | 'all'>('all')
  const [mineOnly, setMineOnly] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const isMine = (t: OfficeTask) => t.assignee_id === userId || (t.assigned_role && t.assigned_role === role)
  const openTasks = tasks.filter(t => t.status !== 'done')
  const dueWeek = openTasks.filter(t => t.due_date && t.due_date <= in7)
  const blocked = tasks.filter(t => t.status === 'blocked')
  const myOpen = openTasks.filter(isMine)
  const visible = useMemo(() => tasks.filter(t => (deptFilter === 'all' || t.department === deptFilter) && (!mineOnly || isMine(t))), [tasks, deptFilter, mineOnly]) // eslint-disable-line react-hooks/exhaustive-deps
  const grouped = useMemo(() => STATUS_ORDER.map(s => ({ s, items: visible.filter(t => t.status === s) })), [visible])

  function openNew() { setEditing(null); setForm({ ...EMPTY, department: deptFilter === 'all' ? 'administration' : deptFilter }); setOpen(true) }
  function openEdit(t: OfficeTask) {
    setEditing(t)
    setForm({ title: t.title, description: t.description ?? '', department: t.department, assigned_role: t.assigned_role ?? '', assignee_id: t.assignee_id ?? '', status: t.status, priority: t.priority, recurrence: t.recurrence, due_date: t.due_date ?? '' })
    setOpen(true)
  }

  async function save() {
    if (!form.title.trim()) return toast.error('Title required')
    setSaving(true)
    const supabase = createClient()
    const payload = { title: form.title.trim(), description: form.description || null, department: form.department, assigned_role: form.assigned_role || null, assignee_id: form.assignee_id || null, status: form.status, priority: form.priority, recurrence: form.recurrence, due_date: form.due_date || null }
    if (editing) {
      const { error } = await supabase.from('office_tasks').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('update', 'office_tasks', editing.id)
      toast.success('Task updated')
    } else {
      const { data, error } = await supabase.from('office_tasks').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save — " + error.message.slice(0, 70)); setSaving(false); return }
      if (data) await logAction('create', 'office_tasks', data.id)
      toast.success('Task added')
    }
    setSaving(false); setOpen(false); setEditing(null); router.refresh()
  }

  async function quickStatus(t: OfficeTask, status: OfficeTask['status']) {
    const supabase = createClient()
    await supabase.from('office_tasks').update({ status }).eq('id', t.id)
    await logAction('update', 'office_tasks', t.id, undefined, { status })
    router.refresh()
  }

  async function removeTask(t: OfficeTask) {
    if (!confirm(`Delete task "${t.title}"?`)) return
    const supabase = createClient()
    await supabase.from('office_tasks').delete().eq('id', t.id)
    await logAction('delete', 'office_tasks', t.id)
    toast.success('Deleted'); router.refresh()
  }

  async function saveNotice() {
    if (!nform.title.trim()) return toast.error('Title required')
    setSaving(true)
    const supabase = createClient()
    const payload = { title: nform.title.trim(), body: nform.body || null, pinned: nform.pinned }
    if (editingNotice) {
      await supabase.from('office_notices').update(payload).eq('id', editingNotice.id)
      await logAction('update', 'office_notices', editingNotice.id)
    } else {
      const { data } = await supabase.from('office_notices').insert({ ...payload, created_by: userId }).select().single()
      if (data) await logAction('create', 'office_notices', data.id)
    }
    setSaving(false); setNoticeOpen(false); setEditingNotice(null); setNform({ title: '', body: '', pinned: true }); toast.success('Notice saved'); router.refresh()
  }
  async function removeNotice(n: OfficeNotice) {
    if (!confirm('Delete this notice?')) return
    const supabase = createClient()
    await supabase.from('office_notices').delete().eq('id', n.id)
    await logAction('delete', 'office_notices', n.id)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="OPM Office"
        subtitle="Internal operations — the company's virtual office for the core team"
        action={canManage ? <Button icon={Plus} onClick={openNew}>New Task</Button> : undefined}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Open Tasks" value={openTasks.length} icon={ListTodo} status="default" />
        <StatCard title="Due This Week" value={dueWeek.length} icon={Clock} status={dueWeek.length > 0 ? 'yellow' : 'green'} />
        <StatCard title="Blocked" value={blocked.length} icon={AlertTriangle} status={blocked.length > 0 ? 'red' : 'green'} />
        <StatCard title="Notices" value={notices.length} icon={Megaphone} status="default" />
      </div>

      {/* Office overhead finances (operations entity) */}
      {finance && (
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
            <div className="flex items-center gap-2"><Building2 size={16} className="text-white/70" /><h3 className="text-sm font-semibold text-white">Office Finances</h3><span className="text-xs text-[#8888aa]">· overhead</span></div>
            <Link href="/payments" className="text-xs text-[#8888aa] hover:text-white">Manage in Payments →</Link>
          </div>
          <div className="grid grid-cols-3 divide-x divide-[#2a2a3a]">
            <div className="px-5 py-4"><div className="text-[11px] uppercase tracking-wide text-[#8888aa]">Overhead budget</div><div className="text-lg font-semibold text-white tabular-nums mt-1">{formatCurrency(finance.budget)}</div></div>
            <div className="px-5 py-4"><div className="text-[11px] uppercase tracking-wide text-[#8888aa]">Spent</div><div className="text-lg font-semibold text-red-400 tabular-nums mt-1">{formatCurrency(finance.spent)}</div></div>
            <div className="px-5 py-4"><div className="text-[11px] uppercase tracking-wide text-[#8888aa]">Open liabilities</div><div className="text-lg font-semibold text-amber-400 tabular-nums mt-1">{formatCurrency(finance.liabilities)}</div></div>
          </div>
        </div>
      )}

      {/* Notices */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
          <div className="flex items-center gap-2"><Megaphone size={16} className="text-white/70" /><h3 className="text-sm font-semibold text-white">Notices</h3></div>
          {canManage && <Button size="sm" variant="secondary" icon={Plus} onClick={() => { setEditingNotice(null); setNform({ title: '', body: '', pinned: true }); setNoticeOpen(true) }}>Post Notice</Button>}
        </div>
        {notices.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#8888aa]">No notices. Post announcements for the core team here.</div>
        ) : (
          <div className="divide-y divide-[#2a2a3a]">
            {notices.map(n => (
              <div key={n.id} className="px-5 py-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white flex items-center gap-2">{n.pinned && <Pin size={12} className="text-[#f5b301]" />}{n.title}</div>
                  {n.body && <div className="text-xs text-[#aaaacc] mt-0.5 whitespace-pre-wrap">{n.body}</div>}
                  <div className="text-[11px] text-[#5a5a7a] mt-1">{formatDate(n.created_at)}</div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => { setEditingNotice(n); setNform({ title: n.title, body: n.body ?? '', pinned: n.pinned }); setNoticeOpen(true) }} className="text-[#8888aa] hover:text-white"><Pencil size={14} /></button>
                    <button onClick={() => removeNotice(n)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters: department + My Tasks */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setMineOnly(m => !m)}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${mineOnly ? 'bg-[#f5b301]/15 border-[#f5b301]/40 text-[#f5b301]' : 'bg-[#13131a] border-[#2a2a3a] text-[#8888aa] hover:text-white'}`}>
          <UserCircle size={13} className="inline mr-1 -mt-0.5" /> My Tasks{myOpen.length ? ` (${myOpen.length})` : ''}
        </button>
        <span className="w-px h-5 bg-[#2a2a3a] mx-1" />
        <button onClick={() => setDeptFilter('all')} className={`text-xs px-2.5 py-1.5 rounded-lg border ${deptFilter === 'all' ? 'border-white/40 text-white' : 'border-[#2a2a3a] text-[#8888aa] hover:text-white'}`}>All</button>
        {DEPT_OPTS.filter(d => tasks.some(t => t.department === d.value)).map(d => (
          <button key={d.value} onClick={() => setDeptFilter(d.value)} className={`text-xs px-2.5 py-1.5 rounded-lg border ${deptFilter === d.value ? 'border-white/40 text-white' : 'border-[#2a2a3a] text-[#8888aa] hover:text-white'}`}>{d.label}</button>
        ))}
      </div>

      {/* Tasks by status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {grouped.map(({ s, items }) => (
          <div key={s} className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center justify-between">
              <div className="flex items-center gap-2"><StatusBadge label={OFFICE_TASK_STATUS_LABELS[s]} variant={STATUS_VARIANT[s]} /><span className="text-xs text-[#8888aa]">{items.length}</span></div>
              {s === 'done' && <CheckCircle2 size={14} className="text-emerald-400/70" />}
            </div>
            <div className="divide-y divide-[#2a2a3a] flex-1 min-h-[60px]">
              {items.length === 0 ? <div className="py-6 text-center text-[11px] text-[#5a5a7a]">—</div> : items.map(t => (
                <div key={t.id} className="px-4 py-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm text-white leading-snug">{t.title}</div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_CLS[t.priority]}`}>{t.priority}</span>
                        <span className="text-[10px] text-[#8888aa]">{OFFICE_DEPT_LABELS[t.department]}</span>
                        {t.assigned_role && <span className="text-[10px] text-[#f5b301] inline-flex items-center gap-0.5"><UserCircle size={10} /> {ROLE_LABELS[t.assigned_role]}</span>}
                        {t.assignee?.full_name && <span className="text-[10px] text-[#aaaacc]">· {t.assignee.full_name}</span>}
                        {t.recurrence !== 'none' && <span className="text-[10px] text-[#8888aa] inline-flex items-center gap-0.5"><RefreshCw size={9} /> {t.recurrence}</span>}
                      </div>
                      {t.due_date && <div className={`text-[11px] mt-1 ${t.due_date <= today && t.status !== 'done' ? 'text-amber-400' : 'text-[#5a5a7a]'}`}>due {formatDate(t.due_date)}</div>}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(t)} className="text-[#8888aa] hover:text-white"><Pencil size={13} /></button>
                        <button onClick={() => removeTask(t)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                  {canManage && (
                    <select value={t.status} onChange={e => quickStatus(t, e.target.value as OfficeTask['status'])}
                      className="mt-2 w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-md px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-white/40">
                      {STATUS_ORDER.map(o => <option key={o} value={o}>{OFFICE_TASK_STATUS_LABELS[o]}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Task modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Task' : 'New Task'}>
        <div className="space-y-3">
          <Input label="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. File GST return for May" />
          <Textarea label="Details" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} options={DEPT_OPTS} />
            <Select label="Assign to role" value={form.assigned_role} onChange={e => setForm({ ...form, assigned_role: e.target.value })} options={ROLE_OPTS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Specific person (optional)" value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })}
              options={[{ value: '', label: 'Anyone in the role' }, ...team.map(m => ({ value: m.id, label: m.full_name }))]} />
            <Select label="Recurs" value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })}
              options={[{ value: 'none', label: 'One-off' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'annual', label: 'Annual' }]} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STATUS_ORDER.map(s => ({ value: s, label: OFFICE_TASK_STATUS_LABELS[s] }))} />
            <Select label="Priority" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} />
            <Input label="Due" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>{editing ? 'Save' : 'Add Task'}</Button></div>
        </div>
      </Modal>

      {/* Notice modal */}
      <Modal open={noticeOpen} onClose={() => setNoticeOpen(false)} title={editingNotice ? 'Edit Notice' : 'Post Notice'}>
        <div className="space-y-3">
          <Input label="Title *" value={nform.title} onChange={e => setNform({ ...nform, title: e.target.value })} />
          <Textarea label="Message" value={nform.body} onChange={e => setNform({ ...nform, body: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-white cursor-pointer"><input type="checkbox" checked={nform.pinned} onChange={e => setNform({ ...nform, pinned: e.target.checked })} className="h-4 w-4 accent-amber-400" /><Pin size={13} className="text-[#f5b301]" /> Pin to top</label>
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setNoticeOpen(false)}>Cancel</Button><Button onClick={saveNotice} loading={saving}>{editingNotice ? 'Save' : 'Post'}</Button></div>
        </div>
      </Modal>
    </div>
  )
}
