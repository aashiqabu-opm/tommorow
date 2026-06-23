'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Brain, AlertTriangle, Lightbulb, Gauge, Clock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import type { StoredBrief } from '@/lib/ai/brief'

interface Props {
  brief: StoredBrief | null
  error: string | null
  label: string
  healthLabel: string
  showRunway: boolean
}

const DECISION_TONE: Record<string, { ring: string; chip: string; label: string }> = {
  critical: { ring: 'border-red-500/40', chip: 'bg-red-500/15 text-red-300', label: 'Critical' },
  high: { ring: 'border-amber-500/40', chip: 'bg-amber-500/15 text-amber-300', label: 'High' },
  medium: { ring: 'border-sky-500/40', chip: 'bg-sky-500/15 text-sky-300', label: 'Medium' },
}

const RISK_TONE: Record<string, { ring: string; chip: string; label: string }> = {
  critical: { ring: 'border-red-500/40', chip: 'bg-red-500/15 text-red-300', label: 'Critical' },
  high: { ring: 'border-amber-500/40', chip: 'bg-amber-500/15 text-amber-300', label: 'High' },
  medium: { ring: 'border-sky-500/40', chip: 'bg-sky-500/15 text-sky-300', label: 'Medium' },
}

function healthColor(n: number): string {
  if (n >= 70) return 'text-emerald-300'
  if (n >= 40) return 'text-amber-300'
  return 'text-red-300'
}
function healthStroke(n: number): string {
  if (n >= 70) return '#6ee7b7'
  if (n >= 40) return '#fcd34d'
  return '#fca5a5'
}

export function BriefView({ brief, error, label, healthLabel, showRunway }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch('/api/brief/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggered_by: 'refresh' }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Could not refresh the brief.'); return }
      toast.success('Brief refreshed.')
      router.refresh()
    } catch {
      toast.error('Could not refresh the brief.')
    } finally {
      setLoading(false)
    }
  }

  const c = brief?.content
  const generatedAt = brief?.generated_at
    ? new Date(brief.generated_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#f5b301]/20 to-[#f5b301]/5 border border-[#f5b301]/30 flex items-center justify-center">
            <Brain size={20} className="text-[#f5b301]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{label}</h1>
            <p className="text-sm text-[#8888aa] mt-0.5">
              {generatedAt ? `Generated ${generatedAt}` : 'Executive intelligence'}
              <span className="text-[#5a5a7a]"> · AI analysis, read-only</span>
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} loading={loading} onClick={refresh}>
          Refresh
        </Button>
      </div>

      {/* Error / empty state */}
      {!c && (
        <div className="bg-[#13131a] border border-red-500/30 rounded-2xl p-8 text-center">
          <AlertTriangle size={28} className="text-red-300 mx-auto mb-3" />
          <p className="text-sm text-white/90">{error || 'No brief yet.'}</p>
          <p className="text-xs text-[#8888aa] mt-1">Try refreshing to generate a fresh executive brief.</p>
        </div>
      )}

      {c && (
        <>
          {/* Stale-data note if generation failed but an old brief is shown */}
          {error && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2.5 text-xs text-amber-200">
              Showing the last saved brief — a fresh one couldn’t be generated: {error}
            </div>
          )}

          {/* Headline */}
          <div className="bg-gradient-to-br from-[#1a1a24] to-[#13131a] border border-[#2a2a3a] rounded-2xl p-6">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#8888aa] mb-2">
              <Sparkles size={12} className="text-[#f5b301]" /> Headline
            </div>
            <p className="text-lg lg:text-2xl font-bold text-white leading-snug">{c.headline}</p>
          </div>

          {/* Health + Runway (runway only for finance-cleared audiences) */}
          <div className={`grid grid-cols-1 gap-4 ${showRunway ? 'sm:grid-cols-2' : ''}`}>
            <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 flex items-center gap-5">
              <Gauge_ value={c.company_health} />
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#8888aa] flex items-center gap-1.5"><Gauge size={12} /> {healthLabel}</div>
                <div className={`text-3xl font-bold mt-1 ${healthColor(c.company_health)}`}>{Math.round(c.company_health)}<span className="text-base text-[#8888aa]">/100</span></div>
              </div>
            </div>
            {showRunway && (
              <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#1a1a24] border border-[#2a2a3a] flex items-center justify-center">
                  <Clock size={22} className="text-[#8888aa]" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-[#8888aa]">Cash Runway</div>
                  <div className="text-3xl font-bold mt-1 text-white">{Math.round(c.cash_runway_weeks)}<span className="text-base text-[#8888aa]"> wk</span></div>
                </div>
              </div>
            )}
          </div>

          {/* Decisions */}
          <Section title="Decisions" icon={Brain} count={c.decisions.length}>
            {c.decisions.length === 0 ? <Empty t="No decisions flagged." /> : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {c.decisions.map((d, i) => {
                  const tone = DECISION_TONE[d.priority] ?? DECISION_TONE.medium
                  return (
                    <div key={i} className={`bg-[#13131a] border ${tone.ring} rounded-xl p-4`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-white">{d.title}</h3>
                        <span className={`shrink-0 text-[10px] uppercase px-1.5 py-0.5 rounded ${tone.chip}`}>{tone.label}</span>
                      </div>
                      {d.context && <p className="text-xs text-[#8888aa] leading-relaxed">{d.context}</p>}
                      {d.action && <p className="text-xs text-white/90 mt-2"><span className="text-[#8888aa]">→ </span>{d.action}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* Risks */}
          <Section title="Risks" icon={AlertTriangle} count={c.risks.length}>
            {c.risks.length === 0 ? <Empty t="No risks flagged." /> : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {c.risks.map((r, i) => {
                  const tone = RISK_TONE[r.severity] ?? RISK_TONE.medium
                  return (
                    <div key={i} className={`bg-[#13131a] border ${tone.ring} rounded-xl p-4`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-white">{r.title}</h3>
                        <span className={`shrink-0 text-[10px] uppercase px-1.5 py-0.5 rounded ${tone.chip}`}>{tone.label}</span>
                      </div>
                      {r.detail && <p className="text-xs text-[#8888aa] leading-relaxed">{r.detail}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </Section>

          {/* Opportunities */}
          <Section title="Opportunities" icon={Lightbulb} count={c.opportunities.length}>
            {c.opportunities.length === 0 ? <Empty t="No opportunities flagged." /> : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {c.opportunities.map((o, i) => (
                  <div key={i} className="bg-[#13131a] border border-emerald-500/30 rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-emerald-200 mb-1">{o.title}</h3>
                    {o.detail && <p className="text-xs text-[#8888aa] leading-relaxed">{o.detail}</p>}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Footer */}
          <div className="text-center text-[11px] text-[#5a5a7a] pt-2">
            {brief?.model ?? 'AI'}
            {brief?.tokens_used ? ` · ${brief.tokens_used.toLocaleString('en-IN')} tokens` : ''}
            {brief?.triggered_by ? ` · ${brief.triggered_by}` : ''}
          </div>
        </>
      )}
    </div>
  )
}

function Section({ title, icon: Icon, count, children }: { title: string; icon: typeof Brain; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-semibold text-[#8888aa] uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon size={14} /> {title} <span className="text-[#5a5a7a]">{count}</span>
      </h2>
      {children}
    </section>
  )
}

function Empty({ t }: { t: string }) {
  return <div className="bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-6 text-center text-sm text-[#8888aa]">{t}</div>
}

// Small circular gauge for the health score.
function Gauge_({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value))
  const r = 26
  const circ = 2 * Math.PI * r
  const dash = (v / 100) * circ
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0">
      <circle cx="32" cy="32" r={r} fill="none" stroke="#2a2a3a" strokeWidth="6" />
      <circle
        cx="32" cy="32" r={r} fill="none" stroke={healthStroke(v)} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 32 32)"
      />
    </svg>
  )
}
