'use client'

import { useState } from 'react'
import { Newspaper, Sparkles, Film, Clock, Activity } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { BarChart } from '@/components/ui/BarChart'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import { WEB_SEARCH_ENABLED } from '@/lib/flags'
import type { IndustryFilm } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props { films: IndustryFilm[]; canRefresh: boolean }

function Stat({ label, value, bad }: { label: string; value: string | number; bad?: boolean }) {
  return (
    <div className="bg-[#1a1a24] rounded-lg px-2.5 py-1.5">
      <div className="text-[9px] text-[#8888aa] uppercase tracking-wide">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${bad ? 'text-amber-400' : 'text-white'}`}>{value}</div>
    </div>
  )
}

const crore = (n: number | null) => n == null ? '—' : `₹${(n / 10000000).toFixed(2)} Cr`

function daysSince(d: string | null): number | null {
  if (!d) return null
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}

export function MarketClient({ films, canRefresh }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [diagnosing, setDiagnosing] = useState(false)
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [debug, setDebug] = useState<any | null>(null)

  async function refresh() {
    setBusy(true)
    try {
      const res = await fetch('/api/market/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Could not refresh'); setBusy(false); return }
      toast.success(`Updated — ${data.added} new, ${data.updated} refreshed`)
      router.refresh()
    } catch { toast.error('Could not refresh') }
    setBusy(false)
  }

  async function diagnose() {
    setDiagnosing(true); setDebug(null)
    try {
      const res = await fetch('/api/market/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ debug: true }) })
      const data = await res.json()
      setDebug(data.debug ?? { error: data.error ?? 'no debug returned' })
      router.refresh()
    } catch { setDebug({ error: 'request failed' }) }
    setDiagnosing(false)
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
        action={canRefresh && WEB_SEARCH_ENABLED ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Activity} loading={diagnosing} onClick={diagnose}>Diagnose</Button>
            <Button icon={Sparkles} loading={busy} onClick={refresh}>Refresh now</Button>
          </div>
        ) : undefined} />

      {!WEB_SEARCH_ENABLED && (
        <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl px-4 py-3 text-xs text-[#8888aa]">
          Auto-tracking of other Malayalam films is paused (web search is off for now). Existing data stays below; turn web search back on to resume the daily updates.
        </div>
      )}

      {/* Web-search diagnostics — confirms whether the search tool actually fired */}
      {debug && (
        <div className="bg-[#0e1726] border border-indigo-500/20 rounded-2xl p-5 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-indigo-200 font-semibold"><Activity size={14} /> Web-search diagnostics</div>
          {debug.error && <div className="text-red-400">Error: {debug.error}</div>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Key configured" value={String(debug.configured ?? '—')} />
            <Stat label="Searches fired" value={debug.searches?.length ?? 0} bad={(debug.searches?.length ?? 0) === 0} />
            <Stat label="Result blocks" value={debug.result_blocks ?? 0} />
            <Stat label="Total results" value={debug.total_results ?? 0} bad={(debug.total_results ?? 0) === 0} />
            <Stat label="JSON parsed" value={String(debug.parsed ?? false)} bad={debug.parsed === false} />
            <Stat label="Films found" value={debug.films_count ?? 0} bad={(debug.films_count ?? 0) === 0} />
            <Stat label="Stop reason" value={debug.stop_reason ?? '—'} />
            <Stat label="Search errors" value={debug.search_errors?.length ?? 0} bad={(debug.search_errors?.length ?? 0) > 0} />
          </div>
          {debug.searches?.length > 0 && (
            <div><div className="text-[#8888aa] mb-1">Queries issued:</div>
              <div className="flex flex-wrap gap-1">{debug.searches.map((q: string, i: number) => <span key={i} className="bg-[#1a1a24] border border-[#2a2a3a] rounded px-1.5 py-0.5 text-[#c8c8da]">{q}</span>)}</div>
            </div>
          )}
          {debug.search_errors?.length > 0 && <div className="text-amber-400">Tool errors: {debug.search_errors.join(', ')}</div>}
          {debug.text_preview && (
            <details>
              <summary className="text-[#8888aa] cursor-pointer">Model output preview</summary>
              <pre className="mt-1 whitespace-pre-wrap text-[10px] text-[#8888aa] bg-[#000000] rounded-lg p-2 max-h-48 overflow-auto">{debug.text_preview}</pre>
            </details>
          )}
        </div>
      )}

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
