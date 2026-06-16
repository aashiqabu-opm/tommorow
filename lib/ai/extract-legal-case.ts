import Anthropic from '@anthropic-ai/sdk'

// Reads a legal / court document (petition, plaint, notice, order, agreement,
// summons, vakalatnama, charge sheet…) and returns structured fields to
// AUTO-FILL the Legal Cases tracker, plus a plain-language summary, the next
// hearing date, obligations and a risk note. Server-side only. India context.

export interface ExtractedLegalCase {
  title: string | null
  case_type: string | null        // civil/criminal/arbitration/recovery/cheque_bounce/company/ip_copyright/labour/tax/other
  our_role: string | null         // petitioner/plaintiff/complainant/respondent/defendant/accused/third_party
  opposing_party: string | null
  court: string | null
  case_number: string | null
  jurisdiction: string | null
  amount_involved: number | null
  filing_date: string | null      // YYYY-MM-DD
  next_hearing_date: string | null// YYYY-MM-DD
  summary: string | null          // plain-language, 2-3 sentences
  key_dates: { label: string; date: string }[]
  obligations: string[]           // what we must do / deadlines / orders
  risk_notes: string | null       // candid risk/exposure note (not legal advice)
}

export function legalCaseExtractionConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

const SYSTEM = `You are a paralegal assistant reading an Indian legal/court document to populate a private case tracker for a film producer. Read the document and extract the requested fields. You are NOT giving legal advice — you summarise and flag, factually.
Rules:
- Dates must be YYYY-MM-DD. Indian dates are usually DD/MM/YYYY — interpret accordingly.
- case_type: pick the best of civil, criminal, arbitration, recovery, cheque_bounce, company, ip_copyright, labour, tax, other.
- our_role: the role of OPM / Aashiq Abu in THIS matter (petitioner, plaintiff, complainant, respondent, defendant, accused, third_party). If the document is filed BY us, we are the petitioner/plaintiff/complainant; if filed AGAINST us, we are respondent/defendant/accused. Use best judgement.
- opposing_party: the other side's name.
- court / case_number / jurisdiction: copy exactly as printed; null if absent.
- amount_involved: claim/disputed amount in rupees, number only, null if none.
- next_hearing_date: the next listed hearing / posting date if any.
- summary: 2-3 plain sentences a non-lawyer can understand — what the case is about and current stage.
- obligations: concrete things our side must do, with any deadline (e.g. "File counter-affidavit by 2026-07-10").
- risk_notes: one candid sentence on exposure/risk, factual, no advice.
- Use null / empty arrays for anything not clearly present. Never invent case numbers, courts, or names.
Respond with ONLY a JSON object (no prose, no code fences) with exactly these keys: title (string|null), case_type (string|null), our_role (string|null), opposing_party (string|null), court (string|null), case_number (string|null), jurisdiction (string|null), amount_involved (number|null), filing_date (string|null), next_hearing_date (string|null), summary (string|null), key_dates (array of {label,date}), obligations (array of string), risk_notes (string|null).`

export interface ExtractResult { data: ExtractedLegalCase | null; error?: string }

export async function extractLegalCase(base64: string, mediaType: string): Promise<ExtractResult> {
  if (!legalCaseExtractionConfigured()) return { data: null, error: 'ANTHROPIC_API_KEY not set' }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const isPdf = mediaType === 'application/pdf'
  const docBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: base64 } }

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: 'user', content: [docBlock, { type: 'text', text: 'Extract the case-tracker fields from this legal document. Respond with only the JSON object.' }] }],
    })
    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return { data: null, error: 'No text in model response' }
    let raw = block.text.trim()
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) raw = m[0]
    return { data: JSON.parse(raw) as ExtractedLegalCase }
  } catch (e) {
    const err = e as { status?: number; message?: string; error?: { error?: { message?: string } } }
    const msg = err?.error?.error?.message || err?.message || 'Unknown error'
    return { data: null, error: `${err?.status ?? ''} ${msg}`.trim() }
  }
}
