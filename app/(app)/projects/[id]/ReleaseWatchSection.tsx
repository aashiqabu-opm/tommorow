'use client'

import { useState } from 'react'
import { ShieldAlert, Sparkles, ExternalLink, X, Film, MessageSquareWarning, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { SEVERITY_VARIANT, releaseWindow } from '@/lib/phases'
import type { MonitoringFinding } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  findings: MonitoringFinding[]
  releaseDate: string | null
  status: string
  aiStatusAt: string | null
  canManage: boolean
}

export function ReleaseWatchSection({ projectId, findings, releaseDate, status, aiStatusAt, canManage }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [scanning, setScanning] = useState(false)
  const [editDate, setEditDate] = useState(false)
  const [dateVal, setDateVal] = useState(releaseDate ?? '')
  const win = releaseWindow({ release_date: releaseDate, status, ai_status_at: aiStatusAt })

  async function saveDate() {
    const supabase = createClient()
    const v = dateVal || null
    const { error } = await supabase.from('projects').update({ release_date: v }).eq('id', projectId)
    if (error) { toast.error("Couldn't save — check migration-release-date.sql is run"); return }
    await logAction('update', 'projects', projectId, { release_date: releaseDate }, { release_date: v })
    toast.success('Release date saved')
    setEditDate(false); router.refresh()
  }

  const active = findings.filter(f => !f.dismissed)
  const piracy = active.filter(f => f.category === 'piracy')
  const reputation = active.filter(f => f.category === 'reputation')
  const lastScan = findings[0]?.scan_date

  async function scan() {
    setScanning(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/intel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scan' }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Scan failed'); setScanning(false); return }
      toast.success(data.count ? `Scan done — ${data.count} finding${data.count > 1 ? 's' : ''}` : 'Scan done — nothing flagged')
      router.refresh()
    } catch { toast.error('Scan failed') }
    setScanning(false)
  }

  async function dismiss(f: MonitoringFinding) {
    const supabase = createClient()
    await supabase.from('monitoring_findings').update({ dismissed: true }).eq('id', f.id)
    router.refresh()
  }

  const Group = ({ title, icon: Icon, items }: { title: string; icon: typeof Film; items: MonitoringFinding[] }) => (
    <div>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-[#8888aa] uppercase tracking-wide"><Icon size={13} /> {title} · {items.length}</div>
      {items.length === 0 ? (
        <div className="text-xs text-emerald-400/70 pb-2">Nothing flagged.</div>
      ) : (
        <div className="space-y-2">
          {items.map(f => (
            <div key={f.id} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge label={f.severity} variant={SEVERITY_VARIANT[f.severity] ?? 'gray'} />
                    <span className="text-sm text-white">{f.title}</span>
                  </div>
                  {f.detail && <p className="text-xs text-[#8888aa] mt-1 leading-relaxed">{f.detail}</p>}
                  {f.url && <a href={f.url} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1 mt-1 break-all"><ExternalLink size={10} /> {f.url.slice(0, 60)}</a>}
                </div>
                {canManage && <button onClick={() => dismiss(f)} title="Dismiss" className="text-[#3a3a4a] hover:text-white shrink-0"><X size={15} /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-white/70" />
          <h3 className="text-sm font-semibold text-white">Release Watch</h3>
          <span className="text-xs text-[#8888aa]">· piracy & reputation</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge label={win.active ? `Monitoring on · ${win.reason}` : `Paused · ${win.reason}`} variant={win.active ? 'green' : 'gray'} />
          {canManage && <Button size="sm" variant="secondary" icon={Sparkles} loading={scanning} onClick={scan}>Scan now</Button>}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Release date + window explanation */}
        <div className="flex items-center justify-between gap-2 bg-[#1a1a24] rounded-xl px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-xs text-[#c8c8da]">
            <Calendar size={13} className="text-white/60" />
            {editDate ? (
              <div className="flex items-center gap-2">
                <Input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)} />
                <Button size="sm" onClick={saveDate}>Save</Button>
                <Button size="sm" variant="secondary" onClick={() => { setEditDate(false); setDateVal(releaseDate ?? '') }}>Cancel</Button>
              </div>
            ) : (
              <span>Release date: <span className="text-white font-medium">{releaseDate ? formatDate(releaseDate) : 'not set'}</span></span>
            )}
          </div>
          {canManage && !editDate && (
            <button onClick={() => setEditDate(true)} className="text-xs text-indigo-300 hover:text-indigo-200">{releaseDate ? 'Change' : 'Set date'}</button>
          )}
        </div>
        <p className="text-[11px] text-[#5a5a7a]">
          The daily AI scan runs only during the release window (release day −3 to +30) to save cost — it&apos;s {win.active ? 'active now' : 'paused outside that window'}. Use “Scan now” anytime. {lastScan ? `Last scan ${formatDate(lastScan)}.` : 'No scan yet.'} Findings are leads to verify, not verdicts.
        </p>
        <Group title="Piracy & leaks" icon={Film} items={piracy} />
        <Group title="Reputation & hate campaigns" icon={MessageSquareWarning} items={reputation} />
      </div>
    </div>
  )
}
