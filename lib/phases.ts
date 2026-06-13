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
