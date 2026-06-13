import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { trackMalayalamReleases, intelConfigured } from '@/lib/ai/release-intel'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Day = { day: number; india_net: number | null; worldwide: number | null; source: string | null }

function mergeDays(existing: Day[], incoming: Day[]): Day[] {
  const map = new Map<number, Day>()
  for (const d of existing) if (d && typeof d.day === 'number') map.set(d.day, d)
  for (const d of incoming) {
    if (!d || typeof d.day !== 'number') continue
    const prev = map.get(d.day)
    map.set(d.day, { day: d.day, india_net: d.india_net ?? prev?.india_net ?? null, worldwide: d.worldwide ?? prev?.worldwide ?? null, source: d.source ?? prev?.source ?? null })
  }
  return [...map.values()].sort((a, b) => a.day - b.day)
}

// On-demand Malayalam release refresh — one aggressive web-search pass that
// discovers recent releases and pulls each one's day-wise collection.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!me?.is_active || !['founder', 'general_manager', 'executive_producer'].includes(me.role)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }
  if (!intelConfigured()) return NextResponse.json({ error: 'AI not configured (ANTHROPIC_API_KEY missing).' }, { status: 503 })

  const db = createAdminClient() ?? supabase
  const todayStr = new Date().toISOString().slice(0, 10)
  const films = await trackMalayalamReleases(todayStr)
  if (!films.length) return NextResponse.json({ ok: true, found: 0, added: 0, updated: 0, note: 'No releases found right now — try again shortly.' })

  let added = 0, updated = 0
  for (const f of films) {
    const lookup = db.from('industry_films').select('id, days').eq('title', f.title)
    const { data: existing } = await (f.release_date ? lookup.eq('release_date', f.release_date) : lookup.is('release_date', null)).maybeSingle()
    const mergedDays = mergeDays((existing?.days as Day[]) ?? [], f.days ?? [])
    const total = mergedDays.reduce((s, d) => s + (Number(d.india_net) || 0), 0)
    const payload = {
      title: f.title, release_date: f.release_date, days: mergedDays,
      total_india: total > 0 ? total : f.total_india, ai_note: f.note?.slice(0, 300) ?? null, last_checked: new Date().toISOString(),
    }
    if (existing) { await db.from('industry_films').update(payload).eq('id', existing.id); updated++ }
    else { await db.from('industry_films').insert(payload); added++ }
  }

  return NextResponse.json({ ok: true, found: films.length, added, updated })
}
