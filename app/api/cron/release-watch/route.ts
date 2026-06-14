import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, sendWhatsApp, emailTemplate, emailConfigured, whatsappConfigured } from '@/lib/alerts/channels'
import { escapeHtml } from '@/lib/alerts/deliver'
import { fetchCollectionEstimate, scanOnline, trackCampaignAsset, intelConfigured } from '@/lib/ai/release-intel'
import { releaseWindow } from '@/lib/phases'
import { withCronErrorAlert } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Daily release watch. For each shooting/post/released film:
//   1. Auto-fetch the latest box-office number (staged UNCONFIRMED for review)
//   2. Scan the web for piracy + coordinated hate/negative campaigns
// High-severity findings alert the founder. Read-only on money & records.
export async function GET(request: Request) {
  return withCronErrorAlert('release-watch', () => run(request))
}
async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })
  if (!intelConfigured()) return NextResponse.json({ ok: true, skipped: 'ANTHROPIC_API_KEY not set' })

  const today = new Date().toISOString().slice(0, 10)

  // Only scan films inside their release window (release day −3 to +30) to keep
  // web-search cost down. Window is driven by release_date, or "recently
  // flipped to Released" when no date is set.
  const { data: all } = await admin.from('projects')
    .select('id, name, status, start_date, release_date, ai_status_at')
    .in('status', ['post_production', 'released'])

  const projects = (all ?? []).filter(p => releaseWindow(p).active)
  if (!projects.length) return NextResponse.json({ ok: true, projects: 0, skipped: (all ?? []).length, note: 'no films in release window' })

  const { data: founders } = await admin.from('profiles')
    .select('id, full_name, email, email_alerts, whatsapp_alerts, whatsapp_number')
    .eq('role', 'founder').eq('is_active', true)

  let collectionsAdded = 0
  let findingsAdded = 0
  const alerts: { film: string; severity: string; category: string; title: string }[] = []

  for (const p of projects as { id: string; name: string; status: string; start_date: string | null }[]) {
    const ctx = p.start_date ? `OPM Cinemas film, around release/${p.status}, started ${p.start_date}` : `OPM Cinemas film, ${p.status}`

    // 1. Box office — only meaningful once released
    if (p.status === 'released') {
      const est = await fetchCollectionEstimate(p.name, ctx)
      if (est && (est.india_net || est.worldwide_gross)) {
        const { error } = await admin.from('box_office_collections').upsert({
          project_id: p.id, collection_date: today, day_number: est.day_number,
          india_net: est.india_net, worldwide_gross: est.worldwide_gross,
          source: est.source ?? 'AI web search', confirmed: false,
          notes: est.note?.slice(0, 300) ?? null,
        }, { onConflict: 'project_id,collection_date' })
        if (!error) collectionsAdded++
      }
    }

    // 2. Refresh campaign-asset buzz (aggressive while in the release window)
    const { data: assets } = await admin.from('campaign_assets').select('id, asset_type, title, url').eq('project_id', p.id)
    for (const a of (assets ?? []) as { id: string; asset_type: string; title: string; url: string | null }[]) {
      const buzz = await trackCampaignAsset(p.name, a.asset_type, a.title, a.url)
      if (buzz) {
        await admin.from('campaign_assets').update({
          ai_summary: buzz.summary, ai_metrics: { ...buzz.metrics, sentiment: buzz.sentiment }, last_checked: new Date().toISOString(),
        }).eq('id', a.id)
      }
    }

    // 3. Online piracy + reputation scan
    const findings = await scanOnline(p.name, ctx)
    for (const f of findings) {
      const { error } = await admin.from('monitoring_findings').insert({
        project_id: p.id, scan_date: today, category: f.category,
        severity: f.severity, title: f.title.slice(0, 200), detail: f.detail?.slice(0, 1000) ?? null, url: f.url ?? null,
      })
      if (!error) {
        findingsAdded++
        if (f.severity === 'high') alerts.push({ film: p.name, severity: f.severity, category: f.category, title: f.title })
      }
    }
  }

  // Alert founders on high-severity findings
  if (alerts.length && founders?.length) {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const rows = alerts.map(a =>
      `<li><b>${escapeHtml(a.film)}</b> — <span style="text-transform:uppercase;font-size:11px;color:#dc2626;">${escapeHtml(a.category)}</span>: ${escapeHtml(a.title)}</li>`).join('')
    const html = emailTemplate(`⚠️ Release watch — ${alerts.length} urgent finding${alerts.length > 1 ? 's' : ''}`,
      `<p style="margin:0 0 12px;">Today's scan flagged high-severity items:</p>` +
      `<ul style="margin:0;padding-left:18px;line-height:1.7;">${rows}</ul>` +
      `<p style="margin:16px 0 0;font-size:11px;color:#a1a1aa;">Open the project's Release Watch to see links and full detail. The app never acts on these automatically.</p>`)
    const waText = `*OPM Office — Release Watch (${dateStr})*\n` + alerts.map(a => `⚠️ ${a.film} — ${a.category}: ${a.title}`).join('\n')
    for (const f of founders) {
      if (emailConfigured() && f.email_alerts && f.email) await sendEmail(f.email, `OPM Office — Release Watch: ${alerts.length} urgent`, html)
      if (whatsappConfigured() && f.whatsapp_alerts && f.whatsapp_number) await sendWhatsApp(f.whatsapp_number, waText)
    }
  }

  return NextResponse.json({ ok: true, projects: projects.length, collectionsAdded, findingsAdded, urgent: alerts.length })
}
