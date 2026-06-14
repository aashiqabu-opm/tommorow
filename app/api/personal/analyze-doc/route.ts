import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractPersonalDoc, personalDocExtractionConfigured } from '@/lib/ai/extract-personal-doc'
import { noteAiResult, isCreditError } from '@/lib/ai/health'
import { aiUsage, recordAiUse } from '@/lib/ai/usage'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']

// Auto-fill engine for the personal legal vault: takes an uploaded document
// (base64), reads it with Claude, returns structured fields to pre-fill the
// form. Founder-only; nothing is stored here (the client saves after review).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!profile?.is_active || profile.role !== 'founder') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!personalDocExtractionConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  let payload: { base64?: unknown; mediaType?: unknown }
  try { payload = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const base64 = typeof payload.base64 === 'string' ? payload.base64 : ''
  const mediaType = typeof payload.mediaType === 'string' ? payload.mediaType : ''
  if (!base64 || !ALLOWED.includes(mediaType)) return NextResponse.json({ error: 'base64 and a supported mediaType are required' }, { status: 400 })
  if (base64.length > 9_500_000) return NextResponse.json({ error: 'File too large — use one under ~6MB' }, { status: 413 })

  const cap = await aiUsage()
  if (cap.over) return NextResponse.json({ error: `Monthly AI limit reached (${cap.used}/${cap.cap}).` }, { status: 429 })

  const { data: extracted, error } = await extractPersonalDoc(base64, mediaType)
  if (!extracted) {
    await noteAiResult(error)
    return NextResponse.json({ error: isCreditError(error) ? 'AI is paused — credits exhausted.' : 'Could not read the document', detail: error ?? null }, { status: 422 })
  }
  await recordAiUse('personal-doc')
  await noteAiResult(null)
  return NextResponse.json({ ok: true, extracted })
}
