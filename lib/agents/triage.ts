import Anthropic from '@anthropic-ai/sdk'
import type { CheckResult } from '@/lib/agents/health-checks'

// Claude is the watchdog's brain ONLY for the rare red event: it turns a raw
// failed probe into a plain-English explanation + the things already tried.
// It is never called on green ticks (cost), and it never takes actions — the
// monitor is alert-only; destructive steps wait for Aashiq's reply.

const MODEL = process.env.AGENT_MODEL ?? 'claude-opus-4-8'

export interface Triage {
  issue: string       // plain-English description of what went wrong
  tried: string[]     // what the system already attempted (retries/backoff)
}

const SYSTEM = `You are the on-call SRE for OPM Cinemas' infrastructure. You receive a failed health check from the automated watchdog. Explain, in one or two plain sentences a non-technical founder can act on, what is wrong and the likely cause. Do NOT propose financial actions. Do NOT invent steps that weren't taken. Respond with ONLY a JSON object: {"issue": string, "tried": string[]}. "tried" lists what the automated system already attempted (e.g. retries) — keep it short and factual; use an empty array if nothing automated was possible.`

// Deterministic fallback so an alert always goes out even without/with-failed AI.
function fallback(result: CheckResult): Triage {
  return { issue: result.detail, tried: ['Automated re-check on the next monitor cycle'] }
}

export async function triageIncident(result: CheckResult): Promise<Triage> {
  if (!process.env.ANTHROPIC_API_KEY) return fallback(result)
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: `Failed check:\nservice=${result.service}\ntype=${result.checkType}\nseverity=${result.severity}\ndetail=${result.detail}\nmeta=${JSON.stringify(result.meta ?? {})}\n\nReturn only the JSON object.`,
      }],
    })
    const block = response.content.find(b => b.type === 'text')
    if (!block || block.type !== 'text') return fallback(result)
    const match = block.text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : block.text) as Partial<Triage>
    return {
      issue: parsed.issue?.trim() || result.detail,
      tried: Array.isArray(parsed.tried) && parsed.tried.length ? parsed.tried.map(String) : fallback(result).tried,
    }
  } catch {
    return fallback(result)
  }
}
