import Anthropic from '@anthropic-ai/sdk'

// Parses a bank / credit-card alert email into a structured transaction.
// Uses a cheap fast model since this runs over many emails. Returns
// is_transaction=false for anything that isn't an actual debit/credit alert
// (OTPs, statements, marketing) so the caller can skip it.

export interface ExtractedTxn {
  is_transaction: boolean
  amount: number | null
  direction: 'debit' | 'credit' | null
  merchant: string | null
  account_hint: string | null   // e.g. "HDFC ••1234" / "a/c XX5678"
  source: 'card' | 'bank' | null
  date: string | null           // YYYY-MM-DD
  category: string | null
  // GST / tax-invoice fields (only on proper vendor invoices)
  gstin?: string | null
  gst_amount?: number | null
  taxable_value?: number | null
  invoice_no?: string | null
}

export function txnExtractionConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    is_transaction: { type: 'boolean', description: 'true ONLY if this email reports an actual money movement (debit/credit/spend/payment). false for OTPs, statements, offers, reminders.' },
    amount: { type: ['number', 'null'], description: 'Transaction amount in rupees, number only.' },
    direction: { type: ['string', 'null'], enum: ['debit', 'credit', null], description: 'debit if money left the account/card, credit if money came in.' },
    merchant: { type: ['string', 'null'], description: 'Merchant / payee / sender name if present.' },
    account_hint: { type: ['string', 'null'], description: 'Masked card/account identifier as printed, e.g. "card ending 1234" or "a/c XX5678".' },
    source: { type: ['string', 'null'], enum: ['card', 'bank', null], description: 'card if a credit/debit card transaction, bank if a bank account transaction.' },
    date: { type: ['string', 'null'], description: 'Transaction date as YYYY-MM-DD.' },
    category: { type: ['string', 'null'], description: 'Short spend category if obvious (fuel, dining, shopping, transfer, UPI).' },
  },
  required: ['is_transaction', 'amount', 'direction', 'merchant', 'account_hint', 'source', 'date', 'category'],
}

const SYSTEM = `You read Indian bank and credit-card alert emails and extract the transaction. Amounts are rupees (number only, no symbols/commas). Dates YYYY-MM-DD (Indian dates are DD/MM/YYYY). Set is_transaction=false for OTPs, statements, due-date reminders, marketing, or anything that is not an actual completed money movement. Use null for anything not clearly present. Never guess full card/account numbers.
If this is a proper TAX INVOICE (has a GSTIN), also capture gstin, gst_amount (total GST in rupees), taxable_value (amount before GST), and invoice_no. Otherwise leave those null.
Respond with ONLY a JSON object (no prose, no code fences) with exactly these keys: is_transaction (boolean), amount (number|null), direction ("debit"|"credit"|null), merchant (string|null), account_hint (string|null), source ("card"|"bank"|null), date (string|null YYYY-MM-DD), category (string|null), gstin (string|null), gst_amount (number|null), taxable_value (number|null), invoice_no (string|null).`

export interface TxnResult { data: ExtractedTxn | null; error?: string }

export async function extractTransaction(input: { from: string; subject: string; text: string; date?: string }): Promise<TxnResult> {
  if (!txnExtractionConfigured()) return { data: null, error: 'no api key' }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const content = `From: ${input.from}\nSubject: ${input.subject}\nReceived: ${input.date ?? ''}\n\n${input.text.slice(0, 4000)}`
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: 'user', content: [{ type: 'text', text: content }] }],
    })
    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return { data: null, error: 'no text block' }
    let raw = block.text.trim()
    const m = raw.match(/\{[\s\S]*\}/)   // tolerate stray prose/code fences
    if (m) raw = m[0]
    return { data: JSON.parse(raw) as ExtractedTxn }
  } catch (e) {
    const err = e as { status?: number; message?: string; error?: { error?: { message?: string } } }
    return { data: null, error: `${err?.status ?? ''} ${err?.error?.error?.message || err?.message || 'error'}`.trim() }
  }
}

// Keep SCHEMA referenced (documents the shape) without requiring output_config.
void SCHEMA
