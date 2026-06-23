import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { generateAndStoreBrief, type FounderBrief } from '@/lib/ai/brief'
import { BriefView } from './BriefView'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FOUR_HOURS = 4 * 60 * 60 * 1000

// Founder Brief — executive intelligence view. Founder-only. Reads the most
// recent cached brief; if missing or older than 4 hours, generates a fresh one
// on load, then renders.
export default async function BriefPage() {
  const profile = await requireProfile()
  if (profile.role !== 'founder') redirect('/dashboard')

  const supabase = await createClient()
  const { data: row } = await supabase
    .from('founder_briefs')
    .select('*')
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let brief = (row as FounderBrief | null) ?? null
  const stale = !brief || Date.now() - new Date(brief.generated_at).getTime() > FOUR_HOURS

  let genError: string | null = null
  if (stale) {
    try { brief = await generateAndStoreBrief(supabase, 'manual') }
    catch (e) { genError = e instanceof Error ? e.message : 'Could not generate the brief.' }
  }

  return <BriefView brief={brief} error={genError} />
}
