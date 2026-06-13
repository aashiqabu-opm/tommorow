import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { compileIndustryBrief, intelConfigured } from '@/lib/ai/release-intel'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// On-demand Malayalam industry brief. Founder / management only.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!me?.is_active || !['founder', 'general_manager', 'executive_producer'].includes(me.role)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }
  if (!intelConfigured()) return NextResponse.json({ error: 'AI not configured (ANTHROPIC_API_KEY missing).' }, { status: 503 })

  const brief = await compileIndustryBrief()
  if (!brief) return NextResponse.json({ error: 'Could not compile a brief right now.' }, { status: 422 })

  const db = createAdminClient() ?? supabase
  const weekOf = new Date().toISOString().slice(0, 10)
  await db.from('industry_briefs').upsert({
    week_of: weekOf, headline: brief.headline?.slice(0, 300) ?? null,
    summary: brief.summary?.slice(0, 4000) ?? null, items: brief.items ?? [],
  }, { onConflict: 'week_of' })

  return NextResponse.json({ ok: true, items: brief.items?.length ?? 0 })
}
