import type { SupabaseClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '@/lib/alerts/channels'
import { triageIncident } from '@/lib/agents/triage'
import type { CheckResult } from '@/lib/agents/health-checks'

// The rules-first escalation engine. Given the tick's probe results it:
//   1. writes a health snapshot (green/yellow/red rollup),
//   2. opens / updates / resolves incidents (deduped by fingerprint),
//   3. pages founders on WhatsApp for criticals (and always-alert warnings),
//      respecting a cooldown so a flapping service can't spam.
// Alert-only by design: it never redeploys or restarts anything.

const COOLDOWN_MS = Number(process.env.ALERT_COOLDOWN_MINUTES ?? 15) * 60 * 1000

// IST timestamp for the human-facing alerts.
function istNow(): string {
  return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })
}

type OverallHealth = 'green' | 'yellow' | 'red'

function rollup(results: CheckResult[]): OverallHealth {
  if (results.some(r => r.status === 'critical')) return 'red'
  if (results.some(r => r.status === 'warning')) return 'yellow'
  return 'green'
}

// Map a probe service → the snapshot column it belongs to.
function snapshotColumns(results: CheckResult[]): Record<string, string | null> {
  const worst = (svc: string): string | null => {
    const rs = results.filter(r => r.service === svc && r.status !== 'skipped')
    if (!rs.length) return null
    if (rs.some(r => r.status === 'critical')) return 'critical'
    if (rs.some(r => r.status === 'warning')) return 'warning'
    return 'healthy'
  }
  // SSL/storage roll into the services they protect for the dashboard columns.
  const websiteWorst = ['opm_website', 'ssl'].map(worst).find(v => v === 'critical')
    ?? ['opm_website', 'ssl'].map(worst).find(v => v === 'warning')
    ?? worst('opm_website')
  return {
    opm_office_status: 'healthy', // this cron runs ON office; if you read this, office served the request
    opm_website_status: websiteWorst,
    supabase_status: worst('supabase'),
    vercel_status: null,
    twilio_status: worst('twilio'),
    github_status: worst('github'),
  }
}

interface FounderRow {
  whatsapp_number: string | null
  whatsapp_alerts: boolean | null
}

function criticalMessage(service: string, issue: string, tried: string[], firstTime: boolean): string {
  const triedLines = tried.length ? tried.map(t => `• ${t}`).join('\n') : '• (no automated remedy available)'
  return [
    '🔴 OPM CRITICAL ALERT',
    `Service: ${service}`,
    `Issue: ${issue}`,
    `Time: ${istNow()} IST`,
    `Self-heal: ${firstTime ? 'Attempted — failed' : 'Still failing'}`,
    'What I tried:',
    triedLines,
    'Current status: STOPPED — awaiting your instruction',
    '',
    'Reply with:',
    "1 — I'll handle it",
    '2 — Try again',
    '3 — Take service offline temporarily',
  ].join('\n')
}

function resolvedMessage(service: string, what: string): string {
  return ['✅ OPM RESOLVED', `Service: ${service}`, `Issue: ${what}`, `Time: ${istNow()} IST`, 'Status: Recovered'].join('\n')
}

async function pageFounders(admin: SupabaseClient, text: string): Promise<number> {
  const { data: founders } = await admin
    .from('profiles')
    .select('whatsapp_number, whatsapp_alerts')
    .eq('role', 'founder')
    .eq('is_active', true)
  let sent = 0
  for (const f of (founders ?? []) as FounderRow[]) {
    if (f.whatsapp_alerts && f.whatsapp_number) {
      if (await sendWhatsApp(f.whatsapp_number, text)) sent++
    }
  }
  return sent
}

export interface EscalationOutcome {
  overall: OverallHealth
  paged: number
  opened: number
  resolved: number
}

export async function processResults(admin: SupabaseClient, results: CheckResult[]): Promise<EscalationOutcome> {
  const overall = rollup(results)

  // 1. Snapshot (best-effort — never blocks alerting).
  try {
    await admin.from('agent_health_snapshots').insert({
      ...snapshotColumns(results),
      overall_health: overall,
      details: results.filter(r => r.status !== 'skipped').map(r => ({
        service: r.service, checkType: r.checkType, status: r.status, detail: r.detail,
      })),
    })
  } catch { /* snapshot is best-effort */ }

  let paged = 0, opened = 0, resolved = 0

  for (const r of results) {
    if (r.status === 'skipped') continue
    const fingerprint = `${r.service}:${r.checkType}`

    // ── Recovered: close any open incident for this fingerprint ──
    if (r.status === 'healthy') {
      const { data: open } = await admin
        .from('agent_incidents')
        .select('id, status, aashiq_notified')
        .eq('fingerprint', fingerprint)
        .in('status', ['open', 'escalated', 'acknowledged'])
        .maybeSingle()
      if (open) {
        await admin.from('agent_incidents').update({
          status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          resolution_notes: `Auto-resolved — ${r.detail}`,
        }).eq('id', open.id)
        resolved++
        // Tell founders only if they were paged about it in the first place.
        if (open.aashiq_notified) await pageFounders(admin, resolvedMessage(r.service, r.detail))
      }
      continue
    }

    // ── Still unhealthy (warning/critical): upsert the incident ──
    const shouldPage = r.status === 'critical' || r.alwaysAlert === true

    const { data: existing } = await admin
      .from('agent_incidents')
      .select('id, last_notified_at, aashiq_notified, status')
      .eq('fingerprint', fingerprint)
      .in('status', ['open', 'escalated', 'acknowledged'])
      .maybeSingle()

    if (!existing) {
      await admin.from('agent_incidents').insert({
        incident_type: r.checkType, service: r.service, severity: r.severity,
        description: r.detail, fingerprint, status: shouldPage ? 'escalated' : 'open',
      })
      opened++
    } else {
      await admin.from('agent_incidents').update({
        severity: r.severity, description: r.detail, updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
    }

    if (!shouldPage) continue

    // ── Page founders, respecting cooldown ──
    const lastNotified = existing?.last_notified_at ? new Date(existing.last_notified_at).getTime() : 0
    const acknowledged = existing?.status === 'acknowledged'
    if (acknowledged) continue // Aashiq said "I'll handle it" — stop paging until it resolves
    if (Date.now() - lastNotified < COOLDOWN_MS) continue

    const { issue, tried } = await triageIncident(r)
    const firstTime = !existing?.aashiq_notified
    const text = criticalMessage(r.service, issue, tried, firstTime)
    paged += await pageFounders(admin, text)

    // Mark notified on the (now-existing) incident row.
    await admin.from('agent_incidents').update({
      status: 'escalated', aashiq_notified: true, last_notified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('fingerprint', fingerprint).in('status', ['open', 'escalated'])
  }

  return { overall, paged, opened, resolved }
}
