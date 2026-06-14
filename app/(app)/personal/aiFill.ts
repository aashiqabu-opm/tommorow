// Shared client helper: send an uploaded file to the personal doc auto-fill
// engine and get back structured fields to pre-populate a form.

export interface ExtractedDoc {
  title: string | null
  doc_type: string | null
  summary: string | null
  expiry_date: string | null
  key_dates: { label: string; date: string }[]
  identifiers: { label: string; value: string }[]
  amount: number | null
}

export function fileToBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = reject
    r.readAsDataURL(f)
  })
}

const OK = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']

// Returns extracted fields, or throws with a user-facing message.
export async function analyzeDoc(file: File): Promise<ExtractedDoc> {
  if (!OK.includes(file.type)) throw new Error('Unsupported file type')
  if (file.size > 6_500_000) throw new Error('File too big for AI read (~6MB)')
  const base64 = await fileToBase64(file)
  const res = await fetch('/api/personal/analyze-doc', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, mediaType: file.type }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "AI couldn't read it")
  return data.extracted as ExtractedDoc
}

// Pull a value from identifiers by fuzzy label match.
export function findId(ids: { label: string; value: string }[], ...keys: string[]): string | null {
  for (const k of keys) {
    const hit = ids.find(i => i.label.toLowerCase().includes(k.toLowerCase()))
    if (hit) return hit.value
  }
  return null
}

// Pull a date from key_dates by fuzzy label match.
export function findDate(dates: { label: string; date: string }[], ...keys: string[]): string | null {
  for (const k of keys) {
    const hit = dates.find(d => d.label.toLowerCase().includes(k.toLowerCase()))
    if (hit) return hit.date
  }
  return null
}
