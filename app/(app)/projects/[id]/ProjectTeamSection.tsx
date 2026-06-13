'use client'

import { useState } from 'react'
import { Users, UserPlus, Trash2, ShieldCheck } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { PROJECT_ROLE_LABELS, PROJECT_ROLE_CAPS } from '@/lib/utils'
import type { ProjectMember, ProjectRole } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Candidate { id: string; full_name: string; email: string; role: string }

interface Props {
  projectId: string
  members: ProjectMember[]
  candidates: Candidate[]
  userId: string
  canManage: boolean
}

const ROLE_OPTIONS = Object.entries(PROJECT_ROLE_LABELS).map(([value, label]) => ({ value, label }))

// One-line summary of what a project role can do, from the caps map.
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

export function ProjectTeamSection({ projectId, members, candidates, userId, canManage }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ user_id: '', project_role: 'production_assistant' as ProjectRole, title: '' })

  // Users not already on the team
  const onTeam = new Set(members.map(m => m.user_id))
  const available = candidates.filter(c => !onTeam.has(c.id))

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!form.user_id) return toast.error('Pick a person')
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('project_members').insert({
      project_id: projectId, user_id: form.user_id,
      project_role: form.project_role, title: form.title.trim() || null, added_by: userId,
    }).select().single()
    if (error) {
      const hint = /relation .*project_members.* does not exist/i.test(error.message)
        ? 'run migration-project-team.sql first' : error.message
      toast.error(`Couldn't add — ${String(hint).slice(0, 90)}`); setSaving(false); return
    }
    if (data) await logAction('create', 'project_members', data.id, undefined, data)
    toast.success('Added to the team')
    setSaving(false); setOpen(false); setForm({ user_id: '', project_role: 'production_assistant', title: '' })
    router.refresh()
  }

  async function remove(m: ProjectMember) {
    if (!window.confirm(`Remove ${m.profile?.full_name ?? 'this member'} from the team?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('project_members').delete().eq('id', m.id)
    if (error) { toast.error("Couldn't remove — you may not have permission"); return }
    await logAction('delete', 'project_members', m.id, undefined, undefined)
    router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-white/70" />
          <h3 className="text-sm font-semibold text-white">Core Team</h3>
          <span className="text-xs text-[#8888aa]">· {members.length}</span>
        </div>
        {canManage && <Button size="sm" icon={UserPlus} onClick={() => setOpen(true)}>Add Member</Button>}
      </div>

      {members.length === 0 ? (
        <div className="py-8 text-center text-sm text-[#8888aa]">
          No team yet.{canManage ? ' Add your Chief AD, production managers, cashier, location managers and drivers.' : ''}
        </div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {members.map(m => (
            <div key={m.id} className="px-5 py-3.5 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {(m.profile?.full_name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{m.profile?.full_name ?? 'Unknown'}</span>
                  <span className="text-[10px] text-white/80 uppercase tracking-wide bg-white/10 border border-white/15 rounded px-1.5 py-0.5">
                    {m.title || PROJECT_ROLE_LABELS[m.project_role] || m.project_role}
                  </span>
                </div>
                <div className="text-xs text-[#8888aa] truncate flex items-center gap-1.5">
                  <ShieldCheck size={11} className="shrink-0" /> {capSummary(m.project_role)}
                </div>
              </div>
              {canManage && (
                <button onClick={() => remove(m)} className="text-[#5a5a7a] hover:text-red-400 shrink-0"><Trash2 size={15} /></button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add Team Member">
        <form onSubmit={addMember} className="space-y-4">
          {available.length === 0 ? (
            <p className="text-sm text-[#8888aa]">
              Everyone is already on this team. Invite more people from the <span className="text-white">Users</span> page first.
            </p>
          ) : (
            <>
              <Select label="Person *" value={form.user_id} onChange={e => setForm({ ...form, user_id: e.target.value })}
                options={[{ value: '', label: 'Select a person…' }, ...available.map(c => ({ value: c.id, label: `${c.full_name} (${c.email})` }))]} />
              <Select label="Project Role *" value={form.project_role} onChange={e => setForm({ ...form, project_role: e.target.value as ProjectRole })}
                options={ROLE_OPTIONS} />
              <p className="text-[11px] text-[#5a5a7a] -mt-2">{capSummary(form.project_role)}</p>
              <Input label="Title / Designation (optional)" placeholder="e.g. 2nd Unit Cashier"
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            {available.length > 0 && <Button type="submit" loading={saving} icon={UserPlus}>Add</Button>}
          </div>
        </form>
      </Modal>
    </div>
  )
}
