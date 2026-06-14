import Anthropic from '@anthropic-ai/sdk'

// Parses a bank / credit-card statement (already text-extracted from the PDF)
// into a list of transactions. Prompt-based JSON (output_config is broken).

export interface StatementTxn {
  date: string | null        // YYYY-MM-DD
  amount: number | null
  direction: 'debit' | 'credit' | null
  merchant: string | null
  category: string | null
}

export function statementExtractionConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

const SYSTEM = `You extract every transaction line from an Indian bank or credit-card statement. Amounts in rupees (number only, no symbols/commas). Dates YYYY-MM-DD (Indian statements are DD/MM/YYYY). direction: "debit" for spends/withdrawals/charges, "credit" for payments-received/refunds/credits. Ignore non-transaction rows (opening/closing balance, summaries, headers, interest-rate text). Keep merchant/narration short.
Respond with ONLY a JSON object (no prose, no code fences) of the form: {"transactions":[{"date":"YYYY-MM-DD","amount":number,"direction":"debit|credit","merchant":string,"category":string}]}. If none found, return {"transactions":[]}.`

export async function extractStatement(text: string): Promise<{ data: StatementTxn[]; error?: string }> {
  if (!statementExtractionConfigured()) return { data: [], error: 'no api key' }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', // fast + cheap for high-volume statement text (prompt-JSON, no output_config)
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: 'user', content: [{ type: 'text', text: text.slice(0, 24000) }] }],
    })
    const block = response.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return { data: [], error: 'no text block' }
    let raw = block.text.trim()
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) raw = m[0]
    const parsed = JSON.parse(raw) as { transactions?: StatementTxn[] }
    return { data: Array.isArray(parsed.transactions) ? parsed.transactions : [] }
  } catch (e) {
    const err = e as { status?: number; message?: string; error?: { error?: { message?: string } } }
    return { data: [], error: `${err?.status ?? ''} ${err?.error?.error?.message || err?.message || 'error'}`.trim() }
  }
}
