import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractVehicleDocRich, vehicleDocExtractionConfigured } from '@/lib/ai/extract-vehicle-doc'
import { logAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const FINANCE = ['founder', 'accountant', 'general_manager', 'executive_producer']
const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']

async function gate() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const { data: profile } = await supabase.from('profiles').select('id, role, is_active').eq('id', user.id).single()
  if (!profile?.is_active || !FINANCE.includes(profile.role)) return { error: 'Forbidden', status: 403 as const }
  return { supabase, profile }
}

// GET /api/vehicles/documents?vehicle_id=...  → list (RLS-scoped)
export async function GET(request: Request) {
  const g = await gate(); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  const vehicleId = new URL(request.url).searchParams.get('vehicle_id')
  let q = g.supabase.from('vehicle_documents').select('*').order('created_at', { ascending: false })
  if (vehicleId) q = q.eq('vehicle_id', vehicleId)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, documents: data })
}

// POST multipart: file + vehicle_id + doc_type + doc_number(optional)
export async function POST(request: Request) {
  const g = await gate(); if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status })
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Service role key missing' }, { status: 500 })

  let form: FormData
  try { form = await request.formData() } catch { return NextResponse.json({ error: 'Expected multipart form-data' }, { status: 400 }) }
  const file = form.get('file')
  const vehicle_id = String(form.get('vehicle_id') || '')
  const doc_type = String(form.get('doc_type') || 'other')
  const doc_number_in = form.get('doc_number') ? String(form.get('doc_number')) : null
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (!vehicle_id) return NextResponse.json({ error: 'vehicle_id is required' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Only PDF or image files' }, { status: 415 })
  if (file.size > 25_000_000) return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 413 })

  // 1) upload to private storage
  const buf = Buffer.from(await file.arrayBuffer())
  const safe = file.name.replace(/[^a-z0-9._-]+/gi, '_')
  const path = `${vehicle_id}/${doc_type}/${Date.now()}_${safe}`
  const { error: upErr } = await admin.storage.from('vehicle-documents').upload(path, buf, { contentType: file.type, upsert: false })
  if (upErr) return NextResponse.json({ error: 'Upload failed: ' + upErr.message }, { status: 500 })

  // 2) AI extraction (best-effort; never blocks the save)
  let extracted: Record<string, unknown> = {}
  let aiOk = false
  if (vehicleDocExtractionConfigured() && file.size < 9_000_000) {
    const { data } = await extractVehicleDocRich(buf.toString('base64'), file.type, doc_type)
    if (data && typeof data === 'object') { extracted = data; aiOk = true }
  }
  const expiry = (extracted.expiry_date || extracted.validity_to) as string | undefined
  const expiry_date = typeof expiry === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? expiry : null
  const issue = (extracted.registration_date || extracted.validity_from || extracted.issue_date) as string | undefined
  const issue_date = typeof issue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(issue) ? issue : null
  const doc_number = doc_number_in || (typeof extracted.doc_number === 'string' ? extracted.doc_number : typeof extracted.policy_number === 'string' ? extracted.policy_number : null)
  // status from expiry
  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const status = expiry_date ? (expiry_date < today ? 'expired' : expiry_date <= in30 ? 'expiring_soon' : 'active') : 'active'

  // 3) save record (admin — bucket is private; RLS already verified above)
  const { data: rec, error: insErr } = await admin.from('vehicle_documents').insert({
    vehicle_id, doc_type, doc_number, issue_date, expiry_date, status,
    file_url: path, file_name: file.name, extracted_data: extracted, ai_extracted: aiOk, created_by: g.profile.id,
  }).select().single()
  if (insErr) { await admin.storage.from('vehicle-documents').remove([path]); return NextResponse.json({ error: insErr.message }, { status: 500 }) }
  await logAction('create', 'vehicle_documents', rec.id, undefined, { vehicle_id, doc_type, ai_extracted: aiOk })

  return NextResponse.json({ ok: true, document: rec, ai_extracted: aiOk })
}
