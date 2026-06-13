'use client'

import { useState } from 'react'
import { ClipboardCheck, Send, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate, PROJECT_ROLE_LABELS } from '@/lib/utils'
import type { ProjectCheckin } from '@/lib/types'
import { useRouter } from 'next/navigation'

const APP_ROLE_LABELS: Record<string, string> = {
  founder: 'Founder', accountant: 'Accountant', general_manager: 'General Manager',
  executive_producer: 'Executive Producer', legal_viewer: 'Legal/CA', staff: 'Field Staff',
}

interface Props {
  projectId: string
  checkins: ProjectCheckin[]
  userId: string
  role: string
  canPost: boolean   // member of project OR management
}

export function ProjectCheckinSection({ projectId, checkins, userId, role, canPost }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [summary, setSummary] = useState('')
  const [blockers, setBlockers] = useState('')
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const postedToday = checkins.some(c => c.author_id === userId && c.checkin_date === today)

  async function post(e: React.FormEvent) {
    e.preventDefault()
    if (!summary.trim()) return toast.error('Write what you did today')
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('project_checkins').insert({
      project_id: projectId, author_id: userId,
      checkin_date: today, summary: summary.trim(), blockers: blockers.trim() || null,
    }).select().single()
    if (error) {
      const hint = /relation .*project_checkins.* does not exist/i.test(error.message)
        ? 'run migration-project-team.sql first' : error.message
      toast.error(`Couldn't post — ${String(hint).slice(0, 90)}`); setSaving(false); return
    }
    if (data) await logAction('create', 'project_checkins', data.id, undefined, data)
    toast.success('Check-in posted')
    setSummary(''); setBlockers(''); setSaving(false)
    router.refresh()
  }

  async function remove(c: ProjectCheckin) {
    if (!window.confirm('Delete this check-in?')) return
    const supabase = createClient()
    const { error } = await supabase.from('project_checkins').delete().eq('id', c.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'project_checkins', c.id, undefined, undefined)
    router.refresh()
  }

  // Group by date for a clean timeline
  const byDate = checkins.reduce<Record<string, ProjectCheckin[]>>((acc, c) => {
    (acc[c.checkin_date] ??= []).push(c); return acc
  }, {})
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center gap-2">
        <ClipboardCheck size={16} className="text-white/70" />
        <h3 className="text-sm font-semibold text-white">Daily Check-ins</h3>
        <span className="text-xs text-[#8888aa]">· team reports to the producer</span>
      </div>

      {canPost && (
        <form onSubmit={post} className="px-5 py-4 border-b border-[#2a2a3a] space-y-3">
          {postedToday && (
            <p className="text-[11px] text-emerald-400">You already checked in today — posting again adds another update.</p>
          )}
          <Textarea label="What did you do today? *" rows={2} value={summary}
            onChange={e => setSummary(e.target.value)} placeholder="e.g. Locked the temple location, completed 3 scenes, 42 crew on set" />
          <Textarea label="Any blockers or needs? (optional)" rows={1} value={blockers}
            onChange={e => setBlockers(e.target.value)} placeholder="e.g. Need ₹20k petty cash top-up for tomorrow's transport" />
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={saving} icon={Send}>Post Check-in</Button>
          </div>
        </form>
      )}

      {dates.length === 0 ? (
        <div className="py-8 text-center text-sm text-[#8888aa]">No check-ins yet.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {dates.map(date => (
            <div key={date} className="px-5 py-4">
              <div className="text-[11px] font-semibold text-[#8888aa] uppercase tracking-wide mb-2">{formatDate(date)}</div>
              <div className="space-y-3">
                {byDate[date].map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {(c.author?.full_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{c.author?.full_name ?? 'Unknown'}</span>
                        <span className="text-[10px] text-[#8888aa] uppercase tracking-wide">{APP_ROLE_LABELS[c.author?.role ?? ''] ?? ''}</span>
                        {(c.author_id === userId || role === 'founder') && (
                          <button onClick={() => remove(c)} className="ml-auto text-[#5a5a7a] hover:text-red-400"><Trash2 size={13} /></button>
                        )}
                      </div>
                      <p className="text-sm text-[#c8c8da] mt-0.5 whitespace-pre-wrap">{c.summary}</p>
                      {c.blockers && (
                        <p className="text-xs text-amber-400/90 mt-1 flex items-start gap-1.5">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {c.blockers}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
