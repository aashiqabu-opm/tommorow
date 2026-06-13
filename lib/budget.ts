import type { BudgetSection, BudgetPhase } from '@/lib/types'

export const SECTION_LABELS: Record<BudgetSection, string> = {
  above_line: 'Above the Line',
  below_line: 'Below the Line — Production',
  post: 'Post-production',
  other: 'Other / Finance',
}

export const SECTION_ORDER: BudgetSection[] = ['above_line', 'below_line', 'post', 'other']

export const PHASE_LABELS: Record<BudgetPhase, string> = {
  development: 'Development',
  pre: 'Pre-production',
  production: 'Production',
  post: 'Post',
  release: 'Release',
}

// A standard Indian feature-film budget template (heads grouped by section,
// with a sensible default phase). "Apply template" seeds these for a project.
export const BUDGET_TEMPLATE: { section: BudgetSection; phase: BudgetPhase; head: string }[] = [
  // Above the line
  { section: 'above_line', phase: 'development', head: 'Story / Script Rights' },
  { section: 'above_line', phase: 'production', head: 'Producer Fee' },
  { section: 'above_line', phase: 'production', head: 'Director Fee' },
  { section: 'above_line', phase: 'production', head: 'Lead Cast' },
  { section: 'above_line', phase: 'post', head: 'Music Director' },
  // Below the line — production
  { section: 'below_line', phase: 'production', head: 'Supporting Cast' },
  { section: 'below_line', phase: 'production', head: 'Camera / Cinematography' },
  { section: 'below_line', phase: 'production', head: 'Art / Production Design' },
  { section: 'below_line', phase: 'production', head: 'Costumes' },
  { section: 'below_line', phase: 'production', head: 'Makeup & Hair' },
  { section: 'below_line', phase: 'production', head: 'Sound (Production)' },
  { section: 'below_line', phase: 'production', head: 'Lighting & Electrical' },
  { section: 'below_line', phase: 'production', head: 'Grip & Machinery' },
  { section: 'below_line', phase: 'production', head: 'Locations' },
  { section: 'below_line', phase: 'production', head: 'Set Construction' },
  { section: 'below_line', phase: 'production', head: 'Travel & Accommodation' },
  { section: 'below_line', phase: 'production', head: 'Transport' },
  { section: 'below_line', phase: 'production', head: 'Catering / Food' },
  { section: 'below_line', phase: 'production', head: 'Production Staff' },
  { section: 'below_line', phase: 'production', head: 'Equipment Rental' },
  // Post-production
  { section: 'post', phase: 'post', head: 'Editing' },
  { section: 'post', phase: 'post', head: 'DI / Color' },
  { section: 'post', phase: 'post', head: 'VFX' },
  { section: 'post', phase: 'post', head: 'Sound Design & Mix' },
  { section: 'post', phase: 'post', head: 'Music & Background Score' },
  { section: 'post', phase: 'post', head: 'Dubbing' },
  { section: 'post', phase: 'post', head: 'Titles & Graphics' },
  // Other / finance
  { section: 'other', phase: 'pre', head: 'Insurance' },
  { section: 'other', phase: 'production', head: 'Legal & Professional' },
  { section: 'other', phase: 'production', head: 'Finance Cost (Interest)' },
  { section: 'other', phase: 'release', head: 'Publicity & Marketing' },
  { section: 'other', phase: 'production', head: 'Contingency' },
]
