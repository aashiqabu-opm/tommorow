import crypto from 'crypto'

// Verify a request really came from Twilio (HMAC-SHA1 of the URL + sorted params
// with the auth token). Prevents anyone from spoofing inbound messages — vital
// since this endpoint can create payment drafts.
export function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  if (!signature) return false
  const data = url + Object.keys(params).sort().map(k => k + params[k]).join('')
  const expected = crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64')
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(signature)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Build a TwiML reply. Twilio sends the <Message> body back to the user.
export function twimlMessage(text: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(text)}</Message></Response>`
}

export function twimlEmpty(): string {
  return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
}

// Download a Twilio-hosted media file (needs Basic auth). Returns base64 or null.
export async function fetchTwilioMedia(url: string, sid: string, authToken: string): Promise<string | null> {
  try {
    const auth = Buffer.from(`${sid}:${authToken}`).toString('base64')
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 9_000_000) return null // ~6MB file ceiling
    return buf.toString('base64')
  } catch {
    return null
  }
}

// Match a project from the caption text, else fall back to the most recent one.
export function pickProject<T extends { id: string; name: string }>(projects: T[], caption: string): T | null {
  if (projects.length === 0) return null
  const c = caption.toLowerCase()
  const hit = projects.find(p => p.name && c.includes(p.name.toLowerCase()))
  return hit ?? projects[0]
}
