import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractTransaction, txnExtractionConfigured } from '@/lib/ai/extract-transaction'
import { withCronErrorAlert } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Pulls recent bank/card alert emails over IMAP, parses each with Claude, and
// files them as personal_transactions for the founder (deduped by message-id).
// Credentials are Vercel secrets (GMAIL_USER / GMAIL_APP_PASSWORD). Read-only.

// Senders we care about — Indian banks, cards, UPI. Matched against the from
// address domain/text, case-insensitive. Add more as needed.
const BANK_HINTS = [
  'hdfcbank', 'icicibank', 'axisbank', 'sbi', 'sbicard', 'kotak', 'federalbank',
  'yesbank', 'idfcfirstbank', 'rblbank', 'aubank', 'indusind', 'pnb', 'bankofbaroda',
  'canarabank', 'amex', 'americanexpress', 'onecard', 'slice', 'cred', 'paytm',
  'phonepe', 'gpay', 'razorpay', 'cashfree', 'billdesk', 'upi', 'alerts', 'card',
]
const TXN_KEYWORDS = ['debited', 'credited', 'spent', 'transaction', 'txn', 'paid', 'purchase', 'withdrawn', 'received', 'payment of', 'charged']

export async function GET(request: Request) {
  return withCronErrorAlert('gmail-sync', () => run(request))
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) return NextResponse.json({ ok: true, skipped: 'GMAIL_USER / GMAIL_APP_PASSWORD not set' })
  if (!txnExtractionConfigured()) return NextResponse.json({ ok: true, skipped: 'AI not configured' })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'service key missing' }, { status: 500 })

  // Resolve the owner: the profile whose email matches the inbox, else founder.
  const { data: byEmail } = await admin.from('profiles').select('id').ilike('email', user).maybeSingle()
  let ownerId = byEmail?.id as string | undefined
  if (!ownerId) {
    const { data: founder } = await admin.from('profiles').select('id').eq('role', 'founder').eq('is_active', true).limit(1).maybeSingle()
    ownerId = founder?.id
  }
  if (!ownerId) return NextResponse.json({ error: 'no owner profile found' }, { status: 422 })

  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user, pass }, logger: false })
  let scanned = 0, inserted = 0, skipped = 0
  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      const since = new Date(Date.now() - 4 * 86400000)
      const uids = await client.search({ since }, { uid: true })
      const recent = (uids || []).slice(-60) // cap volume/cost per run
      for (const uid of recent) {
        const msg = await client.fetchOne(String(uid), { envelope: true, source: true }, { uid: true })
        if (!msg || !msg.envelope) continue
        const from = (msg.envelope.from?.[0]?.address ?? '').toLowerCase()
        const subject = msg.envelope.subject ?? ''
        const messageId = msg.envelope.messageId ?? `uid-${uid}`
        const fromName = (msg.envelope.from?.[0]?.name ?? '').toLowerCase()
        const looksBank = BANK_HINTS.some(h => from.includes(h) || fromName.includes(h))
        const looksTxn = TXN_KEYWORDS.some(k => subject.toLowerCase().includes(k))
        if (!looksBank && !looksTxn) continue
        scanned++

        // Dedupe
        const { data: existing } = await admin.from('personal_transactions').select('id').eq('owner_id', ownerId).eq('email_ref', messageId).maybeSingle()
        if (existing) { skipped++; continue }

        const parsed = await simpleParser(msg.source as Buffer)
        const body = (parsed.text || parsed.html || '').toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
        const x = await extractTransaction({ from, subject, text: body, date: msg.envelope.date?.toISOString() })
        if (!x || !x.is_transaction || !x.amount) { skipped++; continue }

        await admin.from('personal_transactions').insert({
          owner_id: ownerId,
          source: x.source ?? (looksBank ? 'bank' : 'card'),
          account_label: x.account_hint ?? null,
          txn_date: x.date ?? (msg.envelope.date ? msg.envelope.date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
          merchant: x.merchant ?? null,
          amount: x.amount,
          direction: x.direction ?? 'debit',
          category: x.category ?? null,
          email_ref: messageId,
          notes: 'Imported from Gmail',
        })
        inserted++
      }
    } finally {
      lock.release()
    }
    await client.logout()
  } catch (e) {
    try { await client.close() } catch { /* noop */ }
    throw e
  }
  return NextResponse.json({ ok: true, scanned, inserted, skipped })
}
