import { createAdminClient } from '@/lib/supabase/admin'
import { whatsappConfigured, normalizeWhatsApp, sendWhatsApp, sendEmail, emailTemplate, sleep } from '@/lib/alerts/channels'
import { validateTwilioSignature, twimlMessage, twimlEmpty, fetchTwilioMedia, pickProject } from '@/lib/whatsapp'
import { extractBill } from '@/lib/ai/extract-bill'
import { askOpm } from '@/lib/ai/assistant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
// Short human-friendly reference for a request id (last 6 hex chars)
const idCode = (id: string) => id.replace(/-/g, '').slice(-6).toUpperCase()
const xml = (body: string) => new Response(body, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })

// Twilio WhatsApp inbound webhook. A bill photo/PDF becomes a DRAFT payment
// request (pending human approval — never auto-paid). Finance users can also
// text simple read-only queries.
export async function POST(req: Request) {
  if (!whatsappConfigured()) return xml(twimlEmpty())
  const sid = process.env.TWILIO_ACCOUNT_SID!
  const authToken = process.env.TWILIO_AUTH_TOKEN!

  const form = await req.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) params[k] = typeof v === 'string' ? v : ''

  // Verify the request is genuinely from Twilio
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://opmoffice.vercel.app'
  const url = `${base}/api/whatsapp/inbound`
  if (!validateTwilioSignature(authToken, url, params, req.headers.get('x-twilio-signature') ?? '')) {
    return new Response('Forbidden', { status: 403 })
  }

  const from = (params.From ?? '').replace('whatsapp:', '')
  const body = (params.Body ?? '').trim()
  const numMedia = parseInt(params.NumMedia ?? '0') || 0
  const admin = createAdminClient()
  if (!admin) return xml(twimlMessage('OPM Office is not fully configured yet (service key missing).'))

  // Match the sender to an active profile by WhatsApp number
  const fromNorm = normalizeWhatsApp(from)
  const { data: profiles } = await admin.from('profiles').select('id, full_name, role, whatsapp_number, is_active, email, email_alerts, whatsapp_alerts')
  const profile = (profiles ?? []).find(p => p.is_active && p.whatsapp_number && normalizeWhatsApp(p.whatsapp_number) === fromNorm)
  if (!profile) {
    return xml(twimlMessage("This number isn't registered with OPM Office. Ask an admin to add your WhatsApp number to your profile."))
  }

  const canCreate = ['founder', 'accountant', 'general_manager', 'executive_producer'].includes(profile.role)
  const isFinance = ['founder', 'accountant'].includes(profile.role)

  // ── Bill photo / PDF → draft payment request ──
  if (numMedia > 0) {
    if (!canCreate) return xml(twimlMessage("You don't have permission to submit payment requests."))
    const mediaUrl = params.MediaUrl0 ?? ''
    const contentType = params.MediaContentType0 ?? ''
    if (!/^image\/(png|jpe?g|gif|webp)$|^application\/pdf$/.test(contentType)) {
      return xml(twimlMessage('Please send the bill as a photo or PDF.'))
    }

    const b64 = await fetchTwilioMedia(mediaUrl, sid, authToken)
    if (!b64) return xml(twimlMessage("Couldn't download the file — please try again."))

    const { data: projects } = await admin.from('projects').select('id, name').neq('status', 'cancelled').order('created_at', { ascending: false })
    const proj = pickProject(projects ?? [], body)
    if (!proj) return xml(twimlMessage('No project found to file this under. Create a project in OPM Office first.'))

    const { data: bill } = await extractBill(b64, contentType)

    // Store the bill so the approver can see it
    let billUrl: string | undefined
    let billName: string | undefined
    try {
      const ext = contentType === 'application/pdf' ? 'pdf' : contentType.split('/')[1]
      const path = `payments/whatsapp/${profile.id}/${Date.now()}.${ext}`
      const { data: up } = await admin.storage.from('documents').upload(path, Buffer.from(b64, 'base64'), { contentType })
      if (up) { billUrl = admin.storage.from('documents').getPublicUrl(path).data.publicUrl; billName = `whatsapp-bill.${ext}` }
    } catch { /* storage optional */ }

    const amount = bill?.amount ?? 0
    const { data: created } = await admin.from('payment_requests').insert({
      project_id: proj.id,
      requested_by: profile.id,
      payee: bill?.vendor_name ?? (body || 'Unknown vendor'),
      amount,
      gst_amount: bill?.gst_amount ?? null,
      purpose: bill?.purpose ?? (body || 'Submitted via WhatsApp'),
      category: bill?.category ?? null,
      bill_url: billUrl,
      bill_file_name: billName,
      verification_status: 'pending',
      approval_status: 'pending',
      payment_status: 'unpaid',
      notes: 'Submitted via WhatsApp',
    }).select('id').single()
    const code = created ? idCode(created.id) : ''

    const who = bill?.vendor_name ? ` for ${bill.vendor_name}` : ''
    const amt = amount ? inr(amount) : 'amount unreadable'

    // Ping finance approvers (founder + accountant) to review — excluding the submitter
    const payeeLabel = bill?.vendor_name ?? (body || 'a vendor')
    const approvers = (profiles ?? []).filter(p =>
      p.is_active && p.id !== profile.id && ['founder', 'accountant'].includes(p.role))
    const waText = `🧾 New bill via WhatsApp from ${profile.full_name}: ${payeeLabel} (${amt}) under "${proj.name}". Review & approve in OPM Office.` +
      (code ? `\nTo decline, reply: REJECT ${code}` : '')
    const html = emailTemplate('New WhatsApp bill to review',
      `<p style="margin:0 0 8px;"><strong>${profile.full_name}</strong> submitted a bill via WhatsApp.</p>` +
      `<p style="margin:0;">Payee: ${payeeLabel}<br/>Amount: ${amt}<br/>Project: ${proj.name}</p>` +
      `<p style="margin:12px 0 0;">It's a draft pending your approval.</p>`)
    for (const a of approvers) {
      if (a.whatsapp_alerts && a.whatsapp_number) await sendWhatsApp(a.whatsapp_number, waText)
      if (a.email_alerts && a.email) { await sendEmail(a.email, 'New WhatsApp bill to review — OPM Office', html); await sleep(600) }
    }

    return xml(twimlMessage(
      `✅ Draft payment created${who} (${amt}) under "${proj.name}". It's pending approval in OPM Office.` +
      (amount ? '' : '\nThe amount couldn’t be read — set it in the app.')
    ))
  }

  // ── Text commands ──
  const cmd = body.toLowerCase()

  if (!body || cmd === 'help' || cmd === 'hi' || cmd === 'hello') {
    return xml(twimlMessage(
      'OPM Office on WhatsApp:\n• Send a bill photo or PDF → I draft a payment for approval.' +
      (isFinance ? "\n• Ask me anything — e.g. \"cost report for Aja Sundari\", \"which contracts renew soon\", \"what's our cash position\"\n• Reply 'REJECT <code>' to decline a draft" : '')
    ))
  }

  // Reject a pending request by its reference code (approving stays in-app only)
  const rejectMatch = body.match(/^(?:reject|decline|no)\s+([a-z0-9]{4,8})\b\s*(.*)/i)
  if (rejectMatch) {
    if (!isFinance) return xml(twimlMessage('Only finance approvers can reject payment requests.'))
    const code = rejectMatch[1].toUpperCase()
    const reason = (rejectMatch[2] ?? '').trim()
    const { data: pend } = await admin.from('payment_requests')
      .select('id, payee, amount, requested_by').eq('approval_status', 'pending')
    const target = (pend ?? []).find(r => idCode(r.id) === code)
    if (!target) return xml(twimlMessage(`No pending request matching code ${code}. It may already be actioned.`))

    const update = { approval_status: 'rejected', approved_by: profile.id, approved_at: new Date().toISOString() }
    await admin.from('payment_requests').update(update).eq('id', target.id)
    await admin.from('audit_logs').insert({
      user_id: profile.id, action: 'update', entity_type: 'payment_requests', entity_id: target.id,
      old_values: { approval_status: 'pending' }, new_values: update,
    })
    if (reason) {
      await admin.from('comments').insert({
        entity_type: 'payment_requests', entity_id: target.id, user_id: profile.id,
        content: `Rejected via WhatsApp: ${reason}`,
      })
    }
    // Tell the submitter
    const submitter = (profiles ?? []).find(p => p.id === target.requested_by)
    if (submitter && submitter.id !== profile.id) {
      const msg = `❌ Your payment request — ${target.payee} (${inr(Number(target.amount))}) — was rejected by ${profile.full_name}${reason ? `: ${reason}` : ''}.`
      if (submitter.whatsapp_alerts && submitter.whatsapp_number) await sendWhatsApp(submitter.whatsapp_number, msg)
      if (submitter.email_alerts && submitter.email) await sendEmail(submitter.email, 'Payment request rejected — OPM Office', emailTemplate('Payment request rejected', `<p style="margin:0;">${msg}</p>`))
    }
    return xml(twimlMessage(`Rejected: ${target.payee} (${inr(Number(target.amount))}).${submitter && submitter.id !== profile.id ? ' The submitter has been notified.' : ''}`))
  }

  if (isFinance && (cmd.includes('cash') || cmd.includes('balance'))) {
    const [lastCash, banks] = await Promise.all([
      admin.from('cash_entries').select('closing_cash').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(1),
      admin.from('bank_accounts').select('current_balance').eq('is_active', true),
    ])
    const cash = Number(lastCash.data?.[0]?.closing_cash ?? 0)
    const bank = (banks.data ?? []).reduce((s, b) => s + Number(b.current_balance ?? 0), 0)
    return xml(twimlMessage(`Cash in hand: ${inr(cash)}\nBank: ${inr(bank)}\nTotal available: ${inr(cash + bank)}`))
  }

  if (isFinance && (cmd.includes('pending') || cmd.includes('approval'))) {
    const { data: pend } = await admin.from('payment_requests').select('amount').eq('approval_status', 'pending')
    const n = (pend ?? []).length
    const total = (pend ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)
    return xml(twimlMessage(`${n} payment request${n === 1 ? '' : 's'} awaiting approval${n ? `, totalling ${inr(total)}` : ''}.`))
  }

  // Anything else from a finance user → full read-only Ask OPM over WhatsApp.
  // Uses the admin client, but only for finance roles (who can already see all data).
  if (isFinance && process.env.ANTHROPIC_API_KEY) {
    try {
      const answer = await askOpm([{ role: 'user', content: body }], admin, true)
      return xml(twimlMessage((answer || "I couldn't find an answer to that.").slice(0, 1500)))
    } catch {
      return xml(twimlMessage('Sorry — I had trouble answering that. Please try again.'))
    }
  }

  return xml(twimlMessage(
    "Didn't catch that. Send a bill photo to draft a payment." + " Text 'help' for options."
  ))
}
