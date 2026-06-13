import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractVehicleDoc, vehicleDocExtractionConfigured } from '@/lib/ai/extract-vehicle-doc'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!vehicleDocExtractionConfigured()) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  let payload: { base64?: unknown; mediaType?: unknown; docType?: unknown }
  try { payload = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const base64 = typeof payload.base64 === 'string' ? payload.base64 : ''
  const mediaType = typeof payload.mediaType === 'string' ? payload.mediaType : ''
  const docType = typeof payload.docType === 'string' ? payload.docType : 'other'
  if (!base64 || !ALLOWED.includes(mediaType)) return NextResponse.json({ error: 'base64 and a supported mediaType are required' }, { status: 400 })
  if (base64.length > 9_500_000) return NextResponse.json({ error: 'File too large — use one under ~6MB' }, { status: 413 })

  const { data: extracted, error } = await extractVehicleDoc(base64, mediaType, docType)
  if (!extracted) return NextResponse.json({ error: 'Could not read the document', detail: error ?? null }, { status: 422 })
  return NextResponse.json({ ok: true, extracted })
}
