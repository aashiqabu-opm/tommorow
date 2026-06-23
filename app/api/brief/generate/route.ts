import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAndStoreBrief, isAudience } from '@/lib/ai/brief'
import { noteAiResult, isCreditError } from '@/lib/ai/health'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Generate + store a fresh brief for the caller's own role. The page generates
// on first load when stale; the "Refresh" button hits this. The audience is
// always derived from the authenticated session — never from the request body —
// so no one can request another role's brief.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!profile?.is_active || !profile.role || !isAudience(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const brief = await generateAndStoreBrief(supabase, profile.role, 'refresh')
    await noteAiResult(null)
    return NextResponse.json({ ok: true, brief })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not generate the brief.'
    await noteAiResult(msg)
    return NextResponse.json({ error: isCreditError(msg) ? 'AI is paused — credits exhausted.' : msg }, { status: 422 })
  }
}
