import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, sendWhatsApp, emailTemplate, whatsappConfigured, emailConfigured } from '@/lib/alerts/channels'
import { escapeHtml } from '@/lib/alerts/deliver'
import { assessProjectStage, stageRank, type StageSignals } from '@/lib/ai/project-stage'
import { withCronErrorAlert } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STATUS_LABEL: Record<string, string> = {
  development: 'Development', active: 'Shooting', post_production: 'Post-Production', released: 'Released',
}

// Daily AI stage monitor. For each live project it reads operational signals,
// asks Claude which stage the film is in, and AUTO-ADVANCES the stage forward
// (never backward, never on_hold/cancelled). Every change is audit-logged and
// the founder is notified. It never touches money — stage only.
export async function GET(request: Request) {
  return withCronErrorAlert('project-stages', () => run(request))
}
async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set' }, { status: 500 })

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const daysBetween = (a: string) => Math.floor((today.getTime() - new Date(a).getTime()) / 86400000)

  // Only manage projects in the natural lifecycle; leave on_hold / cancelled alone.
  const { data: projects } = await admin.from('projects')
    .select('id, name, status, start_date, end_date')
    .in('status', ['development', 'active', 'post_production', 'released'])

  if (!projects?.length) return NextResponse.json({ ok: true, projects: 0 })

  // Actor for audit rows (AI changes are attributed to a founder account).
  const { data: founders } = await admin.from('profiles')
    .select('id, full_name, email, email_alerts, whatsapp_alerts, whatsapp_number')
    .eq('role', 'founder').eq('is_active', true)
  const actorId = founders?.[0]?.id

  const changes: { name: string; from: string; to: string; reason: string }[] = []

  for (const p of projects as { id: string; name: string; status: string; start_date: string | null; end_date: string | null }[]) {
    // Gather signals
    const [dprs, pays, income] = await Promise.all([
      admin.from('production_reports').select('report_date').eq('project_id', p.id).order('report_date', { ascending: false }),
      admin.from('payment_requests').select('id, created_at').eq('project_id', p.id).gte('created_at', new Date(today.getTime() - 30 * 86400000).toISOString()),
      admin.from('project_income').select('source').eq('project_id', p.id),
    ])
    const dprRows = (dprs.data ?? []) as { report_date: string }[]
    const lastDpr = dprRows[0]?.report_date ?? null
    const incomeRows = (income.data ?? []) as { source: string }[]
    const hasReleaseIncome = incomeRows.some(i => ['theatrical', 'ott', 'satellite', 'music'].includes(i.source))

    const signals: StageSignals = {
      name: p.name,
      current_status: p.status,
      start_date: p.start_date,
      end_date: p.end_date,
      shoot_days_logged: dprRows.length,
      last_dpr_date: lastDpr,
      days_since_last_dpr: lastDpr ? daysBetween(lastDpr) : null,
      recent_payments_30d: (pays.data ?? []).length,
      has_release_income: hasReleaseIncome,
      today: todayStr,
    }

    const verdict = await assessProjectStage(signals)

    // Apply only FORWARD moves we're reasonably sure about.
    const movesForward = stageRank(verdict.suggested_status) > stageRank(p.status)
    if (!movesForward || verdict.confidence === 'low') continue

    await admin.from('projects').update({
      status: verdict.suggested_status,
      ai_status_reason: verdict.reason,
      ai_status_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', p.id)

    if (actorId) {
      await admin.from('audit_logs').insert({
        user_id: actorId, action: 'ai_stage_update', entity_type: 'projects', entity_id: p.id,
        old_values: { status: p.status }, new_values: { status: verdict.suggested_status, reason: verdict.reason, by: 'AI monitor' },
      })
      // In-app notification for every founder
      await admin.from('notifications').insert(
        (founders ?? []).map(f => ({
          user_id: f.id, title: `${p.name} → ${STATUS_LABEL[verdict.suggested_status]}`,
          body: verdict.reason, entity_type: 'projects', entity_id: p.id,
        }))
      )
    }

    changes.push({ name: p.name, from: STATUS_LABEL[p.status], to: STATUS_LABEL[verdict.suggested_status], reason: verdict.reason })
  }

  // Notify founders by email/WhatsApp if anything moved
  if (changes.length && founders?.length) {
    const dateStr = today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const rows = changes.map(c =>
      `<li><b>${escapeHtml(c.name)}</b>: ${escapeHtml(c.from)} → ${escapeHtml(c.to)}<br/><span style="color:#a1a1aa;font-size:12px;">${escapeHtml(c.reason)}</span></li>`).join('')
    const html = emailTemplate(`Project stages updated — ${dateStr}`,
      `<p style="margin:0 0 12px;">Your AI monitor advanced ${changes.length} project stage${changes.length > 1 ? 's' : ''} today:</p>` +
      `<ul style="margin:0;padding-left:18px;line-height:1.7;">${rows}</ul>` +
      `<p style="margin:16px 0 0;font-size:11px;color:#a1a1aa;">Stage only — no money or records were changed. Open the project to revert if needed.</p>`)
    const waText = `*OPM Flash — Stages updated (${dateStr})*\n` + changes.map(c => `• ${c.name}: ${c.from} → ${c.to}`).join('\n')
    for (const f of founders) {
      if (emailConfigured() && f.email_alerts && f.email) await sendEmail(f.email, `OPM Flash — Project stages updated (${dateStr})`, html)
      if (whatsappConfigured() && f.whatsapp_alerts && f.whatsapp_number) await sendWhatsApp(f.whatsapp_number, waText)
    }
  }

  return NextResponse.json({ ok: true, projects: projects.length, changed: changes.length, changes })
}
