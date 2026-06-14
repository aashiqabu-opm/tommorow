import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractTransaction } from '@/lib/ai/extract-transaction'
import { extractStatement } from '@/lib/ai/extract-statement'
import { readPdf, pdfPasswordCandidates } from '@/lib/pdf'
import { withCronErrorAlert } from '@/lib/monitoring'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Reads recent Gmail over IMAP and files transactions for the founder:
//   • bank/card ALERTS  → one transaction from the email body
//   • bank/card STATEMENTS (PDF, incl. password-protected) → many transactions
//   • big-merchant receipts (Amazon/Swiggy/Zomato/Flipkart/Myntra) → one each
// Then reconciles: links duplicates (e.g. a statement line and its alert/receipt)
// so totals aren't double-counted. Credentials are Vercel secrets, read-only.

const BANK = ['hdfcbank', 'icicibank', 'icici.bank', 'axisbank', 'axis.bank', 'sbi', 'sbicard', 'kotak', 'federalbank', 'southindianbank', 'yesbank', 'idfcfirstbank', 'rblbank', 'aubank', 'indusind', 'pnb', 'bankofbaroda', 'amex', 'americanexpress', 'onecard', 'slice', 'cred', 'card', 'alerts']
const MERCHANTS = ['amazon', 'swiggy', 'zomato', 'flipkart', 'myntra']
const STMT_WORDS = ['statement', 'e-statement', 'estatement', 'account statement']
const TXN_WORDS = ['debited', 'credited', 'spent', 'transaction', 'txn', 'paid', 'purchase', 'withdrawn', 'received', 'payment of', 'charged', 'order', 'invoice', 'receipt']

export async function GET(request: Request) {
  return withCronErrorAlert('gmail-sync', () => run(request))
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return NextResponse.json({ ok: true, skipped: 'GMAIL creds not set' })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'service key missing' }, { status: 500 })

  const { data: byEmail } = await admin.from('profiles').select('id').ilike('email', user).maybeSingle()
  let ownerId = byEmail?.id as string | undefined
  if (!ownerId) { const { data: f } = await admin.from('profiles').select('id').eq('role', 'founder').eq('is_active', true).limit(1).maybeSingle(); ownerId = f?.id }
  if (!ownerId) return NextResponse.json({ error: 'no owner profile' }, { status: 422 })

  const pwCandidates = pdfPasswordCandidates(process.env.GMAIL_PDF_NAME, process.env.GMAIL_PDF_DOB)
  const debug = new URL(request.url).searchParams.get('debug') === '1'
  const log: string[] = []

  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user, pass }, logger: false })
  let alerts = 0, receipts = 0, stmtLines = 0, lockedPdfs = 0
  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      const since = new Date(Date.now() - 21 * 86400000)
      const uids = await client.search({ since }, { uid: true })
      for (const uid of (uids || []).slice(-120)) {
        const env = await client.fetchOne(String(uid), { envelope: true }, { uid: true })
        if (!env || !env.envelope) continue
        const from = (env.envelope.from?.[0]?.address ?? '').toLowerCase()
        const name = (env.envelope.from?.[0]?.name ?? '').toLowerCase()
        const subject = env.envelope.subject ?? ''
        const messageId = env.envelope.messageId ?? `uid-${uid}`
        const sl = subject.toLowerCase()
        const isBank = BANK.some(h => from.includes(h) || name.includes(h))
        const isMerchant = MERCHANTS.some(h => from.includes(h) || name.includes(h))
        const isStmt = STMT_WORDS.some(w => sl.includes(w))
        const isTxn = TXN_WORDS.some(w => sl.includes(w))
        if (!isBank && !isMerchant && !isStmt && !isTxn) continue

        const full = await client.fetchOne(String(uid), { source: true }, { uid: true })
        if (!full || !full.source) continue
        const parsed = await simpleParser(full.source as Buffer)
        const body = (parsed.text || parsed.html || '').toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
        const pdfs = (parsed.attachments || []).filter(a => /pdf/i.test(a.contentType || '') || /\.pdf$/i.test(a.filename || ''))

        // STATEMENT path: a bank/card email with a PDF (or the word "statement")
        if (pdfs.length && (isBank || isStmt)) {
          for (const a of pdfs) {
            const { text, encrypted, password } = readPdf(a.content as Buffer, pwCandidates)
            if (encrypted && !password) { lockedPdfs++; if (debug) log.push(`LOCKED ${a.filename} (no pw matched)`); continue }
            if (!text) continue
            const { data: lines } = await extractStatement(text)
            const n = await insertStatementLines(admin, ownerId, lines, isBank ? guessSource(from, subject) : 'card')
            stmtLines += n
            if (debug) log.push(`STMT ${a.filename} enc=${encrypted} pw=${password ?? '-'} lines=${lines.length} new=${n}`)
          }
          continue
        }

        // RECEIPT path: big-merchant order/invoice (body, or its PDF if present)
        if (isMerchant) {
          const { data: existing } = await admin.from('personal_transactions').select('id').eq('owner_id', ownerId).eq('email_ref', messageId).maybeSingle()
          if (existing) continue
          let text = body
          if (pdfs.length) { const r = readPdf(pdfs[0].content as Buffer, pwCandidates); if (r.text) text = r.text }
          const { data: x } = await extractTransaction({ from, subject, text, date: env.envelope.date?.toISOString() })
          if (x?.is_transaction && x.amount) {
            await admin.from('personal_transactions').insert({
              owner_id: ownerId, source: 'card', origin: 'receipt', account_label: x.account_hint ?? merchantName(from),
              txn_date: x.date ?? dateOf(env.envelope.date), merchant: x.merchant ?? merchantName(from), amount: x.amount,
              direction: x.direction ?? 'debit', category: x.category ?? null, email_ref: messageId, notes: 'Imported from Gmail receipt',
            })
            receipts++
          }
          continue
        }

        // ALERT path: bank/card transaction alert in the body
        if (isBank || isTxn) {
          const { data: existing } = await admin.from('personal_transactions').select('id').eq('owner_id', ownerId).eq('email_ref', messageId).maybeSingle()
          if (existing) continue
          const { data: x } = await extractTransaction({ from, subject, text: body, date: env.envelope.date?.toISOString() })
          if (x?.is_transaction && x.amount) {
            await admin.from('personal_transactions').insert({
              owner_id: ownerId, source: x.source ?? 'card', origin: 'alert', account_label: x.account_hint ?? null,
              txn_date: x.date ?? dateOf(env.envelope.date), merchant: x.merchant ?? null, amount: x.amount,
              direction: x.direction ?? 'debit', category: x.category ?? null, email_ref: messageId, notes: 'Imported from Gmail alert',
            })
            alerts++
          }
        }
      }
    } finally { lock.release() }
    await client.logout()
  } catch (e) {
    try { await client.close() } catch { /* noop */ }
    throw e
  }

  const matched = await reconcile(admin, ownerId)
  return NextResponse.json({ ok: true, alerts, receipts, stmtLines, lockedPdfs, matched, ...(debug ? { log } : {}) })
}

function dateOf(d?: Date | null) { return (d ?? new Date()).toISOString().slice(0, 10) }
function merchantName(from: string) { const m = from.split('@')[1]?.split('.')[0]; return m ? m.charAt(0).toUpperCase() + m.slice(1) : 'Merchant' }
function guessSource(from: string, subject: string): 'card' | 'bank' { return /card/i.test(from + subject) ? 'card' : 'bank' }

// Insert statement lines, skipping ones already present (fingerprint dedupe).
async function insertStatementLines(admin: SupabaseClient, ownerId: string, lines: { date: string | null; amount: number | null; direction: 'debit' | 'credit' | null; merchant: string | null; category: string | null }[], source: 'card' | 'bank'): Promise<number> {
  const valid = lines.filter(l => l.amount && l.date)
  if (!valid.length) return 0
  const dates = [...new Set(valid.map(l => l.date as string))]
  const { data: existing } = await admin.from('personal_transactions').select('txn_date, amount, merchant').eq('owner_id', ownerId).eq('source', source).in('txn_date', dates)
  const fp = (d: string, a: number, m: string | null) => `${d}|${Number(a).toFixed(2)}|${(m ?? '').toLowerCase().trim()}`
  const seen = new Set((existing ?? []).map(e => fp(e.txn_date as string, Number(e.amount), e.merchant as string)))
  const rows = valid
    .filter(l => !seen.has(fp(l.date as string, l.amount as number, l.merchant)))
    .map(l => ({ owner_id: ownerId, source, origin: 'statement', txn_date: l.date, amount: l.amount, direction: l.direction ?? 'debit', merchant: l.merchant, category: l.category, notes: 'Imported from statement' }))
  if (!rows.length) return 0
  let inserted = 0
  for (const r of rows) {
    const { error } = await admin.from('personal_transactions').insert(r)
    if (!error) inserted++   // unique fingerprint index tolerates races
  }
  return inserted
}

// Link duplicate transactions (statement line ↔ its alert/receipt) so spend
// isn't double-counted. Canonical preference: statement > alert > receipt > manual.
async function reconcile(admin: SupabaseClient, ownerId: string): Promise<number> {
  const since = new Date(Date.now() - 95 * 86400000).toISOString().slice(0, 10)
  const { data: txns } = await admin.from('personal_transactions')
    .select('id, txn_date, amount, merchant, origin, dup_of').eq('owner_id', ownerId).gte('txn_date', since)
  if (!txns) return 0
  const rank: Record<string, number> = { statement: 3, alert: 2, receipt: 1, manual: 0 }
  const token = (m: string | null) => (m ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/)[0] ?? ''
  const list = txns.map(t => ({ ...t, amt: Number(t.amount), d: new Date(t.txn_date as string).getTime() }))
  let matched = 0
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    if (a.dup_of) continue
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]
      if (b.dup_of) continue
      if (a.amt !== b.amt) continue
      if (Math.abs(a.d - b.d) > 4 * 86400000) continue
      // A duplicate is the SAME transaction seen via two different channels —
      // never two alerts of an identical recurring charge. Require different
      // origins, and either a statement is involved or the merchants agree.
      if (a.origin === b.origin) continue
      const oneStatement = a.origin === 'statement' || b.origin === 'statement'
      const ta = token(a.merchant), tb = token(b.merchant)
      const merchAgree = ta && tb && ta === tb
      if (!oneStatement && !merchAgree) continue
      if (oneStatement && ta && tb && !merchAgree) continue // statement merchant known but differs
      const aRank = rank[a.origin as string] ?? 0, bRank = rank[b.origin as string] ?? 0
      const dup = aRank >= bRank ? b : a
      const canon = aRank >= bRank ? a : b
      await admin.from('personal_transactions').update({ dup_of: canon.id, reconciled: true }).eq('id', dup.id)
      dup.dup_of = canon.id
      matched++
      break // 1:1 — this canonical claims one duplicate
    }
  }
  return matched
}
