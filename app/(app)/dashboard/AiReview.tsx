'use client'

import { useState } from 'react'
import { Sparkles, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast'

interface Finding { severity: string; category: string; title: string; detail: string }
const SEV: Record<string, 'red' | 'yellow' | 'gray'> = { high: 'red', medium: 'yellow', low: 'gray' }

// On-demand AI financial review. Uses AI credits (counts toward the monthly cap).
export function AiReview() {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [findings, setFindings] = useState<Finding[] | null>(null)

  async function run() {
    setLoading(true)
    try {
      const res = await fetch('/api/anomaly', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Review failed'); setLoading(false); return }
      setFindings(data.findings ?? [])
      if ((data.findings ?? []).length === 0) toast.success('AI found nothing unusual')
    } catch { toast.error('Review failed') }
    setLoading(false)
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-white/70" />
          <h3 className="text-sm font-semibold text-white">AI Financial Review</h3>
        </div>
        <Button size="sm" variant="secondary" icon={Sparkles} loading={loading} onClick={run}>Run AI review</Button>
      </div>

      <div className="p-5">
        {findings === null ? (
          <p className="text-xs text-[#8888aa] leading-relaxed">AI scans your last 90 days — vendor concentration, unusual or duplicate spend, budget overruns, compliance gaps, cash strain — and flags what's worth a look. Uses AI credits (counts toward your monthly cap).</p>
        ) : findings.length === 0 ? (
          <p className="text-sm text-emerald-400/80">Nothing unusual stood out.</p>
        ) : (
          <div className="space-y-2">
            {findings.map((f, i) => (
              <div key={i} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <StatusBadge label={f.severity} variant={SEV[f.severity] ?? 'gray'} />
                  <span className="text-[10px] uppercase tracking-wide text-[#8888aa]">{f.category}</span>
                  <span className="text-sm text-white">{f.title}</span>
                </div>
                <p className="text-xs text-[#c8c8da] leading-relaxed">{f.detail}</p>
              </div>
            ))}
            <p className="text-[11px] text-[#5a5a7a] pt-1">AI suggestions for review — verify before acting. It never changes anything.</p>
          </div>
        )}
      </div>
    </div>
  )
}
