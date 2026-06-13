import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeDocument, documentAnalysisConfigured } from '@/lib/ai/analyze-document'
import { noteAiResult, isCreditError } from '@/lib/ai/health'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const EXT_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg',
  jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
}

// Analyze an already-uploaded document and store the result on the row.
// RLS scopes both the read and the write to the caller's role.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!documentAnalysisConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  let payload: { documentId?: unknown }
  try { payload = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const documentId = typeof payload.documentId === 'string' ? payload.documentId : ''
  if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 })

  const { data: doc } = await supabase.from('documents').select('id, title').eq('id', documentId).single()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const { data: files } = await supabase.from('document_files')
    .select('file_url, file_name').eq('document_id', documentId)
    .order('uploaded_at', { ascending: false }).limit(1)
  const fileRow = files?.[0]
  if (!fileRow?.file_url) return NextResponse.json({ error: 'No file attached to analyze' }, { status: 422 })

  const ext = String(fileRow.file_name ?? '').split('.').pop()?.toLowerCase() ?? ''
  const mediaType = EXT_TO_MIME[ext]
  if (!mediaType) return NextResponse.json({ error: 'Only PDF or image files can be analyzed' }, { status: 415 })

  // Pull the stored file and base64-encode it for the model
  let base64: string
  try {
    const res = await fetch(fileRow.file_url)
    if (!res.ok) return NextResponse.json({ error: 'Could not fetch the stored file' }, { status: 502 })
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 12_000_000) return NextResponse.json({ error: 'File too large to analyze (>12MB)' }, { status: 413 })
    base64 = buf.toString('base64')
  } catch {
    return NextResponse.json({ error: 'Could not fetch the stored file' }, { status: 502 })
  }

  const { data: analysis, error } = await analyzeDocument(base64, mediaType, doc.title)
  await noteAiResult(analysis ? null : error)
  if (!analysis) {
    const credit = isCreditError(error)
    return NextResponse.json({ error: credit ? 'AI is paused — Anthropic API credits are exhausted. Top up to resume.' : 'Analysis failed', detail: error ?? null }, { status: 422 })
  }

  await supabase.from('documents').update({
    ai_summary: analysis.summary,
    ai_analysis: analysis,
    ai_analyzed_at: new Date().toISOString(),
  }).eq('id', documentId)

  return NextResponse.json({ ok: true, analysis })
}
