import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Refresh live subscriber/view counts for OPM Records' YouTube channels via the
// YouTube Data API v3. No-op (503) until YOUTUBE_API_KEY is configured. Founder
// / accountant / GM only — same access as the Records module. Runs through the
// caller's RLS-scoped client.
function parseChannel(url: string, handle: string | null): { id?: string; handle?: string } {
  const idm = url.match(/\/channel\/(UC[\w-]+)/)
  if (idm) return { id: idm[1] }
  const hm = url.match(/@([\w.-]+)/) || (handle ? handle.match(/@?([\w.-]+)/) : null)
  if (hm) return { handle: hm[1] }
  return {}
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!profile?.is_active || !['founder', 'accountant', 'general_manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return NextResponse.json({ error: 'not_configured', detail: 'Add YOUTUBE_API_KEY to enable live stats.' }, { status: 503 })

  const { data: channels } = await supabase.from('opm_records_channels').select('id, url, handle').eq('platform', 'youtube')
  let updated = 0
  const results: { id: string; subs?: number; views?: number; error?: string }[] = []
  for (const ch of channels ?? []) {
    const ref = parseChannel(ch.url, ch.handle)
    const q = ref.id ? `id=${ref.id}` : ref.handle ? `forHandle=${encodeURIComponent(ref.handle)}` : null
    if (!q) { results.push({ id: ch.id, error: 'no channel id/handle' }); continue }
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&${q}&key=${key}`)
      const json = await res.json()
      const stats = json?.items?.[0]?.statistics
      if (!stats) { results.push({ id: ch.id, error: 'channel not found' }); continue }
      const subs = parseInt(stats.subscriberCount ?? '0', 10)
      const views = parseInt(stats.viewCount ?? '0', 10)
      await supabase.from('opm_records_channels').update({ subscriber_count: subs, views_count: views }).eq('id', ch.id)
      updated++; results.push({ id: ch.id, subs, views })
    } catch (e) {
      results.push({ id: ch.id, error: (e as Error).message })
    }
  }
  return NextResponse.json({ ok: true, updated, results })
}
