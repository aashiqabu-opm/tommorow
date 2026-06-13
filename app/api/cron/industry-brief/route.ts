import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, sendWhatsApp, emailTemplate, emailConfigured, whatsappConfigured } from '@/lib/alerts/channels'
import { escapeHtml } from '@/lib/alerts/deliver'
import { compileIndustryBrief, intelConfigured } from '@/lib/ai/release-intel'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Weekly Malayalam industry brief. AI web-searches recent releases, collections,
// upcoming films and notable news, stores the brief, and sends it to the founder
// and core team (management). General market info — not our own films.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  if (!intelConfigured()) return NextResponse.json({ ok: true, skipped: 'ANTHROPIC_API_KEY not set' })

  const brief = await compileIndustryBrief()
  if (!brief) return NextResponse.json({ ok: true, skipped: 'no brief produced' })

  const weekOf = new Date().toISOString().slice(0, 10)
  await admin.from('industry_briefs').upsert({
    week_of: weekOf, headline: brief.headline?.slice(0, 300) ?? null,
    summary: brief.summary?.slice(0, 4000) ?? null, items: brief.items ?? [],
  }, { onConflict: 'week_of' })

  // Deliver to founder + core team (management)
  const { data: team } = await admin.from('profiles')
    .select('email, full_name, email_alerts, whatsapp_alerts, whatsapp_number')
    .in('role', ['founder', 'accountant', 'general_manager', 'executive_producer']).eq('is_active', true)

  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const itemsHtml = (brief.items ?? []).slice(0, 12).map(it =>
    `<li><b>${escapeHtml(it.film)}</b>${it.collection ? ` — ${escapeHtml(it.collection)}` : ''}${it.trend ? ` <span style="color:#a1a1aa;">(${escapeHtml(it.trend)})</span>` : ''}<br/><span style="font-size:12px;color:#a1a1aa;">${escapeHtml(it.note)}</span></li>`).join('')
  const html = emailTemplate(`Malayalam market brief — ${dateStr}`,
    `<p style="margin:0 0 12px;">${escapeHtml(brief.summary ?? brief.headline ?? '')}</p>` +
    (itemsHtml ? `<ul style="margin:0;padding-left:18px;line-height:1.7;">${itemsHtml}</ul>` : '') +
    `<p style="margin:16px 0 0;font-size:11px;color:#a1a1aa;">Weekly market snapshot from your OPM Office AI. Open Market in the app for the full brief.</p>`)
  const waText = `*OPM Office — Malayalam Market Brief (${dateStr})*\n${brief.headline ?? brief.summary ?? ''}`

  let sent = 0
  for (const t of team ?? []) {
    if (emailConfigured() && t.email_alerts && t.email) { if (await sendEmail(t.email, `OPM Office — Malayalam Market Brief (${dateStr})`, html)) sent++ }
    if (whatsappConfigured() && t.whatsapp_alerts && t.whatsapp_number) { if (await sendWhatsApp(t.whatsapp_number, waText)) sent++ }
  }

  return NextResponse.json({ ok: true, items: brief.items?.length ?? 0, recipients: (team ?? []).length, sent })
}
