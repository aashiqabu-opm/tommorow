import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, sendWhatsApp, emailTemplate, emailConfigured, whatsappConfigured } from '@/lib/alerts/channels'
import { escapeHtml } from '@/lib/alerts/deliver'
import { discoverMalayalamReleases, fetchIndustryFilmCollection, intelConfigured } from '@/lib/ai/release-intel'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Day = { day: number; date: string | null; india_net: number | null; worldwide: number | null; source: string | null }

// Daily Malayalam release tracker. Discovers films released in the last 7 days
// and records each one's day 1–7 collection. New films alert the core team.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  if (!intelConfigured()) return NextResponse.json({ ok: true, skipped: 'ANTHROPIC_API_KEY not set' })

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const daysSince = (d: string) => Math.floor((today.getTime() - new Date(d).getTime()) / 86400000)

  // 1. Discover new releases, upsert (don't clobber existing day data)
  const discovered = await discoverMalayalamReleases()
  const newFilms: string[] = []
  for (const f of discovered) {
    const { data: existing } = await admin.from('industry_films').select('id').eq('title', f.title).eq('release_date', f.release_date ?? null).maybeSingle()
    if (!existing) {
      await admin.from('industry_films').insert({ title: f.title, release_date: f.release_date, ai_note: f.note?.slice(0, 300) ?? null })
      newFilms.push(f.title)
    }
  }

  // 2. For every film still inside its first 7 days, fetch today's day number
  const { data: films } = await admin.from('industry_films').select('id, title, release_date, days')
    .gte('release_date', new Date(today.getTime() - 8 * 86400000).toISOString().slice(0, 10))

  let updated = 0
  for (const film of (films ?? []) as { id: string; title: string; release_date: string | null; days: Day[] }[]) {
    if (!film.release_date) continue
    const dayNum = daysSince(film.release_date) + 1
    if (dayNum < 1 || dayNum > 7) continue
    const days: Day[] = Array.isArray(film.days) ? film.days : []
    if (days.some(d => d.day === dayNum)) continue // already have today

    const col = await fetchIndustryFilmCollection(film.title, film.release_date, dayNum)
    if (!col || (col.india_net == null && col.worldwide_gross == null)) continue
    days.push({ day: dayNum, date: todayStr, india_net: col.india_net, worldwide: col.worldwide_gross, source: col.source })
    days.sort((a, b) => a.day - b.day)
    const total = days.reduce((s, d) => s + (d.india_net ?? 0), 0)
    await admin.from('industry_films').update({
      days, total_india: total, ai_note: col.note?.slice(0, 300) ?? null, last_checked: new Date().toISOString(),
    }).eq('id', film.id)
    updated++
  }

  // 3. Alert core team when genuinely new releases appear
  if (newFilms.length) {
    const { data: team } = await admin.from('profiles')
      .select('email, full_name, email_alerts, whatsapp_alerts, whatsapp_number')
      .in('role', ['founder', 'accountant', 'general_manager', 'executive_producer']).eq('is_active', true)
    const dateStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const html = emailTemplate(`New Malayalam releases — ${dateStr}`,
      `<p style="margin:0 0 12px;">New in cinemas, now tracking day 1–7:</p>` +
      `<ul style="margin:0;padding-left:18px;line-height:1.7;">${newFilms.map(f => `<li><b>${escapeHtml(f)}</b></li>`).join('')}</ul>` +
      `<p style="margin:16px 0 0;font-size:11px;color:#a1a1aa;">Follow their first-week run in Market in the app.</p>`)
    const waText = `*OPM Office — New Malayalam releases (${dateStr})*\n${newFilms.map(f => `• ${f}`).join('\n')}`
    for (const t of team ?? []) {
      if (emailConfigured() && t.email_alerts && t.email) await sendEmail(t.email, `OPM Office — New Malayalam releases (${dateStr})`, html)
      if (whatsappConfigured() && t.whatsapp_alerts && t.whatsapp_number) await sendWhatsApp(t.whatsapp_number, waText)
    }
  }

  return NextResponse.json({ ok: true, discovered: discovered.length, newFilms: newFilms.length, updated, sample: newFilms.map(f => `${f}`) })
}
