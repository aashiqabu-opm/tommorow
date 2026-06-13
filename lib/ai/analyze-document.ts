import Anthropic from '@anthropic-ai/sdk'

// Reads an uploaded agreement/contract (PDF or image) with Claude and returns a
// structured analysis: summary, parties, key dates, financial terms, obligations
// and risk flags. Server-side only. Degrades gracefully if no API key.

export interface DocKeyDate { label: string; date: string; kind: string }
export interface DocFinancialTerm { label: string; amount: number | null; note: string }
export interface DocFlag { severity: string; note: string }

export interface DocumentAnalysis {
  summary: string
  doc_type: string
  parties: string[]
  key_dates: DocKeyDate[]
  financial_terms: DocFinancialTerm[]
  obligations: string[]
  flags: DocFlag[]
}

export function documentAnalysisConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: '2–3 sentence plain-English summary of what this document is and its core purpose.' },
    doc_type: { type: 'string', description: 'Detected document type, e.g. "Distribution Agreement", "Artist Contract", "Loan Agreement".' },
    parties: { type: 'array', items: { type: 'string' }, description: 'Named parties / signatories / companies involved.' },
    key_dates: {
      type: 'array',
      description: 'Every concrete date that matters to track, with a clear label.',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          label: { type: 'string', description: 'What this date is, e.g. "Agreement expiry", "Payment due", "Delivery deadline", "Auto-renewal".' },
          date: { type: 'string', description: 'The date as YYYY-MM-DD. Indian docs are usually DD/MM/YYYY — interpret accordingly.' },
          kind: { type: 'string', description: 'One word: expiry, renewal, payment, delivery, or other.' },
        },
        required: ['label', 'date', 'kind'],
      },
    },
    financial_terms: {
      type: 'array',
      description: 'Money terms: minimum guarantee, advance, commission %, royalty, penalty, etc.',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          label: { type: 'string', description: 'e.g. "Minimum Guarantee", "Commission", "Advance".' },
          amount: { type: ['number', 'null'], description: 'Rupee amount as a plain number, or null if it is a percentage / not stated.' },
          note: { type: 'string', description: 'Short detail, e.g. "15% of net collections" or "payable on delivery".' },
        },
        required: ['label', 'amount', 'note'],
      },
    },
    obligations: { type: 'array', items: { type: 'string' }, description: 'Key obligations, deliverables or conditions either side must meet.' },
    flags: {
      type: 'array',
      description: 'Things a producer should be cautious about.',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          severity: { type: 'string', description: 'One word: high, medium, or low.' },
          note: { type: 'string', description: 'The concern, e.g. "Auto-renews unless cancelled 60 days prior", "Exclusive worldwide rights", "Penalty for late delivery".' },
        },
        required: ['severity', 'note'],
      },
    },
  },
  required: ['summary', 'doc_type', 'parties', 'key_dates', 'financial_terms', 'obligations', 'flags'],
}

const SYSTEM = `You are a contracts analyst for an Indian film-production company (OPM Cinemas). You read legal/business documents — distribution & OTT agreements, artist/technician contracts, investor agreements, loan papers, GST/legal notices — and return a faithful structured analysis for the team to track.

Rules:
- Extract only what is actually in the document. Never invent parties, dates, or amounts. Use empty arrays when a section genuinely has nothing.
- Dates must be YYYY-MM-DD. Indian documents are usually DD/MM/YYYY — interpret accordingly. Capture every date worth tracking (expiry, renewal, payment milestones, delivery deadlines, option windows).
- Amounts are in Indian Rupees; return plain numbers (no ₹ or commas). Use null for amounts expressed only as a percentage.
- For flags, surface real risks: auto-renewal clauses, exclusivity, territory/term limits, penalties, indemnities, unfavourable termination terms, missing signatures/dates, or anything time-sensitive. Rate severity high/medium/low.
- Be concise and concrete.`

export interface AnalyzeResult {
  data: DocumentAnalysis | null
  error?: string
}

export async function analyzeDocument(base64: string, mediaType: string, title?: string): Promise<AnalyzeResult> {
  if (!documentAnalysisConfigured()) return { data: null, error: 'ANTHROPIC_API_KEY not set' }

  const isPdf = mediaType === 'application/pdf'
  const isImage = /^image\/(png|jpe?g|gif|webp)$/.test(mediaType)
  if (!isPdf && !isImage) return { data: null, error: 'Only PDF or image documents can be analyzed' }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const docBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: base64 } }

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      // Generous ceiling so thinking + the full JSON never truncate (you only
      // pay for tokens actually generated). 2048 was cutting long analyses off.
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          docBlock,
          { type: 'text', text: `Analyze this document${title ? ` (titled "${title}")` : ''} and return the structured analysis.` },
        ],
      }],
    })
    const text = response.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') return { data: null, error: 'No text in model response' }
    return { data: JSON.parse(text.text) as DocumentAnalysis }
  } catch (e) {
    const err = e as { status?: number; message?: string; error?: { error?: { message?: string } } }
    const msg = err?.error?.error?.message || err?.message || 'Unknown error'
    return { data: null, error: `${err?.status ?? ''} ${msg}`.trim() }
  }
}
