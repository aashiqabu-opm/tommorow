import Anthropic from '@anthropic-ai/sdk'

// Reads any personal document (insurance policy, vehicle RC, rent agreement,
// ID, statement, certificate…) and returns structured fields to AUTO-FILL the
// vault form: title, type, the main expiry/renewal date, other key dates, the
// identifiers printed on it (policy no, account no, reg no, PAN…), any headline
// amount, and a one-line summary. Server-side only.

export interface ExtractedPersonalDoc {
  title: string | null
  doc_type: string | null
  summary: string | null
  expiry_date: string | null               // main validity-end / renewal date, YYYY-MM-DD
  key_dates: { label: string; date: string }[]   // other important dates
  identifiers: { label: string; value: string }[] // policy/account/reg numbers, PAN, etc.
  amount: number | null                    // headline amount (premium / sum insured / rent), rupees
}

export function personalDocExtractionConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

// Suggested doc types the model should pick from (kept loose).
const DOC_TYPES = ['ID proof', 'Property deed', 'Agreement', 'Insurance', 'Will / nominee', 'Certificate', 'Vehicle', 'Statement', 'Other']

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: ['string', 'null'], description: 'Short human title for the document, e.g. "HDFC Ergo health policy" or "Flat rent agreement — Kochi"' },
    doc_type: { type: ['string', 'null'], description: `Best-fit type. SHOULD be one of: ${DOC_TYPES.join(', ')}. Use "Other" if unsure.` },
    summary: { type: ['string', 'null'], description: 'One plain-language line describing what this document is.' },
    expiry_date: { type: ['string', 'null'], description: 'The single most important validity-end / renewal / expiry date as YYYY-MM-DD, or null.' },
    key_dates: {
      type: 'array',
      description: 'Other important dates found (start date, due date, maturity, etc.).',
      items: { type: 'object', additionalProperties: false, properties: { label: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['label', 'date'] },
    },
    identifiers: {
      type: 'array',
      description: 'Identifiers printed on the document (policy number, account number, registration number, PAN, certificate no, etc.).',
      items: { type: 'object', additionalProperties: false, properties: { label: { type: 'string' }, value: { type: 'string' } }, required: ['label', 'value'] },
    },
    amount: { type: ['number', 'null'], description: 'Headline amount in rupees if clearly present (premium, sum insured, monthly rent, statement total). Number only.' },
  },
  required: ['title', 'doc_type', 'summary', 'expiry_date', 'key_dates', 'identifiers', 'amount'],
}

const SYSTEM = `You extract structured data from an individual's personal documents in India to auto-fill a private vault. Read the document and return ONLY the requested fields.
Rules:
- Dates must be YYYY-MM-DD. Indian dates are usually DD/MM/YYYY — interpret accordingly.
- "expiry_date" is the single most important validity-end / renewal / expiry date (e.g. policy expiry, insurance valid-till, agreement end, document expiry). null if there is none.
- Put every other notable date in key_dates with a clear label.
- Capture identifiers exactly as printed (policy/account/registration numbers, PAN). Do not invent or guess.
- amount: only if clearly printed; rupees, number only (no symbols/commas).
- Use null / empty arrays for anything not clearly present. Never guess.
Respond with ONLY a JSON object (no prose, no code fences) with exactly these keys: title (string|null), doc_type (string|null), summary (string|null), expiry_date (string|null YYYY-MM-DD), key_dates (array of {label,date}), identifiers (array of {label,value}), amount (number|null).`

void SCHEMA // shape documented above; we now prompt for JSON directly

export interface ExtractResult { data: ExtractedPersonalDoc | null; error?: string }

export async function extractPersonalDoc(base64: string, mediaType: string): Promise<ExtractResult> {
  if (!personalDocExtractionConfigured()) return { data: null, error: 'ANTHROPIC_API_KEY not set' }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const isPdf = mediaType === 'application/pdf'
  const docBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: base64 } }

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: 'user', content: [docBlock, { type: 'text', text: 'Extract the vault fields from this personal document. Respond with only the JSON object.' }] }],
    })
    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return { data: null, error: 'No text in model response' }
    let raw = block.text.trim()
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) raw = m[0]
    return { data: JSON.parse(raw) as ExtractedPersonalDoc }
  } catch (e) {
    const err = e as { status?: number; message?: string; error?: { error?: { message?: string } } }
    const msg = err?.error?.error?.message || err?.message || 'Unknown error'
    return { data: null, error: `${err?.status ?? ''} ${msg}`.trim() }
  }
}
