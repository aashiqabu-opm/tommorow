'use client'

import { useState } from 'react'
import { Newspaper, Sparkles, Film, Clock } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { BarChart } from '@/components/ui/BarChart'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import type { IndustryFilm } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props { films: IndustryFilm[]; canRefresh: boolean }

const crore = (n: number | null) => n == null ? '—' : `₹${(n / 10000000).toFixed(2)} Cr`

function daysSince(d: string | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

export function MarketClient({ films, canRefresh }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setBusy(true)
    try {
      const res = await fetch('/api/market/refresh', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Could not refresh'); setBusy(false); return }
      toast.success(`Updated — ${data.added} new, ${data.updated} refreshed`)
      router.refresh()
    } catch { toast.error('Could not refresh') }
    setBusy(false)
  }

  // Films still inside their first week show first
  const tracking = films.filter(f => { const d = daysSince(f.release_date); return d != null && d >= 0 && d <= 7 })
  const past = films.filter(f => !tracking.includes(f))

  const Card = ({ f }: { f: IndustryFilm }) => {
    const d = daysSince(f.release_date)
    const live = d != null && d >= 0 && d <= 7
    const days = (f.days ?? []).slice().sort((a, b) => a.day - b.day)
    const chart = days.map(x => ({ label: `D${x.day}`, value: x.india_net ?? 0 }))
    return (
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#2a2a3a] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Film size={14} className="text-white/60 shrink-0" />
            <span className="text-sm font-semibold text-white truncate">{f.title}</span>
            {live && <span className="text-[10px] uppercase tracking-wide text-emerald-400 shrink-0">day {Math.min((d ?? 0) + 1, 7)}/7</span>}
          </div>
          {f.release_date && <span className="text-[11px] text-[#8888aa] shrink-0">{formatDate(f.release_date)}</span>}
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-4">
            <div><div className="text-[10px] text-[#8888aa] uppercase tracking-wide">India net (cum.)</div><div className="text-lg font-bold text-white tabular-nums">{crore(f.total_india)}</div></div>
            {f.last_checked && <div className="text-[10px] text-[#5a5a7a] inline-flex items-center gap-1 ml-auto"><Clock size={9} /> {formatDate(f.last_checked)}</div>}
          </div>
          {f.ai_note && <p className="text-xs text-[#c8c8da] leading-relaxed">{f.ai_note}</p>}
          {chart.length > 0 && <BarChart data={chart} formatValue={v => crore(v)} height={90} />}
          {days.length > 0 && (
            <div className="grid grid-cols-7 gap-1">
              {days.map(x => (
                <div key={x.day} className="text-center bg-[#1a1a24] rounded-lg py-1.5">
                  <div className="text-[9px] text-[#5a5a7a]">D{x.day}</div>
                  <div className="text-[10px] text-white tabular-nums">{x.india_net != null ? `${(x.india_net / 10000000).toFixed(1)}` : '—'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Market" subtitle="Every new Malayalam release, tracked day 1–7"
        action={canRefresh ? <Button icon={Sparkles} loading={busy} onClick={refresh}>Refresh now</Button> : undefined} />

      {films.length === 0 ? (
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl py-12 text-center">
          <Newspaper size={28} className="text-[#3a3a4a] mx-auto mb-3" />
          <div className="text-sm text-[#8888aa]">No releases tracked yet.</div>
          {canRefresh && <div className="text-xs text-[#5a5a7a] mt-1">Hit “Refresh now” to pull this week’s Malayalam releases, or wait for the daily check.</div>}
        </div>
      ) : (
        <>
          {tracking.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Now tracking (first week)</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{tracking.map(f => <Card key={f.id} f={f} />)}</div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#8888aa] mb-3">Earlier releases</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{past.map(f => <Card key={f.id} f={f} />)}</div>
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-[#5a5a7a] text-center">
        Collections are gathered from public sources by AI and may be incomplete or dated — treat as a snapshot, verify before acting.
      </p>
    </div>
  )
}
