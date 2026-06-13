import type { ProjectPhase } from '@/lib/types'

// The five production phases, in order, with default milestone checklists a
// producer can seed and then tailor per project.

export const PHASES: { key: ProjectPhase; label: string; short: string }[] = [
  { key: 'development', label: 'Development & Pre-Production', short: 'Pre-Prod' },
  { key: 'production', label: 'Production / Shoot', short: 'Shoot' },
  { key: 'post_production', label: 'Post-Production', short: 'Post' },
  { key: 'distribution', label: 'Distribution & Marketing', short: 'Distribution' },
  { key: 'release', label: 'Release & Beyond', short: 'Release' },
]

export const PHASE_LABELS: Record<string, string> = Object.fromEntries(PHASES.map(p => [p.key, p.label]))

// Maps the project's lifecycle status to the phase it's currently in.
export function currentPhase(status: string): ProjectPhase {
  if (status === 'released') return 'release'
  if (status === 'post_production') return 'post_production'
  if (status === 'active') return 'production'
  return 'development'
}

export const DEFAULT_MILESTONES: Record<ProjectPhase, string[]> = {
  development: [
    'Script locked', 'Budget finalised', 'Financing / investors closed',
    'Lead cast signed', 'Key crew (DOP, music, editor) signed', 'Shoot schedule & locations locked',
    'Insurance & permits arranged', 'Bank account & accounting set up',
  ],
  production: [
    'Shoot commenced', 'Daily production reports flowing', 'Schedule on track',
    'Petty cash floats running', 'Rushes / dailies reviewed', 'Patch / song shoots done', 'Shoot wrapped',
  ],
  post_production: [
    'Editing — first cut', 'Final cut locked', 'VFX completed', 'DI / colour grading',
    'Background score & songs final', 'Sound design & mix (DTS)', 'Dubbing complete', 'Final master ready',
  ],
  distribution: [
    'Censor (CBFC) certification', 'Theatrical distributors closed', 'OTT deal closed',
    'Satellite rights closed', 'Audio / music rights closed', 'Trailer & promos out', 'Release date locked', 'Marketing campaign live',
  ],
  release: [
    'Theatrical release', 'Opening weekend tracked', 'Collections settling', 'OTT premiere',
    'Satellite premiere', 'Final recoupment & P&L closed',
  ],
}

export const SEVERITY_VARIANT: Record<string, 'red' | 'yellow' | 'gray'> = {
  high: 'red', medium: 'yellow', low: 'gray',
}

// Release-window gating — the expensive daily web scans only run while a film
// is actually releasing (release day −3 to +30 days). Outside it, no cost.
const PRE = 3, POST = 30
export function releaseWindow(
  p: { release_date?: string | null; status?: string; ai_status_at?: string | null },
  now: Date = new Date(),
): { active: boolean; reason: string } {
  const today = now.toISOString().slice(0, 10)
  const days = (a: string, b: string) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000)
  if (p.release_date) {
    const fromRel = days(today, p.release_date) // negative = before release
    if (fromRel >= -PRE && fromRel <= POST) return { active: true, reason: fromRel < 0 ? `${-fromRel}d to release` : `day ${fromRel + 1} of release` }
    return { active: false, reason: fromRel < 0 ? `releases in ${-fromRel}d` : `released ${fromRel}d ago` }
  }
  // No date set — fall back to "recently flipped to Released".
  if (p.status === 'released' && p.ai_status_at) {
    const since = days(today, p.ai_status_at.slice(0, 10))
    if (since <= POST) return { active: true, reason: 'recently released' }
  }
  return { active: false, reason: 'no release date set' }
}
