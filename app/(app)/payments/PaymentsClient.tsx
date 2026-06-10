'use client'

import { useState } from 'react'
import { Plus, CheckCircle, XCircle, CreditCard } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge, getPaymentStatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { formatCurrency, formatDate, PAYMENT_CATEGORY_OPTIONS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { PaymentRequest } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  requests: PaymentRequest[]
  projects: { id: string; name: string }[]
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

export function PaymentsClient({ requests, projects, userId, role }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [bill, setBill] = useState<File | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'paid'>('all')

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_id) return alert('Please select a project')
    setSaving(true)
    const supabase = createClient()

    let billUrl: string | undefined
    let billName: string | undefined

    if (bill) {
      const path = `payments/${userId}/${Date.now()}_${bill.name}`
      const { data: up } = await supabase.storage.from('documents').upload(path, bill)
      if (up) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
        billUrl = urlData.publicUrl
        billName = bill.name
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

    if (!error && data) await logAction('create', 'payment_requests', data.id, undefined, data)
    setSaving(false)
    setOpen(false)
    setForm(INITIAL_FORM)
    setBill(null)
    router.refresh()
  }

  async function handleVerify(req: PaymentRequest, approved: boolean) {
    const supabase = createClient()
    const update = {
      verification_status: approved ? 'verified' : 'rejected',
      verified_by: userId,
      verified_at: new Date().toISOString(),
    }
    await supabase.from('payment_requests').update(update).eq('id', req.id)
    await logAction('update', 'payment_requests', req.id, { verification_status: req.verification_status }, update)
    router.refresh()
  }

  async function handleApprove(req: PaymentRequest, approved: boolean) {
    const supabase = createClient()
    const update = {
      approval_status: approved ? 'approved' : 'rejected',
      approved_by: userId,
      approved_at: new Date().toISOString(),
    }
    await supabase.from('payment_requests').update(update).eq('id', req.id)
    await logAction('update', 'payment_requests', req.id, { approval_status: req.approval_status }, update)
    router.refresh()
  }

  async function handleMarkPaid(req: PaymentRequest) {
    if (req.approval_status !== 'approved') return alert('Cannot mark paid — not yet approved')
    const supabase = createClient()
    const update = {
      payment_status: 'paid',
      paid_by: userId,
      paid_at: new Date().toISOString(),
    }
    await supabase.from('payment_requests').update(update).eq('id', req.id)
    await logAction('update', 'payment_requests', req.id, { payment_status: 'unpaid' }, update)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Requests"
        subtitle="Track and approve all payment requests"
        action={canCreate ? <Button icon={Plus} onClick={() => setOpen(true)}>New Request</Button> : undefined}
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
          <div className="py-12 text-center text-[#8888aa] text-sm">No requests found</div>
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
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {req.bill_url && (
                      <a href={req.bill_url} target="_blank" rel="noreferrer" className="text-xs text-white/70 hover:text-white">View Bill</a>
                    )}
                    {canVerify && req.verification_status === 'pending' && (
                      <>
                        <button onClick={() => handleVerify(req, true)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"><CheckCircle size={12} /> Verify</button>
                        <button onClick={() => handleVerify(req, false)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><XCircle size={12} /> Reject</button>
                      </>
                    )}
                    {canApprove && req.verification_status === 'verified' && req.approval_status === 'pending' && (
                      <>
                        <button onClick={() => handleApprove(req, true)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"><CheckCircle size={12} /> Approve</button>
                        <button onClick={() => handleApprove(req, false)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><XCircle size={12} /> Reject</button>
                      </>
                    )}
                    {canVerify && req.approval_status === 'approved' && req.payment_status === 'unpaid' && (
                      <button onClick={() => handleMarkPaid(req)} className="text-xs text-white/70 hover:text-white flex items-center gap-1"><CheckCircle size={12} /> Mark Paid</button>
                    )}
                  </div>
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
            <Input label="Amount *" type="number" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
          </div>
          <Input label="Purpose *" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} required placeholder="What is this payment for?" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              options={PAYMENT_CATEGORY_OPTIONS.map(c => ({ value: c, label: c }))} placeholder="— Category —" />
            <Input label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#8888aa]">Bill / Receipt</label>
            <input type="file" accept="image/*,.pdf" onChange={e => setBill(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-[#8888aa] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#2a2a3a] file:text-white file:text-xs" />
            {!bill && <p className="text-[11px] text-amber-400">Uploading a bill is recommended before submission</p>}
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Submit Request</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
