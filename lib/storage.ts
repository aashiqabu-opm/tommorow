// Signed-URL helpers for the (now private) `documents` bucket.
// Works with BOTH a bare object path and a legacy public URL
// (https://…/object/public/documents/<path>) so existing rows that stored a
// public URL keep working without a data migration — we derive the object path
// and mint a fresh 60-min signed URL via the server (service-role) endpoint.

export function docObjectPath(stored: string | null | undefined): string | null {
  if (!stored) return null
  // strip everything up to and including ".../documents/" (public or signed URL forms)
  const m = stored.match(/\/documents\/(.+)$/)
  const raw = m ? m[1] : stored
  return decodeURIComponent(raw.split('?')[0]).replace(/^\/+/, '')
}

// Ask the server to mint a 60-min signed URL (service-role, auth-gated).
export async function signedDocUrl(stored: string | null | undefined): Promise<string | null> {
  const path = docObjectPath(stored)
  if (!path) return null
  try {
    const r = await fetch('/api/storage/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    const b = await r.json().catch(() => ({}))
    return r.ok ? (b.url ?? null) : null
  } catch {
    return null
  }
}

// Open a document in a new tab via a fresh signed URL.
export async function openDoc(stored: string | null | undefined): Promise<void> {
  const url = await signedDocUrl(stored)
  if (url) window.open(url, '_blank', 'noopener')
}
