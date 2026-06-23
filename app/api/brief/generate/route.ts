import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAndStoreBrief, type BriefTrigger } from '@/lib/ai/brief'
import { noteAiResult, isCreditError } from '@/lib/ai/health'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Generate + store a fresh Founder Brief. Founder-only. The page generates
// on first load when stale; the "Refresh" button hits this with triggered_by
// = 'refresh'.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!profile?.is_active || profile.role !== 'founder') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let triggeredBy: BriefTrigger = 'manual'
  try {
    const body = await request.json()
    if (body?.triggered_by === 'refresh' || body?.triggered_by === 'manual') triggeredBy = body.triggered_by
  } catch { /* default 'manual' */ }

  try {
    const brief = await generateAndStoreBrief(supabase, triggeredBy)
    await noteAiResult(null)
    return NextResponse.json({ ok: true, brief })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not generate the brief.'
    await noteAiResult(msg)
    return NextResponse.json({ error: isCreditError(msg) ? 'AI is paused — credits exhausted.' : msg }, { status: 422 })
  }
}
