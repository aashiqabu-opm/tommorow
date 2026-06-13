import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { discoverMalayalamReleases, fetchIndustryFilmCollection, intelConfigured } from '@/lib/ai/release-intel'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Day = { day: number; date: string | null; india_net: number | null; worldwide: number | null; source: string | null }

// On-demand Malayalam release refresh — discover new films + update their day
// 1–7 collections. Founder / management only.
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
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const daysSince = (d: string) => Math.floor((today.getTime() - new Date(d).getTime()) / 86400000)

  const discovered = await discoverMalayalamReleases()
  let added = 0
  for (const f of discovered) {
    const { data: existing } = await db.from('industry_films').select('id').eq('title', f.title).eq('release_date', f.release_date ?? null).maybeSingle()
    if (!existing) { await db.from('industry_films').insert({ title: f.title, release_date: f.release_date, ai_note: f.note?.slice(0, 300) ?? null }); added++ }
  }

  const { data: films } = await db.from('industry_films').select('id, title, release_date, days')
    .gte('release_date', new Date(today.getTime() - 8 * 86400000).toISOString().slice(0, 10))
  let updated = 0
  for (const film of (films ?? []) as { id: string; title: string; release_date: string | null; days: Day[] }[]) {
    if (!film.release_date) continue
    const dayNum = daysSince(film.release_date) + 1
    if (dayNum < 1 || dayNum > 7) continue
    const days: Day[] = Array.isArray(film.days) ? film.days : []
    if (days.some(d => d.day === dayNum)) continue
    const col = await fetchIndustryFilmCollection(film.title, film.release_date, dayNum)
    if (!col || (col.india_net == null && col.worldwide_gross == null)) continue
    days.push({ day: dayNum, date: todayStr, india_net: col.india_net, worldwide: col.worldwide_gross, source: col.source })
    days.sort((a, b) => a.day - b.day)
    await db.from('industry_films').update({
      days, total_india: days.reduce((s, d) => s + (d.india_net ?? 0), 0),
      ai_note: col.note?.slice(0, 300) ?? null, last_checked: new Date().toISOString(),
    }).eq('id', film.id)
    updated++
  }

  return NextResponse.json({ ok: true, added, updated })
}
