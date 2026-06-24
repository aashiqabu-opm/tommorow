import tls from 'tls'
import type { SupabaseClient } from '@supabase/supabase-js'
import { whatsappConfigured } from '@/lib/alerts/channels'

// Watchdog probes. Each returns a structured CheckResult; none ever throw —
// a probe that can't run reports itself as 'skipped' so the monitor keeps going.
// Pure read-only: probes observe, they never change anything.

export type CheckStatus = 'healthy' | 'warning' | 'critical' | 'skipped'
export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface CheckResult {
  service: string       // 'opm_website' | 'supabase' | 'twilio' | 'github' | 'ssl' | 'storage'
  checkType: string     // 'http' | 'latency' | 'cert_expiry' | ...
  status: CheckStatus
  severity: Severity
  detail: string
  // Warnings are normally logged-not-paged. alwaysAlert forces a page even at
  // warning severity (SSL expiry, storage ceiling — the spec's "always alert").
  alwaysAlert?: boolean
  meta?: Record<string, unknown>
}

const WEBSITE_URL = process.env.OPM_WEBSITE_URL ?? 'https://opmcinemas.com'
const SLOW_MS = Number(process.env.AGENT_SLOW_RESPONSE_MS ?? 3000)

// Fetch with a hard timeout so a hung host can't stall the whole cron.
async function timedFetch(url: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

// ── Public website: reachable + responsive (HTTP-level uptime) ──
export async function checkWebsite(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const res = await timedFetch(WEBSITE_URL, { method: 'GET', redirect: 'follow' })
    const ms = Date.now() - start
    if (!res.ok) {
      return { service: 'opm_website', checkType: 'http', status: 'critical', severity: 'critical',
        detail: `${WEBSITE_URL} returned HTTP ${res.status}`, meta: { status: res.status, ms } }
    }
    if (ms > SLOW_MS) {
      return { service: 'opm_website', checkType: 'latency', status: 'warning', severity: 'medium',
        detail: `${WEBSITE_URL} responded slowly (${ms}ms > ${SLOW_MS}ms)`, meta: { ms } }
    }
    return { service: 'opm_website', checkType: 'http', status: 'healthy', severity: 'low',
      detail: `${WEBSITE_URL} OK (${ms}ms)`, meta: { ms } }
  } catch (e) {
    return { service: 'opm_website', checkType: 'http', status: 'critical', severity: 'critical',
      detail: `${WEBSITE_URL} unreachable: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ── Supabase: a trivial read confirms the DB + service key are alive ──
export async function checkSupabase(admin: SupabaseClient): Promise<CheckResult> {
  const start = Date.now()
  try {
    const { error } = await admin.from('system_status').select('key', { count: 'exact', head: true })
    const ms = Date.now() - start
    if (error) {
      return { service: 'supabase', checkType: 'query', status: 'critical', severity: 'critical',
        detail: `Supabase query failed: ${error.message}`, meta: { ms } }
    }
    if (ms > 2000) {
      return { service: 'supabase', checkType: 'latency', status: 'warning', severity: 'medium',
        detail: `Supabase slow (${ms}ms > 2000ms)`, meta: { ms } }
    }
    return { service: 'supabase', checkType: 'query', status: 'healthy', severity: 'low',
      detail: `Supabase OK (${ms}ms)`, meta: { ms } }
  } catch (e) {
    return { service: 'supabase', checkType: 'query', status: 'critical', severity: 'critical',
      detail: `Supabase error: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ── SSL certificate expiry for the public site (always-alert when near) ──
// Uses a raw TLS handshake (Node runtime) to read the cert's validTo date.
export function checkSslExpiry(): Promise<CheckResult> {
  let host: string
  try { host = new URL(WEBSITE_URL).hostname } catch {
    return Promise.resolve({ service: 'ssl', checkType: 'cert_expiry', status: 'skipped', severity: 'low',
      detail: `Invalid website URL: ${WEBSITE_URL}` })
  }
  return new Promise<CheckResult>((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 8000 }, () => {
      const cert = socket.getPeerCertificate()
      socket.end()
      if (!cert || !cert.valid_to) {
        return resolve({ service: 'ssl', checkType: 'cert_expiry', status: 'warning', severity: 'medium',
          alwaysAlert: true, detail: `Could not read SSL certificate for ${host}` })
      }
      const expires = new Date(cert.valid_to)
      const days = Math.floor((expires.getTime() - Date.now()) / 86_400_000)
      const meta = { host, expires: expires.toISOString(), days }
      if (days <= 7) {
        resolve({ service: 'ssl', checkType: 'cert_expiry', status: 'critical', severity: 'critical',
          alwaysAlert: true, detail: `SSL cert for ${host} expires in ${days} day(s)`, meta })
      } else if (days <= 30) {
        resolve({ service: 'ssl', checkType: 'cert_expiry', status: 'warning', severity: 'high',
          alwaysAlert: true, detail: `SSL cert for ${host} expires in ${days} days`, meta })
      } else {
        resolve({ service: 'ssl', checkType: 'cert_expiry', status: 'healthy', severity: 'low',
          detail: `SSL cert for ${host} valid for ${days} more days`, meta })
      }
    })
    socket.on('error', (e) => resolve({ service: 'ssl', checkType: 'cert_expiry', status: 'warning', severity: 'medium',
      alwaysAlert: true, detail: `SSL check failed for ${host}: ${e.message}` }))
    socket.on('timeout', () => { socket.destroy(); resolve({ service: 'ssl', checkType: 'cert_expiry', status: 'warning',
      severity: 'medium', alwaysAlert: true, detail: `SSL check timed out for ${host}` }) })
  })
}

// ── Twilio account reachable + active (WhatsApp delivery depends on it) ──
export async function checkTwilio(): Promise<CheckResult> {
  if (!whatsappConfigured()) {
    return { service: 'twilio', checkType: 'account', status: 'skipped', severity: 'low',
      detail: 'Twilio not configured — skipped' }
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  try {
    const res = await timedFetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
      headers: { Authorization: `Basic ${auth}` },
    })
    if (!res.ok) {
      return { service: 'twilio', checkType: 'account', status: 'critical', severity: 'high',
        detail: `Twilio API returned HTTP ${res.status}`, meta: { status: res.status } }
    }
    const body = await res.json() as { status?: string }
    if (body.status && body.status !== 'active') {
      return { service: 'twilio', checkType: 'account', status: 'critical', severity: 'high',
        alwaysAlert: true, detail: `Twilio account status is "${body.status}"`, meta: { status: body.status } }
    }
    return { service: 'twilio', checkType: 'account', status: 'healthy', severity: 'low',
      detail: 'Twilio account active' }
  } catch (e) {
    return { service: 'twilio', checkType: 'account', status: 'warning', severity: 'medium',
      detail: `Twilio check failed: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ── GitHub CI: latest workflow run on the configured repo ──
// Optional: needs GITHUB_TOKEN + GITHUB_REPO ("owner/name"). Skipped otherwise.
export async function checkGitHub(): Promise<CheckResult> {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO
  if (!token || !repo) {
    return { service: 'github', checkType: 'ci', status: 'skipped', severity: 'low',
      detail: 'GITHUB_TOKEN/GITHUB_REPO not set — skipped' }
  }
  try {
    const res = await timedFetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) {
      return { service: 'github', checkType: 'ci', status: 'warning', severity: 'medium',
        detail: `GitHub API returned HTTP ${res.status}`, meta: { status: res.status } }
    }
    const body = await res.json() as { workflow_runs?: { conclusion: string | null; name: string; html_url: string }[] }
    const run = body.workflow_runs?.[0]
    if (!run) {
      return { service: 'github', checkType: 'ci', status: 'healthy', severity: 'low', detail: 'No recent CI runs' }
    }
    if (run.conclusion === 'failure') {
      return { service: 'github', checkType: 'ci', status: 'critical', severity: 'high',
        detail: `Latest CI run "${run.name}" failed on ${repo}`, meta: { url: run.html_url } }
    }
    return { service: 'github', checkType: 'ci', status: 'healthy', severity: 'low',
      detail: `Latest CI run "${run.name}" ${run.conclusion ?? 'in progress'}` }
  } catch (e) {
    return { service: 'github', checkType: 'ci', status: 'warning', severity: 'medium',
      detail: `GitHub check failed: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ── Supabase storage usage (optional — needs the Management API token) ──
// Skipped unless SUPABASE_MGMT_TOKEN + SUPABASE_PROJECT_REF are set, to avoid
// holding a powerful management token just for a watchdog.
export async function checkStorage(): Promise<CheckResult> {
  const token = process.env.SUPABASE_MGMT_TOKEN
  const ref = process.env.SUPABASE_PROJECT_REF
  if (!token || !ref) {
    return { service: 'storage', checkType: 'usage', status: 'skipped', severity: 'low',
      detail: 'SUPABASE_MGMT_TOKEN/SUPABASE_PROJECT_REF not set — skipped' }
  }
  try {
    const res = await timedFetch(`https://api.supabase.com/v1/projects/${ref}/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      return { service: 'storage', checkType: 'usage', status: 'warning', severity: 'low',
        detail: `Supabase usage API returned HTTP ${res.status}` }
    }
    // Usage payload shape varies; surface raw and let the operator refine thresholds.
    const body = await res.json() as Record<string, unknown>
    return { service: 'storage', checkType: 'usage', status: 'healthy', severity: 'low',
      detail: 'Storage usage fetched', meta: { usage: body } }
  } catch (e) {
    return { service: 'storage', checkType: 'usage', status: 'warning', severity: 'low',
      detail: `Storage check failed: ${e instanceof Error ? e.message : String(e)}` }
  }
}
