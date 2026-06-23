import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { generateAndStoreBrief, isAudience, BRIEF_META, type StoredBrief } from '@/lib/ai/brief'
import { BriefView } from './BriefView'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FOUR_HOURS = 4 * 60 * 60 * 1000

// Role briefs — executive intelligence per role. Founder, accountant, EP and
// GM each land here and see only their own brief. Loads the latest cached
// brief from the right table; if missing or >4h old, generates on load.
export default async function BriefPage() {
  const profile = await requireProfile()
  if (!isAudience(profile.role)) redirect('/dashboard')
  const audience = profile.role

  const supabase = await createClient()
  const table = audience === 'founder' ? 'founder_briefs' : 'role_briefs'
  let query = supabase.from(table).select('*').order('generated_at', { ascending: false }).limit(1)
  if (table === 'role_briefs') query = query.eq('audience', audience)
  const { data: row } = await query.maybeSingle()

  let brief = (row as StoredBrief | null) ?? null
  const stale = !brief || Date.now() - new Date(brief.generated_at).getTime() > FOUR_HOURS

  let genError: string | null = null
  if (stale) {
    try { brief = await generateAndStoreBrief(supabase, audience, 'manual') }
    catch (e) { genError = e instanceof Error ? e.message : 'Could not generate the brief.' }
  }

  const meta = BRIEF_META[audience]
  return <BriefView brief={brief} error={genError} label={meta.label} healthLabel={meta.healthLabel} showRunway={meta.showRunway} />
}
