import * as mupdf from 'mupdf'

// Extract text from a PDF buffer, decrypting password-protected ones by trying a
// list of candidate passwords. Server-side only (mupdf is WASM). Returns the
// text (empty if it couldn't be opened), whether it was encrypted, and which
// password worked.
// Minimal shape of the mupdf document methods we use (avoids depending on the
// package's exported type names across versions).
interface PdfDoc {
  needsPassword(): boolean
  authenticatePassword(pw: string): number | boolean
  countPages(): number
  loadPage(n: number): { toStructuredText(opts?: string): { asText(): string } }
}

export function readPdf(buffer: Buffer | Uint8Array, passwords: string[] = [], maxPages = 20):
  { text: string; encrypted: boolean; password: string | null } {
  let doc: PdfDoc
  try {
    doc = mupdf.Document.openDocument(buffer, 'application/pdf') as unknown as PdfDoc
  } catch {
    return { text: '', encrypted: false, password: null }
  }
  let encrypted = false
  let used: string | null = null
  try {
    if (doc.needsPassword()) {
      encrypted = true
      for (const pw of passwords) {
        try { if (doc.authenticatePassword(pw)) { used = pw; break } } catch { /* try next */ }
      }
      if (!used) return { text: '', encrypted, password: null }
    }
    const pages = Math.min(doc.countPages(), maxPages)
    let text = ''
    for (let i = 0; i < pages; i++) {
      try { text += doc.loadPage(i).toStructuredText('preserve-whitespace').asText() + '\n' } catch { /* skip page */ }
    }
    return { text, encrypted, password: used }
  } catch {
    return { text: '', encrypted, password: used }
  }
}

// Render page 1 of a PDF to a small PNG (for an accounts-dept snapshot).
// Returns null if it can't open/decrypt. scale ~0.6 keeps the file small.
export function renderFirstPagePng(buffer: Buffer | Uint8Array, passwords: string[] = [], scale = 0.6): Buffer | null {
  try {
    const doc = mupdf.Document.openDocument(buffer, 'application/pdf') as unknown as {
      needsPassword(): boolean; authenticatePassword(pw: string): number | boolean; countPages(): number
      loadPage(n: number): { toPixmap(m: unknown, cs: unknown, alpha: boolean): { asPNG(): Uint8Array } }
    }
    if (doc.needsPassword()) {
      let ok = false
      for (const pw of passwords) { try { if (doc.authenticatePassword(pw)) { ok = true; break } } catch { /* next */ } }
      if (!ok) return null
    }
    if (doc.countPages() < 1) return null
    const pix = doc.loadPage(0).toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false)
    return Buffer.from(pix.asPNG())
  } catch {
    return null
  }
}

// Build candidate passwords for Indian bank/card statements from a name + DOB.
// Banks vary wildly; this covers the common formats (name4+DDMM, DDMMYYYY, etc.).
export function pdfPasswordCandidates(name?: string, dobDDMMYYYY?: string): string[] {
  const out = new Set<string>()
  const dob = (dobDDMMYYYY || '').replace(/\D/g, '') // 12041978
  const dd = dob.slice(0, 2), mm = dob.slice(2, 4), yyyy = dob.slice(4, 8), yy = yyyy.slice(2)
  const letters = (name || '').replace(/[^A-Za-z]/g, '') // AsiqPA
  const f4 = letters.slice(0, 4)
  const f5 = letters.slice(0, 5)
  const add = (s: string) => { if (s) { out.add(s); out.add(s.toUpperCase()); out.add(s.toLowerCase()) } }
  if (dob) { add(dob); add(dd + mm + yy); add(yyyy + mm + dd); add(dd + mm); }
  if (f4 && dob) { add(f4 + dd + mm); add(f4 + dob); add(f4 + yyyy); add(f4 + yy) }
  if (f5 && dob) { add(f5 + dd + mm); add(f5 + dob) }
  if (letters) { add(letters); add(f4); add(f5) }
  if (f4 && yyyy) add(f4 + '@' + yyyy)
  return [...out]
}
