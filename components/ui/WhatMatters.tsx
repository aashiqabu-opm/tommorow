import Link from 'next/link'
import { Flag } from 'lucide-react'

// Page-scoped "what matters here" panel — the deterministic, always-current
// complement to the AI role briefs. Renders nothing when there's nothing to
// flag, so pages stay clean on a quiet day.

export type WhatMattersTone = 'red' | 'amber' | 'blue'
export interface WhatMattersItem { text: string; href?: string; tone: WhatMattersTone }

const TONE: Record<WhatMattersTone, { chip: string; label: string }> = {
  red: { chip: 'bg-red-500/15 text-red-300', label: 'urgent' },
  amber: { chip: 'bg-amber-500/15 text-amber-300', label: 'review' },
  blue: { chip: 'bg-sky-500/15 text-sky-300', label: 'note' },
}

export function WhatMatters({ items, title = 'What matters' }: { items: WhatMattersItem[]; title?: string }) {
  if (!items.length) return null
  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-xl p-4">
      <h2 className="text-xs font-semibold text-[#8888aa] uppercase tracking-wider mb-3 flex items-center gap-2">
        <Flag size={13} /> {title}
      </h2>
      <div className="space-y-2">
        {items.map((it, i) => {
          const t = TONE[it.tone]
          const inner = (
            <div className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2.5 hover:border-white/20">
              <span className="text-sm text-white/90">{it.text}</span>
              <span className={`shrink-0 ml-3 text-[10px] uppercase px-1.5 py-0.5 rounded ${t.chip}`}>{t.label}</span>
            </div>
          )
          return it.href
            ? <Link key={i} href={it.href} className="block">{inner}</Link>
            : <div key={i}>{inner}</div>
        })}
      </div>
    </div>
  )
}
