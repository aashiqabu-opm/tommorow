'use client'

import { useState } from 'react'
import { Newspaper, Sparkles, ExternalLink, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import type { IndustryBriefRecord } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props { briefs: IndustryBriefRecord[]; canRefresh: boolean }

export function MarketClient({ briefs, canRefresh }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setBusy(true)
    try {
      const res = await fetch('/api/market/refresh', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Could not refresh'); setBusy(false); return }
      toast.success('Market brief updated')
      router.refresh()
    } catch { toast.error('Could not refresh') }
    setBusy(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Market" subtitle="Weekly Malayalam industry brief — releases, collections & news"
        action={canRefresh ? <Button icon={Sparkles} loading={busy} onClick={refresh}>Refresh brief</Button> : undefined} />

      {briefs.length === 0 ? (
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl py-12 text-center">
          <Newspaper size={28} className="text-[#3a3a4a] mx-auto mb-3" />
          <div className="text-sm text-[#8888aa]">No market brief yet.</div>
          {canRefresh && <div className="text-xs text-[#5a5a7a] mt-1">Hit “Refresh brief” to pull this week’s Malayalam releases & news, or wait for the weekly Monday digest.</div>}
        </div>
      ) : (
        <div className="space-y-5">
          {briefs.map((b, idx) => (
            <div key={b.id} className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Newspaper size={15} className="text-white/70" />
                  <h3 className="text-sm font-semibold text-white">Week of {formatDate(b.week_of)}</h3>
                  {idx === 0 && <span className="text-[10px] uppercase tracking-wide text-emerald-400">latest</span>}
                </div>
              </div>
              <div className="p-5 space-y-4">
                {b.headline && <div className="text-sm font-medium text-white">{b.headline}</div>}
                {b.summary && <p className="text-sm text-[#c8c8da] leading-relaxed whitespace-pre-wrap">{b.summary}</p>}
                {b.items && b.items.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {b.items.map((it, i) => (
                      <div key={i} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">{it.film}</span>
                          {it.collection && <span className="text-xs text-emerald-400 tabular-nums">{it.collection}</span>}
                          {it.trend && <span className="text-[11px] text-[#8888aa] inline-flex items-center gap-1"><TrendingUp size={11} /> {it.trend}</span>}
                        </div>
                        {it.note && <p className="text-xs text-[#8888aa] mt-1 leading-relaxed">{it.note}</p>}
                        {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1 mt-1"><ExternalLink size={10} /> source</a>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-[#5a5a7a] text-center">
        Market info is gathered from public sources by AI and may be incomplete or dated — treat as a snapshot, verify before acting.
      </p>
    </div>
  )
}
