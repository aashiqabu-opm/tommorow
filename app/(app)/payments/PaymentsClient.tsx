'use client'

import { useState, useMemo } from 'react'
import { Plus, CheckCircle, XCircle, CreditCard, MessageSquare, Send, Printer, Sparkles, AlertTriangle, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge, getPaymentStatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilePicker } from '@/components/ui/FilePicker'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, PAYMENT_CATEGORY_OPTIONS, numberToWordsIndian } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { notifyUsers, notifyFinance } from '@/lib/notifications'
import { compressImage } from '@/lib/compressImage'
import type { PaymentRequest, Comment } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  requests: PaymentRequest[]
  projects: { id: string; name: string }[]
  comments: Comment[]
  userId: string
  role: string
  vendors: { id: string; name: string; pan?: string | null }[]
  budgetLines: { id: string; project_id: string; section: string; head: string }[]
}

const BUDGET_SECTION_LABELS: Record<string, string> = {
  above_line: 'Above the Line', below_line: 'Below the Line', post: 'Post-production', other: 'Other',
}

const INITIAL_FORM = {
  project_id: '',
  payee: '',
  payee_vendor_id: '',
  amount: '',
  gst_amount: '',
  tds_percent: '0',
  tds_section: '',
  purpose: '',
  category: '',
  due_date: '',
  notes: '',
  budget_line_id: '',
}

export function PaymentsClient({ requests, projects, comments, vendors, budgetLines, userId, role }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState<PaymentRequest | null>(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [bill, setBill] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'paid'>('all')
  const [commentsFor, setCommentsFor] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<{ req: PaymentRequest; stage: 'verify' | 'approve' } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const commentsByRequest = comments.reduce<Record<string, Comment[]>>((acc, c) => {
    ;(acc[c.entity_id] = acc[c.entity_id] ?? []).push(c)
    return acc
  }, {})

  const isFounder = role === 'founder'
  const isAccountant = role === 'accountant'
  const canCreate = ['founder', 'accountant', 'general_manager', 'executive_producer'].includes(role)
  const canVerify = isFounder || isAccountant
  const canApprove = isFounder

  const filtered = requests.filter(r => {
    if (activeTab === 'pending') return r.approval_status === 'pending'
    if (activeTab === 'approved') return r.approval_status === 'approved' && r.payment_status === 'unpaid'
    if (activeTab === 'paid') return r.payment_status === 'paid'
    return true
  })

  const pendingCount = requests.filter(r => r.approval_status === 'pending').length
  const approvedUnpaid = requests.filter(r => r.approval_status === 'approved' && r.payment_status === 'unpaid').length
  const totalPending = requests.filter(r => r.approval_status === 'pending').reduce((s, r) => s + r.amount, 0)

  // ── Smart guardrails: catch double-payments, odd amounts, missing PAN ──
  const guard = useMemo(() => {
    const amt = parseFloat(form.amount) || 0
    const tds = parseFloat(form.tds_percent) || 0
    const payeeKey = form.payee.trim().toLowerCase()
    const vendorId = form.payee_vendor_id

    // Prior non-rejected requests to the same vendor (by id) or payee (by name)
    const prior = requests.filter(r => r.id !== editing?.id && r.approval_status !== 'rejected' && (
      vendorId ? r.payee_vendor_id === vendorId
        : (payeeKey ? r.payee.trim().toLowerCase() === payeeKey : false)
    ))

    // Duplicate: same amount (±0.5%) to the same party within 30 days
    const now = Date.now()
    const dup = amt > 0
      ? prior.find(r => Math.abs(r.amount - amt) <= Math.max(1, amt * 0.005) &&
          (now - new Date(r.created_at).getTime()) < 30 * 86400000)
      : undefined

    // Unusual amount: > 3× the median of past payments to this party (≥3 samples)
    let typical = 0
    if (amt > 0 && prior.length >= 3) {
      const amts = prior.map(r => r.amount).filter(a => a > 0).sort((a, b) => a - b)
      const median = amts[Math.floor(amts.length / 2)]
      if (median > 0 && amt > median * 3) typical = median
    }

    // TDS deducted but no PAN on file → 20% rate applies
    let tdsNoPan = false
    if (tds > 0) {
      if (vendorId) { const v = vendors.find(x => x.id === vendorId); tdsNoPan = !v?.pan }
      else tdsNoPan = payeeKey.length > 0
    }

    return { dup, typical, tdsNoPan }
  }, [form.amount, form.tds_percent, form.payee, form.payee_vendor_id, requests, vendors, editing])

  function openNewRequest() {
    // Pre-select the project used last time
    const lastProject = localStorage.getItem('opm_last_project') ?? ''
    setEditing(null)
    setForm({ ...INITIAL_FORM, project_id: projects.some(p => p.id === lastProject) ? lastProject : '' })
    setBill(null)
    setOpen(true)
  }

  function openEdit(req: PaymentRequest) {
    setEditing(req)
    setForm({
      project_id: req.project_id ?? '',
      payee: req.payee ?? '',
      payee_vendor_id: req.payee_vendor_id ?? '',
      amount: req.amount != null ? String(req.amount) : '',
      gst_amount: req.gst_amount != null ? String(req.gst_amount) : '',
      tds_percent: req.tds_percent != null ? String(req.tds_percent) : '0',
      tds_section: req.tds_section ?? '',
      purpose: req.purpose ?? '',
      category: req.category ?? '',
      due_date: req.due_date ?? '',
      notes: req.notes ?? '',
      budget_line_id: req.budget_line_id ?? '',
    })
    setBill(null)
    setOpen(true)
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm(`Delete the payment request to ${editing.payee} for ${formatCurrency(editing.amount)}? This cannot be undone.`)) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('payment_requests').delete().eq('id', editing.id)
    if (error) { toast.error("Couldn't delete — please try again"); setDeleting(false); return }
    await logAction('delete', 'payment_requests', editing.id, editing as unknown as Record<string, unknown>, undefined)
    toast.success('Payment request deleted')
    setDeleting(false)
    setOpen(false)
    setEditing(null)
    router.refresh()
  }

  // When a bill is attached, read it with Claude and pre-fill empty fields.
  // Never overwrites anything the user already typed.
  async function handleBillPicked(file: File | null) {
    setBill(file)
    if (!file) return
    const okType = /^image\/(png|jpe?g|gif|webp)$|^application\/pdf$/.test(file.type)
    if (!okType || file.size > 6_000_000) return // unsupported or too big — skip silently

    setExtracting(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/extract-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType: file.type }),
      })
      if (!res.ok) {
        if (res.status !== 503) {
          const body = await res.json().catch(() => ({}))
          toast.error(body?.detail ? `Bill read failed: ${String(body.detail).slice(0, 90)}` : "Couldn't read the bill — fill manually")
        }
        return
      }
      const { extracted } = await res.json()
      if (!extracted) return

      setForm(prev => {
        const next = { ...prev }
        const set = (k: keyof typeof prev, v: unknown) => {
          if (v != null && v !== '' && !next[k]) next[k] = String(v)
        }
        // Vendor: match an existing vendor, else just set the payee name
        if (extracted.vendor_name && !next.payee) {
          const match = vendors.find(v => v.name.toLowerCase() === String(extracted.vendor_name).toLowerCase())
          if (match) { next.payee_vendor_id = match.id; next.payee = match.name }
          else next.payee = extracted.vendor_name
        }
        set('amount', extracted.amount)
        set('gst_amount', extracted.gst_amount)
        set('purpose', extracted.purpose)
        set('category', extracted.category)
        set('due_date', extracted.due_date)
        return next
      })
      toast.success('Bill read — review the pre-filled fields')
    } catch {
      // network/parse error — silent, user fills manually
    } finally {
      setExtracting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_id) return toast.error('Please select a project')
    // Possible double-payment — make the user confirm before creating it (new requests only)
    if (!editing && guard.dup && !window.confirm(
      `A ${formatCurrency(guard.dup.amount)} payment to ${form.payee || 'this party'} was already recorded on ${formatDate(guard.dup.created_at)} (${guard.dup.approval_status}). Submit this one anyway?`
    )) return
    setSaving(true)
    const supabase = createClient()

    const baseAmount = parseFloat(form.amount) || 0
    const gstAmt = parseFloat(form.gst_amount) || 0
    const tdsPct = parseFloat(form.tds_percent) || 0
    const tdsAmt = tdsPct > 0 ? Math.round(baseAmount * tdsPct / 100 * 100) / 100 : 0
    const netPayable = baseAmount + gstAmt - tdsAmt

    let billUrl: string | undefined = editing?.bill_url
    let billName: string | undefined = editing?.bill_file_name

    if (bill) {
      const upload = await compressImage(bill)
      const path = `payments/${userId}/${Date.now()}_${upload.name}`
      const { data: up, error: upErr } = await supabase.storage.from('documents').upload(path, upload)
      if (upErr) {
        toast.error('File upload failed — check storage bucket is set up')
        setSaving(false)
        return
      }
      if (up) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
        billUrl = urlData.publicUrl
        billName = upload.name
      }
    }

    const core = {
      project_id: form.project_id,
      payee: form.payee,
      payee_vendor_id: form.payee_vendor_id || null,
      amount: baseAmount,
      gst_amount: gstAmt || null,
      tds_percent: tdsPct || null,
      tds_section: tdsPct > 0 ? (form.tds_section || null) : null,
      tds_amount: tdsAmt || null,
      net_payable: (gstAmt > 0 || tdsPct > 0) ? netPayable : null,
      purpose: form.purpose,
      category: form.category,
      due_date: form.due_date || null,
      bill_url: billUrl,
      bill_file_name: billName,
      notes: form.notes || null,
      budget_line_id: form.budget_line_id || null,
    }

    if (editing) {
      // If the amount changed on an already-approved/paid request, it must go
      // back through approval — the prior sign-off was for a different figure.
      const amountChanged = baseAmount !== editing.amount
      const wasCleared = editing.approval_status === 'approved' || editing.payment_status === 'paid'
      const reset = amountChanged && wasCleared
      const update = reset
        ? { ...core, approval_status: 'pending', approved_by: null, approved_at: null, payment_status: 'unpaid', paid_by: null, paid_at: null }
        : core
      const { data, error } = await supabase.from('payment_requests').update(update).eq('id', editing.id).select().single()
      if (error) { toast.error("Couldn't update request — please try again"); setSaving(false); return }
      if (data) await logAction('update', 'payment_requests', editing.id, editing as unknown as Record<string, unknown>, data)
      if (reset) {
        await notifyFinance(
          `Payment edited — needs re-approval: ${form.payee}`,
          `Amount changed to ${formatCurrency(baseAmount)} — ${form.purpose}`,
          'payment_requests', editing.id, userId, true
        )
        toast.success('Updated — amount changed, sent back for re-approval')
      } else {
        toast.success('Payment request updated')
      }
    } else {
      const { data, error } = await supabase.from('payment_requests').insert({
        ...core,
        requested_by: userId,
        verification_status: 'pending',
        approval_status: 'pending',
        payment_status: 'unpaid',
      }).select().single()
      if (error) { toast.error("Couldn't submit request — please try again"); setSaving(false); return }
      if (data) {
        await logAction('create', 'payment_requests', data.id, undefined, data)
        await notifyFinance(
          `New payment request: ${form.payee}`,
          `${formatCurrency(baseAmount)} — ${form.purpose}`,
          'payment_requests', data.id, userId, true
        )
      }
      localStorage.setItem('opm_last_project', form.project_id)
      toast.success('Payment request submitted')
    }

    setSaving(false)
    setOpen(false)
    setEditing(null)
    setForm(INITIAL_FORM)
    setBill(null)
    router.refresh()
  }

  async function handleVerify(req: PaymentRequest) {
    const supabase = createClient()
    const update = {
      verification_status: 'verified',
      verified_by: userId,
      verified_at: new Date().toISOString(),
    }
    await supabase.from('payment_requests').update(update).eq('id', req.id)
    await logAction('update', 'payment_requests', req.id, { verification_status: req.verification_status }, update)
    if (req.requested_by !== userId) {
      await notifyUsers([req.requested_by],
        `Payment request verified: ${req.payee}`,
        `${formatCurrency(req.amount)} — awaiting founder approval`,
        'payment_requests', req.id)
    }
    toast.success(`Verified: ${req.payee}`)
    router.refresh()
  }

  async function handleApprove(req: PaymentRequest) {
    const supabase = createClient()
    const update = {
      approval_status: 'approved',
      approved_by: userId,
      approved_at: new Date().toISOString(),
    }
    await supabase.from('payment_requests').update(update).eq('id', req.id)
    await logAction('update', 'payment_requests', req.id, { approval_status: req.approval_status }, update)
    if (req.requested_by !== userId) {
      await notifyUsers([req.requested_by],
        `Payment request approved: ${req.payee}`,
        `${formatCurrency(req.amount)} — payment will be processed`,
        'payment_requests', req.id, true)
    }
    toast.success(`Approved: ${req.payee}`)
    router.refresh()
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault()
    if (!rejectTarget) return
    const { req, stage } = rejectTarget
    setRejecting(true)
    const supabase = createClient()

    const update = stage === 'verify'
      ? { verification_status: 'rejected', verified_by: userId, verified_at: new Date().toISOString() }
      : { approval_status: 'rejected', approved_by: userId, approved_at: new Date().toISOString() }

    await supabase.from('payment_requests').update(update).eq('id', req.id)
    await logAction('update', 'payment_requests', req.id,
      stage === 'verify' ? { verification_status: req.verification_status } : { approval_status: req.approval_status },
      update)

    const reason = rejectReason.trim()
    if (reason) {
      await supabase.from('comments').insert({
        entity_type: 'payment_requests',
        entity_id: req.id,
        user_id: userId,
        content: `Rejected: ${reason}`,
      })
    }
    if (req.requested_by !== userId) {
      await notifyUsers([req.requested_by],
        `Payment request rejected: ${req.payee}`,
        reason || `${formatCurrency(req.amount)} — see comments for details`,
        'payment_requests', req.id, true)
    }

    toast.success(`Rejected: ${req.payee} — requester notified`)
    setRejecting(false)
    setRejectTarget(null)
    setRejectReason('')
    router.refresh()
  }

  async function handleMarkPaid(req: PaymentRequest) {
    if (req.approval_status !== 'approved') return toast.error('Cannot mark paid — not yet approved')
    const supabase = createClient()
    const update = {
      payment_status: 'paid',
      paid_by: userId,
      paid_at: new Date().toISOString(),
    }
    await supabase.from('payment_requests').update(update).eq('id', req.id)
    await logAction('update', 'payment_requests', req.id, { payment_status: 'unpaid' }, update)
    if (req.requested_by !== userId) {
      await notifyUsers([req.requested_by],
        `Payment completed: ${req.payee}`,
        `${formatCurrency(req.amount)} has been paid`,
        'payment_requests', req.id, true)
    }
    toast.success(`Marked paid: ${req.payee}`)
    router.refresh()
  }

  function openVoucher(req: PaymentRequest) {
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) return
    const net = req.net_payable ?? req.amount
    const amountWords = numberToWordsIndian(net)
    const voucherNo = req.id.replace(/-/g, '').slice(0, 8).toUpperCase()
    const paidDate = req.paid_at ? new Date(req.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const projectName = (req.project as { name?: string } | null)?.name ?? '—'

    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payment Voucher — ${voucherNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #000; background: #fff; padding: 32px; }
    .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #000; padding-bottom: 16px; }
    .header h1 { font-size: 22px; font-weight: bold; letter-spacing: 2px; }
    .header h2 { font-size: 14px; letter-spacing: 4px; color: #444; margin-top: 4px; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
    .meta span { color: #555; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; font-size: 12px; }
    th { background: #f0f0f0; font-weight: bold; width: 35%; color: #333; }
    td { color: #000; }
    .amount-row td { font-weight: bold; font-size: 14px; }
    .words { background: #f9f9f9; border: 1px solid #ccc; border-radius: 4px; padding: 10px 14px; margin-bottom: 24px; font-style: italic; color: #333; font-size: 12px; }
    .words strong { color: #000; font-style: normal; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 40px; }
    .sig-box { border-top: 1px solid #000; padding-top: 8px; text-align: center; font-size: 11px; color: #444; }
    @media print { body { padding: 16px; } @page { size: A4; margin: 16mm; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>OPM CINEMAS</h1>
    <h2>PAYMENT VOUCHER</h2>
  </div>
  <div class="meta">
    <span><strong>Voucher No:</strong> ${voucherNo}</span>
    <span><strong>Date:</strong> ${paidDate}</span>
  </div>
  <table>
    <tr><th>Payee</th><td>${req.payee}</td></tr>
    <tr><th>Purpose</th><td>${req.purpose}</td></tr>
    <tr><th>Project</th><td>${projectName}</td></tr>
    <tr><th>Category</th><td>${req.category || '—'}</td></tr>
    <tr class="amount-row"><th>Base Amount</th><td>₹${req.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>
    ${req.gst_amount ? `<tr><th>GST Amount</th><td>₹${req.gst_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>` : ''}
    ${req.tds_amount ? `<tr><th>TDS (${req.tds_percent ?? 0}%)</th><td>- ₹${req.tds_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>` : ''}
    ${req.net_payable != null ? `<tr class="amount-row"><th>Net Payable</th><td>₹${req.net_payable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td></tr>` : ''}
  </table>
  <div class="words">
    <strong>Amount in Words:</strong> ${amountWords} Rupees Only
  </div>
  <div class="signatures">
    <div class="sig-box">Prepared by</div>
    <div class="sig-box">Approved by</div>
    <div class="sig-box">Received by</div>
  </div>
</body>
</html>`)
    win.document.close()
    win.print()
  }

  async function handlePostComment(req: PaymentRequest) {
    const content = commentText.trim()
    if (!content) return
    setPostingComment(true)
    const supabase = createClient()
    await supabase.from('comments').insert({
      entity_type: 'payment_requests',
      entity_id: req.id,
      user_id: userId,
      content,
    })
    // Notify the requester and finance, excluding whoever wrote the comment
    const targets = new Set<string>()
    if (req.requested_by !== userId) targets.add(req.requested_by)
    await notifyUsers([...targets],
      `New comment on payment: ${req.payee}`,
      content,
      'payment_requests', req.id)
    await notifyFinance(`New comment on payment: ${req.payee}`, content, 'payment_requests', req.id, userId)
    setPostingComment(false)
    setCommentText('')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Requests"
        subtitle="Track and approve all payment requests"
        action={canCreate ? <Button icon={Plus} onClick={openNewRequest}>New Request</Button> : undefined}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard title="Pending Approval" value={pendingCount} status={pendingCount > 0 ? 'yellow' : 'green'} icon={CreditCard} subtitle={formatCurrency(totalPending)} />
        <StatCard title="Approved & Unpaid" value={approvedUnpaid} status={approvedUnpaid > 0 ? 'yellow' : 'green'} />
        <StatCard title="Total This Month" value={requests.filter(r => r.payment_status === 'paid').length} status="default" subtitle="Paid requests" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#13131a] border border-[#2a2a3a] rounded-xl p-1 w-fit">
        {(['all', 'pending', 'approved', 'paid'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${activeTab === tab ? 'bg-white text-black' : 'text-[#8888aa] hover:text-white'}`}
          >
            {tab}
            {tab === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-black text-[10px] font-bold rounded-full px-1.5 py-0.5">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Requests list */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title={activeTab === 'all' ? 'No payment requests yet' : `No ${activeTab} requests`}
            description={canCreate && activeTab === 'all' ? 'Create a request when a payment needs to be made — it goes through verification and approval before being paid.' : undefined}
            action={canCreate && activeTab === 'all' ? <Button icon={Plus} size="sm" onClick={openNewRequest}>New Request</Button> : undefined}
          />
        ) : (
          <div className="divide-y divide-[#2a2a3a]">
            {filtered.map((req) => {
              const statusBadge = getPaymentStatusBadge(req.approval_status)
              return (
                <div key={req.id} className="p-5 hover:bg-[#1a1a24] transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-white">{req.payee}</span>
                        <StatusBadge label={statusBadge.label} variant={statusBadge.variant} />
                        {req.payment_status === 'paid' && <StatusBadge label="Paid" variant="green" />}
                        {!req.bill_url && <StatusBadge label="No Bill" variant="yellow" />}
                      </div>
                      <div className="text-xs text-[#8888aa] space-y-0.5">
                        <div>{req.purpose} · {req.category}</div>
                        <div>
                          Project: {(req.project as { name?: string } | null)?.name ?? '—'} ·
                          By: {(req.requester as { full_name?: string } | null)?.full_name ?? '—'}
                          {req.due_date && ` · Due: ${formatDate(req.due_date)}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-white tabular-nums">{formatCurrency(req.amount)}</div>
                      {req.net_payable != null && req.net_payable !== req.amount && (
                        <div className="text-[11px] text-[#5a5a7a] mt-0.5">Net: {formatCurrency(req.net_payable)}</div>
                      )}
                      <div className="text-[11px] text-[#8888aa] mt-1">{formatDate(req.created_at)}</div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {req.bill_url && (
                      <a href={req.bill_url} target="_blank" rel="noreferrer" className="text-xs text-white/70 hover:text-white">View Bill</a>
                    )}
                    {canVerify && req.verification_status === 'pending' && (
                      <>
                        <button onClick={() => handleVerify(req)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"><CheckCircle size={12} /> Verify</button>
                        <button onClick={() => setRejectTarget({ req, stage: 'verify' })} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><XCircle size={12} /> Reject</button>
                      </>
                    )}
                    {canApprove && req.verification_status === 'verified' && req.approval_status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(req)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"><CheckCircle size={12} /> Approve</button>
                        <button onClick={() => setRejectTarget({ req, stage: 'approve' })} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><XCircle size={12} /> Reject</button>
                      </>
                    )}
                    {canVerify && req.approval_status === 'approved' && req.payment_status === 'unpaid' && (
                      <button onClick={() => handleMarkPaid(req)} className="text-xs text-white/70 hover:text-white flex items-center gap-1"><CheckCircle size={12} /> Mark Paid</button>
                    )}
                    {req.payment_status === 'paid' && (
                      <button onClick={() => openVoucher(req)} className="text-xs text-[#8888aa] hover:text-white flex items-center gap-1"><Printer size={12} /> Voucher</button>
                    )}
                    {canVerify && req.approval_status !== 'rejected' && (
                      <button onClick={() => openEdit(req)} className="text-xs text-[#8888aa] hover:text-white flex items-center gap-1"><Pencil size={12} /> Edit</button>
                    )}
                    <button
                      onClick={() => { setCommentsFor(commentsFor === req.id ? null : req.id); setCommentText('') }}
                      className="text-xs text-[#8888aa] hover:text-white flex items-center gap-1"
                    >
                      <MessageSquare size={12} />
                      {(commentsByRequest[req.id]?.length ?? 0) > 0
                        ? `Comments (${commentsByRequest[req.id].length})`
                        : 'Comment'}
                    </button>
                  </div>

                  {/* Comments thread */}
                  {commentsFor === req.id && (
                    <div className="mt-3 bg-[#0f0f16] border border-[#2a2a3a] rounded-xl p-4 space-y-3">
                      {(commentsByRequest[req.id] ?? []).map((c) => (
                        <div key={c.id} className="flex items-start gap-2.5">
                          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                            {(c.profile?.full_name ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-medium text-white">{c.profile?.full_name ?? 'Unknown'}</span>
                              <span className="text-[10px] text-[#5a5a7a]">{formatDate(c.created_at)}</span>
                            </div>
                            <p className={`text-xs mt-0.5 ${c.content.startsWith('Rejected:') ? 'text-red-300' : 'text-[#b0b0c8]'}`}>{c.content}</p>
                          </div>
                        </div>
                      ))}
                      {(commentsByRequest[req.id]?.length ?? 0) === 0 && (
                        <p className="text-xs text-[#5a5a7a]">No comments yet</p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <input
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePostComment(req) } }}
                          placeholder="Write a comment..."
                          className="flex-1 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-white/40"
                        />
                        <button
                          onClick={() => handlePostComment(req)}
                          disabled={postingComment || !commentText.trim()}
                          className="px-3 py-2 bg-white text-black rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
                        >
                          <Send size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* New / Edit Request Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Payment Request' : 'New Payment Request'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Project *"
            value={form.project_id}
            onChange={e => setForm({ ...form, project_id: e.target.value })}
            options={projects.map(p => ({ value: p.id, label: p.name }))}
            placeholder="— Select project —"
          />
          <Select
            label="Link to Vendor (optional)"
            value={form.payee_vendor_id}
            onChange={e => {
              const vendorId = e.target.value
              const vendor = vendors.find(v => v.id === vendorId)
              setForm({
                ...form,
                payee_vendor_id: vendorId,
                payee: vendor ? vendor.name : form.payee,
              })
            }}
            options={vendors.map(v => ({ value: v.id, label: v.name }))}
            placeholder="— No vendor link —"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Payee *" value={form.payee} onChange={e => setForm({ ...form, payee: e.target.value })} required placeholder="Person / company to pay" />
            <MoneyInput label="Amount *" value={form.amount} onChange={v => setForm({ ...form, amount: v })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="GST Amount (₹)" value={form.gst_amount} onChange={v => setForm({ ...form, gst_amount: v })} />
            <Select label="TDS %" value={form.tds_percent} onChange={e => setForm({ ...form, tds_percent: e.target.value })}
              options={[
                { value: '0', label: 'No TDS' },
                { value: '1', label: '1%' },
                { value: '2', label: '2% (194C)' },
                { value: '5', label: '5%' },
                { value: '10', label: '10%' },
              ]} />
          </div>
          {parseFloat(form.tds_percent) > 0 && (
            <Select label="TDS Section" value={form.tds_section} onChange={e => setForm({ ...form, tds_section: e.target.value })}
              options={[
                { value: '', label: '— Select section —' },
                { value: '194C', label: '194C — Contractor' },
                { value: '194J', label: '194J — Professional / Technical' },
                { value: '194I', label: '194I — Rent' },
                { value: '194H', label: '194H — Commission' },
                { value: '192', label: '192 — Salary' },
                { value: '194Q', label: '194Q — Purchase of goods' },
                { value: 'Other', label: 'Other' },
              ]} />
          )}
          {(parseFloat(form.gst_amount) > 0 || parseFloat(form.tds_percent) > 0) && (
            <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-4 text-xs space-y-1.5">
              <div className="flex justify-between text-[#8888aa]">
                <span>Base Amount:</span>
                <span className="tabular-nums text-white">{formatCurrency(parseFloat(form.amount) || 0)}</span>
              </div>
              {parseFloat(form.gst_amount) > 0 && (
                <div className="flex justify-between text-[#8888aa]">
                  <span>+ GST:</span>
                  <span className="tabular-nums text-white">+{formatCurrency(parseFloat(form.gst_amount) || 0)}</span>
                </div>
              )}
              {parseFloat(form.tds_percent) > 0 && (
                <div className="flex justify-between text-[#8888aa]">
                  <span>- TDS ({form.tds_percent}%):</span>
                  <span className="tabular-nums text-red-300">-{formatCurrency(Math.round((parseFloat(form.amount) || 0) * (parseFloat(form.tds_percent) || 0) / 100 * 100) / 100)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#2a2a3a] pt-1.5 font-semibold">
                <span className="text-white">Net Payable:</span>
                <span className="tabular-nums text-emerald-300">{formatCurrency(
                  (parseFloat(form.amount) || 0) +
                  (parseFloat(form.gst_amount) || 0) -
                  Math.round((parseFloat(form.amount) || 0) * (parseFloat(form.tds_percent) || 0) / 100 * 100) / 100
                )}</span>
              </div>
            </div>
          )}
          <Input label="Purpose *" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} required placeholder="What is this payment for?" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              options={PAYMENT_CATEGORY_OPTIONS.map(c => ({ value: c, label: c }))} placeholder="— Category —" />
            <Input label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          </div>

          {(() => {
            const lines = budgetLines.filter(b => b.project_id === form.project_id)
            if (!form.project_id || lines.length === 0) return null
            return (
              <div>
                <label className="block text-xs font-medium text-[#8888aa] mb-1.5">Budget Head (cost report)</label>
                <select
                  value={form.budget_line_id}
                  onChange={e => setForm({ ...form, budget_line_id: e.target.value })}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/40"
                >
                  <option value="">— Not coded —</option>
                  {['above_line', 'below_line', 'post', 'other'].map(section => {
                    const secLines = lines.filter(l => l.section === section)
                    if (!secLines.length) return null
                    return (
                      <optgroup key={section} label={BUDGET_SECTION_LABELS[section] ?? section}>
                        {secLines.map(l => <option key={l.id} value={l.id}>{l.head}</option>)}
                      </optgroup>
                    )
                  })}
                </select>
              </div>
            )
          })()}
          <div className="space-y-1">
            <FilePicker label="Bill / Receipt" file={bill} onChange={handleBillPicked} />
            {extracting && (
              <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                <Sparkles size={11} className="animate-pulse" /> Reading the bill with AI…
              </p>
            )}
            {!bill && !extracting && <p className="text-[11px] text-amber-400">Attach a bill — AI will auto-fill the form from it</p>}
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />

          {/* Smart guardrails */}
          {guard.dup && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>Possible duplicate — {formatCurrency(guard.dup.amount)} to this party was already recorded on {formatDate(guard.dup.created_at)} ({guard.dup.approval_status}). You&apos;ll be asked to confirm.</span>
            </div>
          )}
          {!guard.dup && guard.typical > 0 && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2 text-xs text-amber-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>This amount is unusually high for this party — past payments are typically around {formatCurrency(guard.typical)}. Double-check before submitting.</span>
            </div>
          )}
          {guard.tdsNoPan && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2 text-xs text-amber-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>TDS is set but no PAN is on file for this vendor — without a PAN, TDS must be deducted at 20%. Add the vendor&apos;s PAN on the Vendors page.</span>
            </div>
          )}

          {editing && (editing.approval_status === 'approved' || editing.payment_status === 'paid') && (parseFloat(form.amount) || 0) !== editing.amount && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2 text-xs text-amber-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>You changed the amount on an already-{editing.payment_status === 'paid' ? 'paid' : 'approved'} request. Saving will send it back for re-approval.</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            {editing && isFounder ? (
              <Button variant="ghost" type="button" icon={Trash2} loading={deleting} onClick={handleDelete} className="text-red-400 hover:text-red-300">Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Submit Request'}</Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={rejectTarget !== null}
        onClose={() => { setRejectTarget(null); setRejectReason('') }}
        title={`Reject: ${rejectTarget?.req.payee ?? ''}`}
      >
        <form onSubmit={handleReject} className="space-y-4">
          <p className="text-xs text-[#8888aa]">
            The reason will be posted as a comment and sent to {(rejectTarget?.req.requester as { full_name?: string } | null)?.full_name ?? 'the requester'} as a notification.
          </p>
          <Textarea
            label="Reason for rejection"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Wrong amount — please resubmit with the correct bill"
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setRejectTarget(null); setRejectReason('') }}>Cancel</Button>
            <Button type="submit" variant="danger" loading={rejecting}>Reject Request</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
