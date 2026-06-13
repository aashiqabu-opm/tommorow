'use client'

import { useState } from 'react'
import { Plus, Trash2, Check, ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { PHASES, DEFAULT_MILESTONES, currentPhase } from '@/lib/phases'
import type { PhaseTask, ProjectPhase } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  status: string
  tasks: PhaseTask[]
  userId: string
  canManage: boolean
}

export function PhaseTracker({ projectId, status, tasks, userId, canManage }: Props) {
  const router = useRouter()
  const toast = useToast()
  const active = currentPhase(status)
  const [openPhase, setOpenPhase] = useState<ProjectPhase>(active)
  const [busy, setBusy] = useState(false)
  const [addTo, setAddTo] = useState<ProjectPhase | null>(null)
  const [newTitle, setNewTitle] = useState('')

  const byPhase = (ph: ProjectPhase) => tasks.filter(t => t.phase === ph).sort((a, b) => a.sort_order - b.sort_order)

  async function toggle(t: PhaseTask) {
    const supabase = createClient()
    const { error } = await supabase.from('phase_tasks')
      .update({ done: !t.done, done_at: !t.done ? new Date().toISOString() : null }).eq('id', t.id)
    if (error) { toast.error("Couldn't update — check migration-tracking.sql is run"); return }
    router.refresh()
  }

  // Seed or top-up: adds only the standard milestones not already present
  // (case-insensitive), so existing ticks are never wiped.
  async function seed(ph: ProjectPhase) {
    setBusy(true)
    const existingItems = byPhase(ph)
    const have = new Set(existingItems.map(t => t.title.trim().toLowerCase()))
    const missing = DEFAULT_MILESTONES[ph].filter(t => !have.has(t.trim().toLowerCase()))
    if (missing.length === 0) { toast.success('Already up to date'); setBusy(false); return }
    const supabase = createClient()
    const rows = missing.map((title, i) => ({
      project_id: projectId, phase: ph, title, sort_order: existingItems.length + i, created_by: userId,
    }))
    const { error } = await supabase.from('phase_tasks').insert(rows)
    if (error) {
      const hint = /relation .*phase_tasks.* does not exist/i.test(error.message) ? 'run migration-tracking.sql first' : error.message
      toast.error(`Couldn't add — ${String(hint).slice(0, 80)}`); setBusy(false); return
    }
    await logAction('create', 'phase_tasks', projectId, undefined, { phase: ph, seeded: rows.length })
    toast.success(`Added ${missing.length} standard milestone${missing.length > 1 ? 's' : ''}`)
    setBusy(false); router.refresh()
  }

  async function addTask(ph: ProjectPhase) {
    if (!newTitle.trim()) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('phase_tasks').insert({
      project_id: projectId, phase: ph, title: newTitle.trim(), sort_order: byPhase(ph).length, created_by: userId,
    })
    if (error) { toast.error("Couldn't add task"); setBusy(false); return }
    setNewTitle(''); setAddTo(null); setBusy(false); router.refresh()
  }

  async function remove(t: PhaseTask) {
    const supabase = createClient()
    const { error } = await supabase.from('phase_tasks').delete().eq('id', t.id)
    if (error) { toast.error("Couldn't delete"); return }
    router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center gap-2">
        <ListChecks size={16} className="text-white/70" />
        <h3 className="text-sm font-semibold text-white">Production Tracker</h3>
      </div>

      {/* Stepper */}
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center gap-1.5 overflow-x-auto">
        {PHASES.map((p, i) => {
          const items = byPhase(p.key)
          const done = items.filter(t => t.done).length
          const pct = items.length ? Math.round((done / items.length) * 100) : 0
          const isActive = p.key === active
          const isPast = PHASES.findIndex(x => x.key === active) > i
          return (
            <div key={p.key} className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => setOpenPhase(p.key)}
                className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ${openPhase === p.key ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                  isActive ? 'bg-white text-black border-white' : isPast || pct === 100 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-[#1a1a24] text-[#8888aa] border-[#2a2a3a]'}`}>
                  {pct === 100 && items.length ? <Check size={13} /> : i + 1}
                </div>
                <span className={`text-[10px] whitespace-nowrap ${isActive ? 'text-white font-medium' : 'text-[#8888aa]'}`}>{p.short}</span>
                {items.length > 0 && <span className="text-[9px] text-[#5a5a7a]">{pct}%</span>}
              </button>
              {i < PHASES.length - 1 && <div className={`w-5 h-px ${isPast ? 'bg-emerald-500/40' : 'bg-[#2a2a3a]'}`} />}
            </div>
          )
        })}
      </div>

      {/* Selected phase checklist */}
      {PHASES.filter(p => p.key === openPhase).map(p => {
        const items = byPhase(p.key)
        return (
          <div key={p.key} className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-white">{p.label}
                {p.key === active && <span className="ml-2 text-[10px] uppercase tracking-wide text-emerald-400">current</span>}
              </div>
              {canManage && (
                <Button size="sm" variant="secondary" loading={busy} onClick={() => seed(p.key)}>
                  {items.length === 0 ? 'Add standard milestones' : 'Add missing standard items'}
                </Button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="text-xs text-[#5a5a7a] py-3">No milestones yet for this phase.</div>
            ) : (
              <div className="space-y-1">
                {items.map(t => (
                  <div key={t.id} className="flex items-center gap-3 group">
                    <button onClick={() => canManage && toggle(t)} disabled={!canManage}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        t.done ? 'bg-emerald-500 border-emerald-500' : 'border-[#3a3a4a] hover:border-white/40'} ${canManage ? 'cursor-pointer' : 'cursor-default'}`}>
                      {t.done && <Check size={11} className="text-white" />}
                    </button>
                    <span className={`text-sm flex-1 ${t.done ? 'text-[#5a5a7a] line-through' : 'text-[#c8c8da]'}`}>{t.title}</span>
                    {canManage && (
                      <button onClick={() => remove(t)} className="text-[#3a3a4a] hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canManage && (
              addTo === p.key ? (
                <form onSubmit={e => { e.preventDefault(); addTask(p.key) }} className="flex gap-2 mt-3">
                  <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="New milestone…" autoFocus />
                  <Button type="submit" size="sm" loading={busy}>Add</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => { setAddTo(null); setNewTitle('') }}>Cancel</Button>
                </form>
              ) : (
                <button onClick={() => setAddTo(p.key)} className="mt-3 text-xs text-[#8888aa] hover:text-white flex items-center gap-1.5">
                  <Plus size={13} /> Add milestone
                </button>
              )
            )}
          </div>
        )
      })}
    </div>
  )
}
