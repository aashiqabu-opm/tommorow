'use client'

import { useState } from 'react'
import { Users, UserPlus, Trash2, ShieldCheck, Mail, Phone, Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { PROJECT_ROLE_LABELS, PROJECT_ROLE_CAPS, TEAM_GROUP_LABELS } from '@/lib/utils'
import type { ProjectMember, ProjectRole } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  members: ProjectMember[]
  userId: string
  canManage: boolean
}

const ROLE_OPTIONS = Object.entries(PROJECT_ROLE_LABELS).map(([value, label]) => ({ value, label }))
const TEAM_OPTIONS = Object.entries(TEAM_GROUP_LABELS).map(([value, label]) => ({ value, label }))
const GROUPS = ['pre_production', 'production', 'post_production'] as const

function capSummary(role: string): string {
  const c = PROJECT_ROLE_CAPS[role] ?? {}
  if (c.fullView) return 'Full project view'
  const parts: string[] = []
  if (c.pettyCash) parts.push('petty cash')
  if (c.payments) parts.push('payment requests')
  if (c.dpr) parts.push('daily reports')
  if (c.vehicles) parts.push('vehicle logs')
  return parts.length ? `Can post: ${parts.join(', ')}` : 'Check-ins only'
}

export function ProjectTeamSection({ projectId, members, userId, canManage }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<ProjectMember | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', project_role: 'production_assistant' as ProjectRole, team_group: 'production', title: '' })

  function openNew() {
    setEditing(null)
    setForm({ name: '', email: '', phone: '', project_role: 'production_assistant', team_group: 'production', title: '' })
    setOpen(true)
  }
  function openEdit(m: ProjectMember) {
    setEditing(m)
    setForm({
      name: m.member_name ?? m.profile?.full_name ?? '', email: m.member_email ?? '', phone: m.member_phone ?? '',
      project_role: m.project_role, team_group: m.team_group ?? 'production', title: m.title ?? '',
    })
    setOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Enter a name')
    setSaving(true)
    // Edit existing member — update the row directly (RLS gates write).
    if (editing) {
      const supabase = createClient()
      const patch: Record<string, unknown> = { project_role: form.project_role, team_group: form.team_group, title: form.title || null, member_phone: form.phone || null }
      // Only update the contact name/email for contact-only members (no linked login).
      if (!editing.user_id) { patch.member_name = form.name; patch.member_email = form.email || null }
      const { error } = await supabase.from('project_members').update(patch).eq('id', editing.id)
      if (error) { toast.error("Couldn't save — you may not have permission"); setSaving(false); return }
      await logAction('update', 'project_members', editing.id, undefined, patch)
      toast.success('Member updated')
      setSaving(false); setOpen(false); setEditing(null); router.refresh()
      return
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/team`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Could not add'); setSaving(false); return }
      await logAction('create', 'project_members', data.member?.id ?? projectId, undefined, { name: form.name, role: form.project_role })
      toast.success(data.invited ? `${form.name} added — project login emailed` : `${form.name} added to the team`)
      setSaving(false); setOpen(false)
      setForm({ name: '', email: '', phone: '', project_role: 'production_assistant', team_group: 'production', title: '' })
      router.refresh()
    } catch { toast.error('Could not add'); setSaving(false) }
  }

  async function remove(m: ProjectMember) {
    const who = m.profile?.full_name ?? m.member_name ?? 'this member'
    if (!window.confirm(`Remove ${who} from the team?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('project_members').delete().eq('id', m.id)
    if (error) { toast.error("Couldn't remove — you may not have permission"); return }
    await logAction('delete', 'project_members', m.id, undefined, undefined)
    router.refresh()
  }

  const grouped = GROUPS.map(g => ({ g, items: members.filter(m => (m.team_group ?? 'production') === g) })).filter(x => x.items.length > 0)

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-white/70" />
          <h3 className="text-sm font-semibold text-white">Core Team</h3>
          <span className="text-xs text-[#8888aa]">· {members.length}</span>
        </div>
        {canManage && <Button size="sm" icon={UserPlus} onClick={openNew}>Add Member</Button>}
      </div>

      {members.length === 0 ? (
        <div className="py-8 text-center text-sm text-[#8888aa]">
          No team yet.{canManage ? ' Add your director, DOP, crew and post team — each gets a project login.' : ''}
        </div>
      ) : (
        <div>
          {grouped.map(({ g, items }) => (
            <div key={g}>
              <div className="px-5 py-2 bg-[#1a1a24]/60 border-b border-[#2a2a3a] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8888aa]">
                {TEAM_GROUP_LABELS[g]} · {items.length}
              </div>
              <div className="divide-y divide-[#2a2a3a]">
                {items.map(m => {
                  const who = m.profile?.full_name ?? m.member_name ?? 'Unknown'
                  return (
                    <div key={m.id} className="px-5 py-3.5 flex items-center gap-4">
                      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {who.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white truncate">{who}</span>
                          <span className="text-[10px] text-white/80 uppercase tracking-wide bg-white/10 border border-white/15 rounded px-1.5 py-0.5">
                            {m.title || PROJECT_ROLE_LABELS[m.project_role] || m.project_role}
                          </span>
                        </div>
                        <div className="text-xs text-[#8888aa] truncate flex items-center gap-3 mt-0.5">
                          {m.member_email && <span className="inline-flex items-center gap-1"><Mail size={11} /> {m.member_email}</span>}
                          {m.member_phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {m.member_phone}</span>}
                          {!m.member_email && !m.member_phone && <span className="inline-flex items-center gap-1"><ShieldCheck size={11} /> {capSummary(m.project_role)}</span>}
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-3 shrink-0">
                          <button onClick={() => openEdit(m)} className="text-[#5a5a7a] hover:text-white"><Pencil size={15} /></button>
                          <button onClick={() => remove(m)} className="text-[#5a5a7a] hover:text-red-400"><Trash2 size={15} /></button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Team Member' : 'Add Team Member'}>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" disabled={!!editing?.user_id} />
          {editing?.user_id && <p className="text-[11px] text-[#5a5a7a] -mt-2">Name & email come from this member&apos;s login account and can&apos;t be changed here.</p>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" disabled={!!editing?.user_id} />
            <Input label="Mobile" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Role *" value={form.project_role} onChange={e => setForm({ ...form, project_role: e.target.value as ProjectRole })} options={ROLE_OPTIONS} />
            <Select label="Team *" value={form.team_group} onChange={e => setForm({ ...form, team_group: e.target.value })} options={TEAM_OPTIONS} />
          </div>
          <p className="text-[11px] text-[#5a5a7a] -mt-1">{capSummary(form.project_role)}</p>
          <Input label="Title / Designation (optional)" placeholder="e.g. 2nd Unit DOP" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          {!editing && <p className="text-[11px] text-[#8888aa] bg-[#1a1a24] rounded-lg p-2.5">With an email, they get a <span className="text-white">project-only login</span> + the team channel — auto-switched off a week after release.</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving} icon={editing ? Pencil : UserPlus}>{editing ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
