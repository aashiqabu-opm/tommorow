import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'
const FINANCE = ['founder', 'accountant', 'general_manager', 'executive_producer']

async function gate() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const { data: profile } = await supabase.from('profiles').select('id, role, is_active').eq('id', user.id).single()
  if (!profile?.is_active || !FINANCE.includes(profile.role)) return { error: 'Forbidden', status: 403 as const }
  return { supabase }
}

// GET → document + a 60-min signed URL to the original file
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  const { id } = await params
  const { data: doc, error } = await g.supabase.from('vehicle_documents').select('*').eq('id', id).single()
  if (error || !doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  let signedUrl: string | null = null
  if (doc.file_url) {
    const admin = createAdminClient()
    if (admin) { const { data: s } = await admin.storage.from('vehicle-documents').createSignedUrl(doc.file_url, 3600); signedUrl = s?.signedUrl ?? null }
  }
  return NextResponse.json({ ok: true, document: doc, signedUrl })
}

// DELETE → remove file from storage + delete record
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await gate(); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  const { id } = await params
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Service role key missing' }, { status: 500 })
  const { data: doc } = await g.supabase.from('vehicle_documents').select('id, file_url').eq('id', id).single()
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (doc.file_url) await admin.storage.from('vehicle-documents').remove([doc.file_url])
  const { error } = await admin.from('vehicle_documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAction('delete', 'vehicle_documents', id)
  return NextResponse.json({ ok: true })
}
