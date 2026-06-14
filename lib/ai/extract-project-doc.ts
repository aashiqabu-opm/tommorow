import Anthropic from '@anthropic-ai/sdk'

// Reads a project document (screenplay, chart, PDF) and returns a summary plus,
// for screenplays, the list of characters — to autofill the project's casting
// and feed project intelligence. Prompt-based JSON (output_config is broken).

export interface ExtractedProjectDoc {
  title: string | null
  summary: string | null
  key_points: string[]
  characters: { name: string; description: string }[]   // for screenplays
}

export function projectDocExtractionConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

const SYSTEM = `You read documents for a film-production company (screenplays, production charts, schedules, reference PDFs) and extract structured info to feed project intelligence.
- Write a concise plain-language summary.
- Pull 3-8 key points (decisions, dates, budget figures, requirements).
- If it is a SCREENPLAY or script, list the characters with a one-line description each (name + who they are). Otherwise characters = [].
Respond with ONLY a JSON object (no prose, no code fences): {"title":string|null,"summary":string|null,"key_points":[string],"characters":[{"name":string,"description":string}]}.`

export async function extractProjectDoc(input: { base64?: string; mediaType?: string; text?: string }): Promise<{ data: ExtractedProjectDoc | null; error?: string }> {
  if (!projectDocExtractionConfigured()) return { data: null, error: 'no api key' }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const content: Anthropic.MessageParam['content'] = []
  if (input.base64 && input.mediaType) {
    if (input.mediaType === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.base64 } })
    else content.push({ type: 'image', source: { type: 'base64', media_type: input.mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: input.base64 } })
  }
  content.push({ type: 'text', text: (input.text ? input.text.slice(0, 20000) + '\n\n' : '') + 'Extract the fields as JSON.' })
  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8', max_tokens: 2000, system: SYSTEM,
      messages: [{ role: 'user', content }],
    })
    const block = response.content.find(b => b.type === 'text')
    if (!block || block.type !== 'text') return { data: null, error: 'no text' }
    let raw = block.text.trim(); const m = raw.match(/\{[\s\S]*\}/); if (m) raw = m[0]
    const p = JSON.parse(raw) as ExtractedProjectDoc
    return { data: { title: p.title ?? null, summary: p.summary ?? null, key_points: p.key_points ?? [], characters: p.characters ?? [] } }
  } catch (e) {
    const err = e as { status?: number; message?: string }
    return { data: null, error: `${err?.status ?? ''} ${err?.message ?? 'error'}`.trim() }
  }
}
