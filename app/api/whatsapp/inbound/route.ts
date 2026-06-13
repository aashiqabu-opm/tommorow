import { createAdminClient } from '@/lib/supabase/admin'
import { whatsappConfigured, normalizeWhatsApp } from '@/lib/alerts/channels'
import { validateTwilioSignature, twimlMessage, twimlEmpty, fetchTwilioMedia, pickProject } from '@/lib/whatsapp'
import { extractBill } from '@/lib/ai/extract-bill'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
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
  const { data: profiles } = await admin.from('profiles').select('id, full_name, role, whatsapp_number, is_active')
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
    await admin.from('payment_requests').insert({
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
    })

    const who = bill?.vendor_name ? ` for ${bill.vendor_name}` : ''
    const amt = amount ? inr(amount) : 'amount unreadable'
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
      (isFinance ? "\n• Text 'cash' — current cash & bank\n• Text 'pending' — approvals waiting" : '')
    ))
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

  return xml(twimlMessage(
    "Didn't catch that. Send a bill photo to draft a payment" +
    (isFinance ? ", or text 'cash' or 'pending'." : '.') + " Text 'help' for options."
  ))
}
