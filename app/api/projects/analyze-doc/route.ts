import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractProjectDoc, projectDocExtractionConfigured } from '@/lib/ai/extract-project-doc'
import { readPdf } from '@/lib/pdf'
import { noteAiResult, isCreditError } from '@/lib/ai/health'
import { aiUsage, recordAiUse } from '@/lib/ai/usage'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']

// AI auto-fill for project documents (screenplay/charts/PDFs). Active project
// members can call it; RLS gates the actual save on the client side.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('is_active').eq('id', user.id).single()
  if (!profile?.is_active) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!projectDocExtractionConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  let payload: { base64?: unknown; mediaType?: unknown }
  try { payload = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const base64 = typeof payload.base64 === 'string' ? payload.base64 : ''
  const mediaType = typeof payload.mediaType === 'string' ? payload.mediaType : ''
  if (!base64 || !ALLOWED.includes(mediaType)) return NextResponse.json({ error: 'base64 + supported mediaType required' }, { status: 400 })

  const cap = await aiUsage()
  if (cap.over) return NextResponse.json({ error: `Monthly AI limit reached (${cap.used}/${cap.cap}).` }, { status: 429 })

  // PDFs: extract text first (handles long screenplays better than vision).
  let result
  if (mediaType === 'application/pdf') {
    const { text } = readPdf(Buffer.from(base64, 'base64'))
    result = await extractProjectDoc(text ? { text } : { base64, mediaType })
  } else {
    result = await extractProjectDoc({ base64, mediaType })
  }
  if (!result.data) {
    await noteAiResult(result.error)
    return NextResponse.json({ error: isCreditError(result.error) ? 'AI is paused — credits exhausted.' : 'Could not read the document' }, { status: 422 })
  }
  await recordAiUse('project-doc')
  await noteAiResult(null)
  return NextResponse.json({ ok: true, extracted: result.data })
}
