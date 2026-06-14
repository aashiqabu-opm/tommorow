import Anthropic from '@anthropic-ai/sdk'
import { PAYMENT_CATEGORY_OPTIONS } from '@/lib/utils'

// Reads a bill/invoice image or PDF with Claude and returns structured fields
// to pre-fill a payment request. Server-side only. Returns null if the API key
// isn't configured so the feature degrades gracefully.

export interface ExtractedBill {
  vendor_name: string | null
  amount: number | null        // taxable amount, before GST
  gst_amount: number | null
  invoice_date: string | null  // YYYY-MM-DD
  due_date: string | null      // YYYY-MM-DD
  pan: string | null
  gst_number: string | null
  category: string | null
  purpose: string | null
}

export function billExtractionConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    vendor_name: { type: ['string', 'null'], description: 'Supplier / payee name on the bill' },
    amount: { type: ['number', 'null'], description: 'Taxable amount before GST/tax, in rupees (number only, no symbols)' },
    gst_amount: { type: ['number', 'null'], description: 'Total GST / tax amount in rupees, or null if none' },
    invoice_date: { type: ['string', 'null'], description: 'Invoice/bill date as YYYY-MM-DD' },
    due_date: { type: ['string', 'null'], description: 'Payment due date as YYYY-MM-DD, or null' },
    pan: { type: ['string', 'null'], description: 'Vendor PAN (10 chars) if printed, else null' },
    gst_number: { type: ['string', 'null'], description: 'Vendor GSTIN (15 chars) if printed, else null' },
    category: { type: ['string', 'null'], description: `Best-fit expense category. MUST be exactly one of: ${PAYMENT_CATEGORY_OPTIONS.join(', ')}. Use null if none fit.` },
    purpose: { type: ['string', 'null'], description: 'One short line describing what the bill is for' },
  },
  required: ['vendor_name', 'amount', 'gst_amount', 'invoice_date', 'due_date', 'pan', 'gst_number', 'category', 'purpose'],
}

const SYSTEM = `You extract structured data from Indian vendor bills and invoices for a film-production company's payment system. Read the document and return only the fields requested. Rules:
- Amounts are in Indian Rupees. Return numbers only (no ₹, no commas).
- "amount" is the taxable value BEFORE GST. If the bill only shows a single total with no tax split, put that total in "amount" and null for "gst_amount".
- Dates must be YYYY-MM-DD. Indian bills are usually DD/MM/YYYY — interpret accordingly.
- Use null for anything not clearly present. Do not guess PAN/GSTIN.
- Pick "category" only from the allowed enum; use null if none fit.
Respond with ONLY a JSON object (no prose, no code fences) with exactly these keys: vendor_name, amount, gst_amount, invoice_date, due_date, pan, gst_number, category, purpose (use null where not present).`

void SCHEMA // shape documented above; we now prompt for JSON directly

export interface ExtractResult {
  data: ExtractedBill | null
  error?: string
}

export async function extractBill(base64: string, mediaType: string): Promise<ExtractResult> {
  if (!billExtractionConfigured()) return { data: null, error: 'ANTHROPIC_API_KEY not set' }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const isPdf = mediaType === 'application/pdf'

  const docBlock = isPdf
    ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
    : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: base64 } }

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            docBlock,
            { type: 'text', text: 'Extract the payment fields from this bill. Respond with only the JSON object.' },
          ],
        },
      ],
    })
    const text = response.content.find((b) => b.type === 'text')
    if (!text || text.type !== 'text') return { data: null, error: 'No text in model response' }
    const jsonMatch = text.text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text.text) as ExtractedBill
    // Normalize category to a known option (drop anything the model invented)
    if (parsed.category) {
      const match = PAYMENT_CATEGORY_OPTIONS.find(c => c.toLowerCase() === String(parsed.category).toLowerCase())
      parsed.category = match ?? null
    }
    return { data: parsed }
  } catch (e) {
    const err = e as { status?: number; message?: string; error?: { error?: { message?: string } } }
    const msg = err?.error?.error?.message || err?.message || 'Unknown error'
    return { data: null, error: `${err?.status ?? ''} ${msg}`.trim() }
  }
}
