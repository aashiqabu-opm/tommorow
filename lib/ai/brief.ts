import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildSnapshot } from '@/lib/ai/snapshot'
import { buildOversightFinance } from '@/lib/ai/oversight'
import { runTool } from '@/lib/ai/assistant'
import { aiUsage, recordAiUse } from '@/lib/ai/usage'

// ─── Role briefs: the executive intelligence layer. One engine, four
//     audiences. The founder gets the full picture (incl. bank/cash); the
//     accountant gets full finance; the EP (operations) and GM (production)
//     get a redacted finance oversight (liabilities + aggregate totals only,
//     NO bank balances, NO row-level entries) plus their domain context.
//     Founder briefs are cached in founder_briefs; the other three share
//     role_briefs (per-role RLS). ───

const MODEL = 'claude-opus-4-8'

export type Audience = 'founder' | 'accountant' | 'executive_producer' | 'general_manager'
export type BriefTrigger = 'cron' | 'manual' | 'refresh'

export interface BriefContent {
  decisions: { priority: 'critical' | 'high' | 'medium'; title: string; context: string; action: string }[]
  risks: { severity: 'critical' | 'high' | 'medium'; title: string; detail: string }[]
  opportunities: { title: string; detail: string }[]
  company_health: number
  cash_runway_weeks: number
  headline: string
}

export interface StoredBrief {
  id: string
  audience?: Audience
  generated_at: string
  snapshot: unknown
  content: BriefContent
  model: string | null
  tokens_used: number | null
  triggered_by: BriefTrigger
}

interface BriefProfile {
  table: 'founder_briefs' | 'role_briefs'
  finance: 'full' | 'oversight'
  includeProduction: boolean   // per-active-film shoot/production depth
  includeReceivables: boolean  // itemized receivables (finance-cleared only)
  system: string
}

// Header/label metadata, shared with the page so the UI renders per audience.
export const BRIEF_META: Record<Audience, { label: string; healthLabel: string; showRunway: boolean }> = {
  founder: { label: 'Founder Brief', healthLabel: 'Company Health', showRunway: true },
  accountant: { label: 'Finance Brief', healthLabel: 'Financial Health', showRunway: true },
  executive_producer: { label: 'Operations Brief', healthLabel: 'Operations Health', showRunway: false },
  general_manager: { label: 'Production Brief', healthLabel: 'Production Health', showRunway: false },
}

export const BRIEF_AUDIENCES: Audience[] = ['founder', 'accountant', 'executive_producer', 'general_manager']
export function isAudience(role: string): role is Audience {
  return (BRIEF_AUDIENCES as string[]).includes(role)
}

const CONTRACT = `Respond with ONLY a JSON object (no prose, no code fences) with exactly these keys: headline (string, ≤ 90 chars), decisions (array of {priority: 'critical'|'high'|'medium', title, context, action}), risks (array of {severity: 'critical'|'high'|'medium', title, detail}), opportunities (array of {title, detail}), company_health (number 0-100), cash_runway_weeks (number).`

// EP/GM share an explicit no-finance-leak instruction (defence in depth — the
// input is already redacted, but the model must never invent a balance).
const NO_FINANCE = 'You are NOT given bank balances, cash position, or individual transaction entries — never state, estimate, or infer them. Set cash_runway_weeks to 0.'

const PROFILES: Record<Audience, BriefProfile> = {
  founder: {
    table: 'founder_briefs', finance: 'full', includeProduction: true, includeReceivables: true,
    system: `You are the executive intelligence layer for OPM Cinemas, a film-production company in India (amounts in ₹). Analyze the provided data and produce a founder brief: only what genuinely needs attention, ordered by urgency and money at risk — decisions to make, risks, and opportunities — across cash, projects and contracts. Be specific with names and ₹ amounts. ${CONTRACT}`,
  },
  accountant: {
    table: 'role_briefs', finance: 'full', includeProduction: false, includeReceivables: true,
    system: `You are the finance intelligence layer for OPM Cinemas (amounts in ₹). The reader is the company accountant. Surface what finance must act on today: payment approvals to verify, reconciliation gaps, overdue dues and receivables, tax/compliance deadlines, and budget heads trending over estimate. Set cash_runway_weeks from the data; company_health is overall financial health. Be specific with names and ₹ amounts. ${CONTRACT}`,
  },
  executive_producer: {
    table: 'role_briefs', finance: 'oversight', includeProduction: true, includeReceivables: false,
    system: `You are the operations intelligence layer for OPM Cinemas (amounts in ₹). The reader is the Executive Producer overseeing operations. Focus on: the approval/payment load (counts and totals only), outstanding liabilities and dues, vendor and agreement documents with upcoming dates or risk flags, and the operational status of active films and their blockers. ${NO_FINANCE} company_health is an operations-health score (0-100). Be specific with names and ₹ amounts where given. ${CONTRACT}`,
  },
  general_manager: {
    table: 'role_briefs', finance: 'oversight', includeProduction: true, includeReceivables: false,
    system: `You are the production intelligence layer for OPM Cinemas (amounts in ₹). The reader is the General Manager overseeing production. Focus on: shoot progress versus plan across active films, schedules and next shoot days, deliverables and deal-memo status, crew logistics and check-in blockers; plus company dues/liabilities and the approval load at an aggregate level. ${NO_FINANCE} company_health is a production-health score (0-100). Be specific with names where given. ${CONTRACT}`,
  },
}

type Ctx = Record<string, unknown>

// Assemble the audience-appropriate context. The finance shape is chosen by
// profile — 'oversight' is structurally redacted, so bank/cash never enter an
// EP/GM context (or their stored snapshot).
async function gatherContext(sb: SupabaseClient, p: BriefProfile): Promise<{ ctx: Ctx; financeSnapshot: unknown }> {
  const financeSnapshot = p.finance === 'full' ? await buildSnapshot(sb) : await buildOversightFinance()
  const ctx: Ctx = { finance: financeSnapshot }

  const [projects, documents] = await Promise.all([
    runTool('list_projects', {}, sb),
    runTool('search_documents', {}, sb),
  ])
  ctx.projects = projects
  ctx.documents = documents

  if (p.includeReceivables) ctx.receivables = await runTool('list_receivables', {}, sb)

  if (p.includeProduction) {
    const list = (Array.isArray(projects) ? projects : []) as { name: string; status: string }[]
    const active = list.filter(x => ['active', 'post_production'].includes(x.status)).slice(0, 5)
    ctx.production = await Promise.all(active.map(async film => ({
      film: film.name,
      shoot: await runTool('shoot_progress', { project: film.name }, sb),
      production: await runTool('project_production', { project: film.name }, sb),
    })))
  }

  return { ctx, financeSnapshot }
}

// Generate a fresh brief for the given audience and persist it. Throws on hard
// failure (no AI key, usage cap, or unusable model output).
export async function generateAndStoreBrief(sb: SupabaseClient, audience: Audience, triggeredBy: BriefTrigger): Promise<StoredBrief> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('AI is not configured (ANTHROPIC_API_KEY missing).')

  const cap = await aiUsage()
  if (cap.over) throw new Error(`Monthly AI limit reached (${cap.used}/${cap.cap}).`)

  const profile = PROFILES[audience]
  const { ctx, financeSnapshot } = await gatherContext(sb, profile)
  const context = JSON.stringify(ctx, null, 2)

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2500,
    system: profile.system,
    messages: [{ role: 'user', content: `Here is today's company data:\n\n${context}\n\nProduce the brief. Respond with only the JSON object.` }],
  })

  const block = response.content.find(b => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('The AI returned no brief. Try again.')
  const match = block.text.match(/\{[\s\S]*\}/)
  let parsed: BriefContent
  try { parsed = JSON.parse(match ? match[0] : block.text) as BriefContent }
  catch { throw new Error('The AI returned an unreadable brief. Try again.') }

  const fin = financeSnapshot as { runwayWeeks?: number | null } | null
  const content: BriefContent = {
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
    company_health: Number(parsed.company_health ?? 0),
    cash_runway_weeks: Number(parsed.cash_runway_weeks ?? fin?.runwayWeeks ?? 0),
    headline: parsed.headline || BRIEF_META[audience].label,
  }

  const tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)

  // Founder → founder_briefs (no audience column). Others → role_briefs.
  const row: Record<string, unknown> = { snapshot: financeSnapshot, content, model: MODEL, tokens_used: tokensUsed, triggered_by: triggeredBy }
  if (profile.table === 'role_briefs') row.audience = audience

  const { data, error } = await sb.from(profile.table).insert(row).select('*').single()
  if (error || !data) throw new Error(error?.message || 'Could not save the brief.')

  await recordAiUse('role-brief')
  return data as StoredBrief
}
