import Anthropic from '@anthropic-ai/sdk'

// AI financial-anomaly review. Analyses INTERNAL aggregates (no web search) and
// flags genuine risks — unusual/duplicate spend, vendor concentration, budget
// overruns, compliance gaps, cash strain. Read-only: it flags, never acts.

export interface AnomalyFinding {
  severity: 'high' | 'medium' | 'low'
  category: string          // e.g. 'spend' | 'vendor' | 'budget' | 'compliance' | 'cash'
  title: string
  detail: string
}

export const anomalyConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY)

const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          severity: { type: 'string', description: 'high | medium | low' },
          category: { type: 'string', description: 'spend | vendor | budget | compliance | cash | other' },
          title: { type: 'string', description: 'One concise line.' },
          detail: { type: 'string', description: 'One or two sentences with the concrete numbers and why it matters.' },
        },
        required: ['severity', 'category', 'title', 'detail'],
      },
    },
  },
  required: ['findings'],
} as const

const SYSTEM = `You are a sharp financial controller for an Indian film-production company (amounts in ₹). You are given AGGREGATED internal data. Flag GENUINE anomalies and risks a producer should know about — for example: a payment that's unusually large vs the norm for that party/category; the same party paid suspiciously similar amounts repeatedly (possible duplicate); heavy concentration of spend in one vendor; budget heads run over estimate; a sharp month-on-month spend spike; TDS deducted without a PAN, or large payments with no GST; tight cash vs upcoming obligations. Use the actual numbers. Do NOT invent data or flag normal activity. Prioritise by real impact; high severity only for clear, material issues. If nothing stands out, return an empty list. Respond with ONLY JSON: {"findings": [{"severity","category","title","detail"}]}.`

export async function detectAnomalies(snapshot: unknown): Promise<AnomalyFinding[] | null> {
  if (!anomalyConfigured()) return null
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const res = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 3000,
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: `Review this financial snapshot and flag anomalies:\n${JSON.stringify(snapshot)}` }],
    })
    const text = res.content.find(b => b.type === 'text')
    if (!text || text.type !== 'text') return null
    const out = JSON.parse(text.text) as { findings?: AnomalyFinding[] }
    return (out.findings ?? []).filter(f => f && f.title).slice(0, 20)
  } catch (e) {
    throw e   // let the route classify credit errors / cap
  }
}
