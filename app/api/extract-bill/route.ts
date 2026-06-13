import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractBill, billExtractionConfigured } from '@/lib/ai/extract-bill'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']

// Authenticated: any active user can read a bill they're about to attach.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!billExtractionConfigured()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  let payload: { base64?: unknown; mediaType?: unknown }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const base64 = typeof payload.base64 === 'string' ? payload.base64 : ''
  const mediaType = typeof payload.mediaType === 'string' ? payload.mediaType : ''
  if (!base64 || !ALLOWED.includes(mediaType)) {
    return NextResponse.json({ error: 'base64 and a supported mediaType are required' }, { status: 400 })
  }
  // ~7MB base64 ≈ 5MB file; keep payloads sane
  if (base64.length > 9_500_000) {
    return NextResponse.json({ error: 'File too large — use one under ~6MB' }, { status: 413 })
  }

  const extracted = await extractBill(base64, mediaType)
  if (!extracted) {
    return NextResponse.json({ error: 'Could not read the bill' }, { status: 422 })
  }
  return NextResponse.json({ ok: true, extracted })
}
