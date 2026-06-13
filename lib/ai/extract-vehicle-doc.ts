import Anthropic from '@anthropic-ai/sdk'

// Reads an Indian vehicle document (RC, insurance, PUC, permit, fitness) and
// pulls out the document number + issue/expiry dates so the form pre-fills.
// Server-side only; degrades gracefully without an API key.

export interface ExtractedVehicleDoc {
  doc_number: string | null
  issue_date: string | null   // YYYY-MM-DD
  expiry_date: string | null  // YYYY-MM-DD
}

export function vehicleDocExtractionConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    doc_number: { type: ['string', 'null'], description: 'The document / policy / certificate number (e.g. insurance policy no., RC/registration no., PUCC no., permit no.). Null if not visible.' },
    issue_date: { type: ['string', 'null'], description: 'Issue / valid-from date as YYYY-MM-DD, or null.' },
    expiry_date: { type: ['string', 'null'], description: 'Expiry / valid-upto date as YYYY-MM-DD, or null.' },
  },
  required: ['doc_number', 'issue_date', 'expiry_date'],
}

const DOC_HINT: Record<string, string> = {
  rc: 'Registration Certificate (RC) — number is the registration number; expiry is registration/fitness validity if shown.',
  insurance: 'Motor insurance policy — number is the policy number; expiry is the policy end / valid-upto date.',
  puc: 'Pollution Under Control (PUC) certificate — number is the PUCC number; expiry is valid-until.',
  permit: 'Vehicle permit — number is the permit number; expiry is permit validity.',
  fitness: 'Fitness certificate — number is the certificate number; expiry is fitness validity.',
  tax: 'Road tax receipt — number is the receipt/transaction number; expiry is tax validity / next due.',
  other: 'Vehicle document — extract any document number and its issue and expiry dates.',
}

const SYSTEM = `You read Indian motor-vehicle documents and return only the requested fields. Rules:
- Dates must be YYYY-MM-DD. Indian documents are usually DD/MM/YYYY or DD-MMM-YYYY — interpret accordingly.
- "expiry_date" is the valid-upto / policy-end / valid-until date.
- Use null for anything not clearly present. Do not guess numbers.`

export interface VehicleDocResult { data: ExtractedVehicleDoc | null; error?: string }

export async function extractVehicleDoc(base64: string, mediaType: string, docType: string): Promise<VehicleDocResult> {
  if (!vehicleDocExtractionConfigured()) return { data: null, error: 'ANTHROPIC_API_KEY not set' }
  const isPdf = mediaType === 'application/pdf'
  const isImage = /^image\/(png|jpe?g|gif|webp)$/.test(mediaType)
  if (!isPdf && !isImage) return { data: null, error: 'Only PDF or image documents can be read' }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const docBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: base64 } }

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 600,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [docBlock, { type: 'text', text: `This is a ${DOC_HINT[docType] ?? DOC_HINT.other} Extract the document number and dates.` }],
      }],
    })
    const text = response.content.find(b => b.type === 'text')
    if (!text || text.type !== 'text') return { data: null, error: 'No text in model response' }
    return { data: JSON.parse(text.text) as ExtractedVehicleDoc }
  } catch (e) {
    const err = e as { status?: number; message?: string; error?: { error?: { message?: string } } }
    const msg = err?.error?.error?.message || err?.message || 'Unknown error'
    return { data: null, error: `${err?.status ?? ''} ${msg}`.trim() }
  }
}
