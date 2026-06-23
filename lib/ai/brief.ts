import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildSnapshot } from '@/lib/ai/snapshot'
import { runTool } from '@/lib/ai/assistant'
import { aiUsage, recordAiUse } from '@/lib/ai/usage'

// ─── Founder Brief: the executive intelligence layer. Combines the shared
//     financial snapshot with cross-module reads (overview, projects,
//     receivables) and asks Claude for a prioritized founder brief, then
//     caches the result in founder_briefs. Founder-only at every layer. ───

const MODEL = 'claude-opus-4-8'

export type BriefTrigger = 'cron' | 'manual' | 'refresh'

export interface BriefContent {
  decisions: { priority: 'critical' | 'high' | 'medium'; title: string; context: string; action: string }[]
  risks: { severity: 'critical' | 'high' | 'medium'; title: string; detail: string }[]
  opportunities: { title: string; detail: string }[]
  company_health: number
  cash_runway_weeks: number
  headline: string
}

export interface FounderBrief {
  id: string
  generated_at: string
  snapshot: unknown
  content: BriefContent
  model: string | null
  tokens_used: number | null
  triggered_by: BriefTrigger
}

const SYSTEM = `You are the executive intelligence layer for OPM Cinemas. Analyze the provided snapshot and produce a founder brief. Return JSON only:
{ decisions: [{priority: 'critical'|'high'|'medium', title: string, context: string, action: string}], risks: [{severity: 'critical'|'high'|'medium', title: string, detail: string}], opportunities: [{title: string, detail: string}], company_health: number (0-100), cash_runway_weeks: number, headline: string }`

// Generate a fresh brief and persist it. Throws on hard failure (no AI key,
// usage cap reached, or the model returned nothing usable).
export async function generateAndStoreBrief(sb: SupabaseClient, triggeredBy: BriefTrigger): Promise<FounderBrief> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('AI is not configured (ANTHROPIC_API_KEY missing).')

  const cap = await aiUsage()
  if (cap.over) throw new Error(`Monthly AI limit reached (${cap.used}/${cap.cap}).`)

  // Finance snapshot + cross-module depth (read-only assistant tools).
  const [snapshot, overview, projects, receivables] = await Promise.all([
    buildSnapshot(sb),
    runTool('financial_overview', {}, sb),
    runTool('list_projects', {}, sb),
    runTool('list_receivables', {}, sb),
  ])

  const context = JSON.stringify({
    snapshot,
    financial_overview: overview,
    projects,
    receivables,
  }, null, 2)

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2500,
    system: SYSTEM,
    messages: [{ role: 'user', content: `Here is today's company data:\n\n${context}\n\nProduce the founder brief. Respond with only the JSON object.` }],
  })

  const block = response.content.find(b => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('The AI returned no brief. Try again.')
  const match = block.text.match(/\{[\s\S]*\}/)
  let parsed: BriefContent
  try { parsed = JSON.parse(match ? match[0] : block.text) as BriefContent }
  catch { throw new Error('The AI returned an unreadable brief. Try again.') }

  const content: BriefContent = {
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
    company_health: Number(parsed.company_health ?? 0),
    cash_runway_weeks: Number(parsed.cash_runway_weeks ?? snapshot.runwayWeeks ?? 0),
    headline: parsed.headline || 'Founder brief',
  }

  const tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0)

  const { data, error } = await sb
    .from('founder_briefs')
    .insert({ snapshot, content, model: MODEL, tokens_used: tokensUsed, triggered_by: triggeredBy })
    .select('*')
    .single()
  if (error || !data) throw new Error(error?.message || 'Could not save the brief.')

  await recordAiUse('founder-brief')
  return data as FounderBrief
}
