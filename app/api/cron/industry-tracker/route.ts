import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, emailTemplate, emailConfigured } from '@/lib/alerts/channels'
import { escapeHtml } from '@/lib/alerts/deliver'
import { trackMalayalamReleases, intelConfigured } from '@/lib/ai/release-intel'
import { withCronErrorAlert } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Day = { day: number; india_net: number | null; worldwide: number | null; source: string | null }

// Merge new day rows into existing, keeping the best (non-null) figure per day.
function mergeDays(existing: Day[], incoming: Day[]): Day[] {
  const map = new Map<number, Day>()
  for (const d of existing) if (d && typeof d.day === 'number') map.set(d.day, d)
  for (const d of incoming) {
    if (!d || typeof d.day !== 'number') continue
    const prev = map.get(d.day)
    map.set(d.day, {
      day: d.day,
      india_net: d.india_net ?? prev?.india_net ?? null,
      worldwide: d.worldwide ?? prev?.worldwide ?? null,
      source: d.source ?? prev?.source ?? null,
    })
  }
  return [...map.values()].sort((a, b) => a.day - b.day)
}

// Daily Malayalam release tracker. One aggressive web-search pass finds every
// recent release and its day-wise collections; we upsert + merge. New films
// alert the core team.
export async function GET(request: Request) {
  return withCronErrorAlert('industry-tracker', () => run(request))
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  if (!intelConfigured()) return NextResponse.json({ ok: true, skipped: 'ANTHROPIC_API_KEY not set' })

  const todayStr = new Date().toISOString().slice(0, 10)
  const films = await trackMalayalamReleases(todayStr)
  if (!films.length) return NextResponse.json({ ok: true, found: 0, note: 'no films returned' })

  const newFilms: string[] = []
  let upserts = 0

  for (const f of films) {
    const lookup = admin.from('industry_films').select('id, days').eq('title', f.title)
    const { data: existing } = await (f.release_date ? lookup.eq('release_date', f.release_date) : lookup.is('release_date', null)).maybeSingle()
    const mergedDays = mergeDays((existing?.days as Day[]) ?? [], f.days ?? [])
    const total = mergedDays.reduce((s, d) => s + (Number(d.india_net) || 0), 0)
    const payload = {
      title: f.title, release_date: f.release_date,
      days: mergedDays, total_india: total > 0 ? total : f.total_india,
      ai_note: f.note?.slice(0, 300) ?? null, last_checked: new Date().toISOString(),
    }
    if (existing) {
      await admin.from('industry_films').update(payload).eq('id', existing.id)
    } else {
      await admin.from('industry_films').insert(payload)
      newFilms.push(f.title)
    }
    upserts++
  }

  // Alert core team on genuinely new releases
  if (newFilms.length) {
    const { data: team } = await admin.from('profiles')
      .select('email, full_name, email_alerts, whatsapp_alerts, whatsapp_number')
      .in('role', ['founder', 'accountant', 'general_manager', 'executive_producer']).eq('is_active', true)
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const html = emailTemplate(`New Malayalam releases — ${dateStr}`,
      `<p style="margin:0 0 12px;">New in cinemas, now tracking day 1–7:</p>` +
      `<ul style="margin:0;padding-left:18px;line-height:1.7;">${newFilms.map(f => `<li><b>${escapeHtml(f)}</b></li>`).join('')}</ul>` +
      `<p style="margin:16px 0 0;font-size:11px;color:#a1a1aa;">Follow their first-week run in Market in the app.</p>`)
    // Email-only: industry-news content isn't an approvable WhatsApp utility template.
    for (const t of team ?? []) {
      if (emailConfigured() && t.email_alerts && t.email) await sendEmail(t.email, `OPM Office — New Malayalam releases (${dateStr})`, html)
    }
  }

  return NextResponse.json({ ok: true, found: films.length, upserts, newFilms })
}
