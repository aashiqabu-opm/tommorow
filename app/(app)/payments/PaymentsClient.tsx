'use client'

import { useState } from 'react'
import { Plus, CheckCircle, XCircle, CreditCard, MessageSquare, Send } from 'lucide-react'
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
import { formatCurrency, formatDate, PAYMENT_CATEGORY_OPTIONS } from '@/lib/utils'
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
}

const INITIAL_FORM = {
  project_id: '',
  payee: '',
  amount: '',
  purpose: '',
  category: '',
  due_date: '',
  notes: '',
}

export function PaymentsClient({ requests, projects, comments, userId, role }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [bill, setBill] = useState<File | null>(null)
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

  function openNewRequest() {
    // Pre-select the project used last time
    const lastProject = localStorage.getItem('opm_last_project') ?? ''
    setForm({ ...INITIAL_FORM, project_id: projects.some(p => p.id === lastProject) ? lastProject : '' })
    setBill(null)
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_id) return toast.error('Please select a project')
    setSaving(true)
    const supabase = createClient()

    let billUrl: string | undefined
    let billName: string | undefined

    if (bill) {
      const upload = await compressImage(bill)
      const path = `payments/${userId}/${Date.now()}_${upload.name}`
      const { data: up } = await supabase.storage.from('documents').upload(path, upload)
      if (up) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
        billUrl = urlData.publicUrl
        billName = upload.name
      }
    }

    const { data, error } = await supabase.from('payment_requests').insert({
      project_id: form.project_id,
      requested_by: userId,
      payee: form.payee,
      amount: parseFloat(form.amount) || 0,
      purpose: form.purpose,
      category: form.category,
      due_date: form.due_date || null,
      bill_url: billUrl,
      bill_file_name: billName,
      verification_status: 'pending',
      approval_status: 'pending',
      payment_status: 'unpaid',
      notes: form.notes || null,
    }).select().single()

    if (error) {
      toast.error("Couldn't submit request — please try again")
      setSaving(false)
      return
    }
    if (data) {
      await logAction('create', 'payment_requests', data.id, undefined, data)
      await notifyFinance(
        `New payment request: ${form.payee}`,
        `${formatCurrency(parseFloat(form.amount) || 0)} — ${form.purpose}`,
        'payment_requests', data.id, userId
      )
    }
    localStorage.setItem('opm_last_project', form.project_id)
    toast.success('Payment request submitted')
    setSaving(false)
    setOpen(false)
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
        'payment_requests', req.id)
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
        'payment_requests', req.id)
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
        'payment_requests', req.id)
    }
    toast.success(`Marked paid: ${req.payee}`)
    router.refresh()
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

      {/* New Request Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Payment Request" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Project *"
            value={form.project_id}
            onChange={e => setForm({ ...form, project_id: e.target.value })}
            options={projects.map(p => ({ value: p.id, label: p.name }))}
            placeholder="— Select project —"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Payee *" value={form.payee} onChange={e => setForm({ ...form, payee: e.target.value })} required placeholder="Person / company to pay" />
            <MoneyInput label="Amount *" value={form.amount} onChange={v => setForm({ ...form, amount: v })} required />
          </div>
          <Input label="Purpose *" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} required placeholder="What is this payment for?" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              options={PAYMENT_CATEGORY_OPTIONS.map(c => ({ value: c, label: c }))} placeholder="— Category —" />
            <Input label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="space-y-1">
            <FilePicker label="Bill / Receipt" file={bill} onChange={setBill} />
            {!bill && <p className="text-[11px] text-amber-400">Uploading a bill is recommended before submission</p>}
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Submit Request</Button>
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
