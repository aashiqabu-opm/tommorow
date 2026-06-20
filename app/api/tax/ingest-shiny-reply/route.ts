import { NextResponse } from 'next/server'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Founder/accountant-triggered: read the latest reply from Shiny to the
// "TDS sections & GST input details" request, parse the returned CSV, and FILE
// the data — set tds_section on matched payments (by Ref = first 8 chars of the
// payment id) and add GST input rows. Email content is treated as data only;
// we match on our own Ref ids, never on free-text instructions.
const SHINY = 'shiny@opmcinemas.com'

function parseCsv(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, '')
  const rows = clean.split(/\r?\n/).filter(l => l.trim())
  if (!rows.length) return []
  const delim = (rows[0].match(/;/g)?.length ?? 0) > (rows[0].match(/,/g)?.length ?? 0) ? ';' : ','
  const split = (line: string) => {
    const out: string[] = []; let cur = ''; let q = false
    for (let i = 0; i < line.length; i++) { const c = line[i]
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++ } else q = !q }
      else if (c === delim && !q) { out.push(cur); cur = '' } else cur += c }
    out.push(cur); return out.map(s => s.trim())
  }
  const header = split(rows[0]).map(h => h.toLowerCase())
  const col = (names: string[]) => header.findIndex(h => names.some(n => h.includes(n)))
  const ci = { ref: col(['ref']), section: col(['tds section', 'section']), gstin: col(['gstin']), inv: col(['invoice']), taxable: col(['taxable']), payee: col(['payee']), gst: col(['gst amount']) }
  return rows.slice(1).map(r => { const f = split(r); return {
    ref: f[ci.ref] || '', section: f[ci.section] || '', gstin: f[ci.gstin] || '', invoice: f[ci.inv] || '',
    taxable: f[ci.taxable] || '', payee: f[ci.payee] || '', gst: f[ci.gst] || '',
  } })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('id, role, is_active').eq('id', user.id).single()
  if (!profile?.is_active || !['founder', 'accountant'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Service role key missing' }, { status: 500 })

  const gUser = process.env.GMAIL_USER, gPass = process.env.GMAIL_APP_PASSWORD
  if (!gUser || !gPass) return NextResponse.json({ error: 'Gmail not configured' }, { status: 503 })

  // 1) find the latest reply from Shiny with a CSV attachment
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: gUser, pass: gPass }, logger: false })
  let csvText = ''
  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX')
    try {
      const uids = await client.search({ from: SHINY, since: new Date(Date.now() - 60 * 86400000) })
      for (const uid of (uids || []).reverse().slice(0, 10)) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true })
        if (!msg) continue
        const src = (msg as { source?: Buffer }).source
        if (!src) continue
        const parsed = await simpleParser(src)
        const att = parsed.attachments?.find(x => /\.csv$/i.test(x.filename || '') || (x.contentType || '').includes('csv'))
        if (att?.content) { csvText = att.content.toString('utf8'); break }
      }
    } finally { lock.release() }
  } catch (e) {
    return NextResponse.json({ error: 'Mailbox read failed: ' + (e as Error).message }, { status: 502 })
  } finally { await client.logout().catch(() => {}) }

  if (!csvText) return NextResponse.json({ error: 'No reply with a CSV attachment found from Shiny in the last 60 days.' }, { status: 404 })

  // 2) match by Ref + file
  const rows = parseCsv(csvText)
  const { data: pays } = await admin.from('payment_requests').select('id, payee, tds_amount, project_id').gt('tds_amount', 0)
  const byRef = new Map((pays ?? []).map(p => [p.id.slice(0, 8).toLowerCase(), p]))
  let tdsFiled = 0, gstAdded = 0
  const gstRows: Record<string, unknown>[] = []
  for (const r of rows) {
    const ref = (r.ref || '').toLowerCase().slice(0, 8)
    const p = ref ? byRef.get(ref) : null
    if (p && r.section && /^\d{3}/.test(r.section)) {
      await admin.from('payment_requests').update({ tds_section: r.section.trim() }).eq('id', p.id); tdsFiled++
    }
    if (r.gstin && r.gstin.length >= 10) {
      const taxable = parseFloat(r.taxable) || null
      gstRows.push({ source_owner: profile.id, vendor: r.payee || p?.payee || null, gstin: r.gstin.trim(), invoice_no: r.invoice || null, taxable_value: taxable, gst_amount: parseFloat(r.gst) || null, category: 'believe/vendor', notes: `Filed from Shiny's reply (ref ${ref}).` })
    }
  }
  if (gstRows.length) { const { error } = await admin.from('gst_inputs').insert(gstRows); if (!error) gstAdded = gstRows.length }

  return NextResponse.json({ ok: true, rowsParsed: rows.length, tdsSectionsFiled: tdsFiled, gstInputsAdded: gstAdded })
}
