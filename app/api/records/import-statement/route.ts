import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Full-stack Believe statement importer. Founder / accountant / GM upload a
// Believe quarterly royalty CSV; we parse it, aggregate net revenue by platform
// (EUR → INR), upsert the catalogue (titles by ISRC), file the raw statement in
// storage, and write the period's royalty rows — idempotent per period so a
// re-upload replaces rather than duplicates.

// Minimal quoted-CSV parser for a single row (delimiter ';').
function parseLine(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
    else if (c === ';' && !q) { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out.map(s => s.trim())
}
function bucket(p: string): { platform: string; type: string } {
  const x = p.toLowerCase()
  if (x.includes('spotify')) return { platform: 'spotify', type: 'master' }
  if (x.includes('apple') || x === 'itunes' || x === 'itunes match') return { platform: 'apple_music', type: 'master' }
  if (x.includes('youtube') || x.includes('believe rights services')) return { platform: 'youtube', type: 'content_id' }
  return { platform: 'other', type: 'master' }
}
function quarterOf(dateStr: string): string | null {
  // accepts YYYY-MM-DD or DD/MM/YYYY
  let y = 0, m = 0
  let mm = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (mm) { y = +mm[1]; m = +mm[2] }
  else { mm = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/); if (mm) { y = +mm[3]; m = +mm[2] } }
  if (!y) return null
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!profile?.is_active || !['founder', 'accountant', 'general_manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Service role key missing on server' }, { status: 500 })

  let body: { csv?: unknown; rate?: unknown; filename?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const csv = typeof body.csv === 'string' ? body.csv : ''
  const rate = Number(body.rate) > 0 ? Number(body.rate) : 92
  const filename = typeof body.filename === 'string' ? body.filename : 'believe-statement.csv'
  if (!csv) return NextResponse.json({ error: 'No CSV content' }, { status: 400 })
  if (csv.length > 12_000_000) return NextResponse.json({ error: 'File too large (max ~12MB)' }, { status: 413 })

  const lines = csv.split(/\r?\n/).filter(l => l.trim().length)
  if (lines.length < 2) return NextResponse.json({ error: 'Empty statement' }, { status: 400 })
  const header = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ' ').trim())
  const idx = (names: string[]) => header.findIndex(h => names.some(n => h === n || h.includes(n)))
  const ci = {
    reporting: idx(['reporting month']), platform: idx(['platform']), label: idx(['label name']),
    artist: idx(['artist name']), release: idx(['release title']), track: idx(['track title']),
    upc: idx(['upc']), isrc: idx(['isrc']), qty: idx(['quantity']), net: idx(['net revenue']),
  }
  if (ci.platform < 0 || ci.net < 0 || ci.isrc < 0) {
    return NextResponse.json({ error: 'Unrecognised statement format — expected Believe columns (Platform, ISRC, Net Revenue…)' }, { status: 422 })
  }

  const agg: Record<string, { eur: number; qty: number }> = {}   // `${platform}|${type}` → totals
  const titles: Record<string, { title: string; album: string; artists: string; upc: string }> = {}
  const periodCount: Record<string, number> = {}
  let lineN = 0, eurTotal = 0
  for (let i = 1; i < lines.length; i++) {
    const r = parseLine(lines[i]); if (r.length < header.length - 2) continue
    const net = parseFloat(r[ci.net]); if (isNaN(net)) continue
    const qty = parseInt(r[ci.qty]) || 0
    const { platform, type } = bucket(r[ci.platform] || '')
    const k = `${platform}|${type}`
    ;(agg[k] ??= { eur: 0, qty: 0 }).eur += net; agg[k].qty += qty
    eurTotal += net; lineN++
    const q = ci.reporting >= 0 ? quarterOf(r[ci.reporting]) : null
    if (q) periodCount[q] = (periodCount[q] || 0) + 1
    const isrc = (r[ci.isrc] || '').trim()
    if (isrc && !titles[isrc]) titles[isrc] = { title: (r[ci.track] || '').trim(), album: (r[ci.release] || '').trim() || 'Single', artists: (r[ci.artist] || '').trim(), upc: (r[ci.upc] || '').trim() }
  }
  if (lineN === 0) return NextResponse.json({ error: 'No data rows parsed' }, { status: 422 })
  const period = Object.entries(periodCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'

  // 1) file the raw statement
  const path = `royalties/opm-records/${period}-believe-${Date.now()}.csv`
  await admin.storage.from('documents').upload(path, Buffer.from(csv, 'utf8'), { contentType: 'text/csv', upsert: true })

  // 2) upsert catalogue (titles by ISRC)
  const { data: existing } = await admin.from('opm_records_titles').select('isrc')
  const have = new Set((existing ?? []).map(t => (t.isrc || '').toUpperCase()).filter(Boolean))
  const newTitles = Object.entries(titles).filter(([isrc]) => !have.has(isrc.toUpperCase()))
    .map(([isrc, t]) => ({ title: t.title || isrc, album_movie: t.album, artists: t.artists || null, isrc, upc: t.upc || null, label: 'OPM Records', ownership_type: 'owned', master_owner: 'OPM Records', publishing_owner: 'OPM Records', notes: `Imported from Believe statement (${period}).` }))
  let titlesAdded = 0
  for (let i = 0; i < newTitles.length; i += 100) { const { error } = await admin.from('opm_records_titles').insert(newTitles.slice(i, i + 100)); if (!error) titlesAdded += newTitles.slice(i, i + 100).length }

  // 3) replace this period's DSP royalties (idempotent). Removes every prior DSP
  // row for the period (manual or imported) but preserves YouTube AdSense rows
  // (royalty_type 'other'), which come from the channel report, not Believe.
  await admin.from('opm_records_royalties').delete().eq('period', period).neq('royalty_type', 'other')
  const royRows = Object.entries(agg).filter(([, v]) => Math.round(v.eur * rate) !== 0).map(([k, v]) => {
    const [platform, royalty_type] = k.split('|')
    return { platform, royalty_type, period, amount: Math.round(v.eur * rate), streams_count: v.qty, payout_status: 'received', statement_file_path: path, notes: `Believe import — ${v.eur.toFixed(2)} EUR @ ${rate} (${filename})` }
  })
  const { error: rerr } = await admin.from('opm_records_royalties').insert(royRows)
  if (rerr) return NextResponse.json({ error: 'Royalty write failed: ' + rerr.message }, { status: 500 })

  return NextResponse.json({
    ok: true, period, lines: lineN, eurTotal: Math.round(eurTotal * 100) / 100, inrTotal: Math.round(eurTotal * rate),
    rate, platforms: royRows.length, titlesAdded, distinctTracks: Object.keys(titles).length,
  })
}
