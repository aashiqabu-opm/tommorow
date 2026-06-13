import Anthropic from '@anthropic-ai/sdk'

// AI stage assessor. Reads operational signals for one film and decides which
// lifecycle stage it's in. Read-only on its own — the caller decides whether to
// apply, and only ever moves a project FORWARD through the lifecycle.

export type Stage = 'development' | 'active' | 'post_production' | 'released'

// Lifecycle order — the cron only advances forward through these.
export const STAGE_ORDER: Stage[] = ['development', 'active', 'post_production', 'released']
export const stageRank = (s: string): number => STAGE_ORDER.indexOf(s as Stage)

export interface StageSignals {
  name: string
  current_status: string
  start_date: string | null
  end_date: string | null
  shoot_days_logged: number
  last_dpr_date: string | null
  days_since_last_dpr: number | null
  recent_payments_30d: number
  has_release_income: boolean   // theatrical / OTT / satellite income recorded
  today: string
}

export interface StageVerdict {
  suggested_status: Stage
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    suggested_status: { type: 'string', description: 'One of: development, active, post_production, released' },
    reason: { type: 'string', description: 'One concise sentence (max ~140 chars) explaining the stage, in plain language for the producer.' },
    confidence: { type: 'string', description: 'One of: high, medium, low' },
  },
  required: ['suggested_status', 'reason', 'confidence'],
} as const

const SYSTEM = `You classify the production lifecycle stage of an Indian film for a producer's internal ops app. Stages:
- development: pre-shoot. No shoot days logged yet, or only planning/paperwork activity.
- active: actively shooting. Daily Production Reports are being logged recently (within ~2 weeks).
- post_production: shoot has wrapped. Shoot days were logged but the last DPR is well in the past (~3+ weeks) and there's no release income yet — editing/VFX/sound stage.
- released: the film has released. Release income recorded (theatrical/OTT/satellite), or end_date is clearly in the past with release income.

Use the signals provided. Be conservative: only pick a later stage when the signals clearly support it. Return high confidence only when the picture is unambiguous. Keep the reason short and specific (mention the concrete signal, e.g. "Last shoot report 24 days ago, no release income — in post.").`

function deterministic(s: StageSignals): StageVerdict {
  if (s.has_release_income) return { suggested_status: 'released', reason: 'Release income recorded.', confidence: 'high' }
  if (s.shoot_days_logged > 0 && (s.days_since_last_dpr ?? 0) >= 21)
    return { suggested_status: 'post_production', reason: `Shoot wrapped — last report ${s.days_since_last_dpr} days ago.`, confidence: 'medium' }
  if (s.shoot_days_logged > 0 && (s.days_since_last_dpr ?? 99) <= 14)
    return { suggested_status: 'active', reason: 'Daily production reports are being logged — actively shooting.', confidence: 'high' }
  return { suggested_status: 'development', reason: 'No recent shoot activity logged.', confidence: 'low' }
}

export async function assessProjectStage(signals: StageSignals): Promise<StageVerdict> {
  if (!process.env.ANTHROPIC_API_KEY) return deterministic(signals)
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: `Signals:\n${JSON.stringify(signals, null, 2)}\n\nClassify the stage.` }],
    })
    const text = response.content.find(b => b.type === 'text')
    if (!text || text.type !== 'text') return deterministic(signals)
    const v = JSON.parse(text.text) as StageVerdict
    if (!STAGE_ORDER.includes(v.suggested_status)) return deterministic(signals)
    return v
  } catch {
    return deterministic(signals)
  }
}
