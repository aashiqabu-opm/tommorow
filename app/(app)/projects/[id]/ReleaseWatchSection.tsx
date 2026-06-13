'use client'

import { useState } from 'react'
import { ShieldAlert, Sparkles, ExternalLink, X, Film, MessageSquareWarning } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { SEVERITY_VARIANT } from '@/lib/phases'
import type { MonitoringFinding } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  findings: MonitoringFinding[]
  canManage: boolean
}

export function ReleaseWatchSection({ projectId, findings, canManage }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [scanning, setScanning] = useState(false)

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
        {canManage && <Button size="sm" variant="secondary" icon={Sparkles} loading={scanning} onClick={scan}>Scan now</Button>}
      </div>

      <div className="p-5 space-y-4">
        <p className="text-[11px] text-[#5a5a7a]">
          AI scans the web daily for leaked/pirated copies and coordinated hate campaigns. {lastScan ? `Last scan ${formatDate(lastScan)}.` : 'No scan yet — run one or wait for the daily check.'} Findings are leads to verify, not verdicts.
        </p>
        <Group title="Piracy & leaks" icon={Film} items={piracy} />
        <Group title="Reputation & hate campaigns" icon={MessageSquareWarning} items={reputation} />
      </div>
    </div>
  )
}
