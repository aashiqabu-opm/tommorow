import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Mints a 60-minute signed URL for an object in the private `documents` bucket.
// Auth-gated (any signed-in user) — the bucket is private, so a session is now
// required to read any document. Signing uses the service-role admin client.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let path = ''
  try { path = String((await req.json())?.path || '') } catch { return NextResponse.json({ error: 'Expected JSON { path }' }, { status: 400 }) }
  if (!path) return NextResponse.json({ error: 'path is required' }, { status: 400 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Service role key missing' }, { status: 500 })

  const { data, error } = await admin.storage.from('documents').createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) return NextResponse.json({ error: error?.message ?? 'Could not sign' }, { status: 404 })
  return NextResponse.json({ url: data.signedUrl })
}
