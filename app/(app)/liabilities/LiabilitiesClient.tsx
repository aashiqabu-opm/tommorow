'use client'

import { useState } from 'react'
import { Plus, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge, getLiabilityStatusBadge, getPriorityBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { formatCurrency, formatDate, paidPercent, LIABILITY_TYPE_LABELS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { Liability } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  liabilities: Liability[]
  projects: { id: string; name: string }[]
  userId: string
}

const INITIAL_FORM = {
  party_name: '',
  amount_owed: '',
  amount_paid: '',
  original_date: new Date().toISOString().split('T')[0],
  due_date: '',
  project_id: '',
  type: 'vendor',
  priority: 'normal',
  status: 'unpaid',
  notes: '',
}

export function LiabilitiesClient({ liabilities, projects, userId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [paymentModal, setPaymentModal] = useState<Liability | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  const totalOwed = liabilities.reduce((s, l) => s + l.amount_owed, 0)
  const totalPaid = liabilities.reduce((s, l) => s + l.amount_paid, 0)
  const balance = totalOwed - totalPaid
  const urgent = liabilities.filter(l => l.priority === 'urgent' && l.status !== 'cleared')

  const today = new Date()
  const week = new Date(today.getTime() + 7 * 86400000)
  const month = new Date(today.getTime() + 30 * 86400000)
  const dueThisWeek = liabilities.filter(l => l.due_date && new Date(l.due_date) <= week && l.status !== 'cleared')
  const dueThisMonth = liabilities.filter(l => l.due_date && new Date(l.due_date) <= month && l.status !== 'cleared')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const amountOwed = parseFloat(form.amount_owed) || 0
    const amountPaid = parseFloat(form.amount_paid) || 0

    const { data, error } = await supabase.from('liabilities').insert({
      party_name: form.party_name,
      amount_owed: amountOwed,
      amount_paid: amountPaid,
      balance_remaining: amountOwed - amountPaid,
      original_date: form.original_date,
      due_date: form.due_date || null,
      project_id: form.project_id || null,
      type: form.type,
      priority: form.priority,
      status: form.status,
      notes: form.notes || null,
      created_by: userId,
    }).select().single()

    if (!error && data) {
      await logAction('create', 'liabilities', data.id, undefined, data)
    }

    setSaving(false)
    setOpen(false)
    setForm(INITIAL_FORM)
    router.refresh()
  }

  async function handlePayment() {
    if (!paymentModal || savingPayment) return
    setSavingPayment(true)
    const supabase = createClient()
    const amount = parseFloat(paymentAmount) || 0
    const newPaid = paymentModal.amount_paid + amount
    const newBalance = paymentModal.amount_owed - newPaid
    const newStatus = newBalance <= 0 ? 'cleared' : 'partly_paid'

    await supabase.from('liability_payments').insert({
      liability_id: paymentModal.id,
      amount,
      payment_date: new Date().toISOString().split('T')[0],
      paid_by: userId,
      notes: paymentNote || null,
    })

    const { data: updated } = await supabase.from('liabilities').update({
      amount_paid: newPaid,
      balance_remaining: newBalance,
      status: newStatus,
    }).eq('id', paymentModal.id).select().single()

    if (updated) await logAction('update', 'liabilities', paymentModal.id, paymentModal as unknown as Record<string, unknown>, updated)

    setSavingPayment(false)
    setPaymentModal(null)
    setPaymentAmount('')
    setPaymentNote('')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Previous Liabilities"
        subtitle="Track all outstanding dues and payments"
        action={<Button icon={Plus} onClick={() => setOpen(true)}>Add Liability</Button>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Owed" value={formatCurrency(totalOwed)} status={totalOwed > 0 ? 'red' : 'green'} icon={AlertTriangle} />
        <StatCard title="Total Paid" value={formatCurrency(totalPaid)} status="green" subtitle={`${paidPercent(totalPaid, totalOwed)}% cleared`} />
        <StatCard title="Balance Remaining" value={formatCurrency(balance)} status={balance > 0 ? 'yellow' : 'green'} />
        <StatCard title="Urgent Dues" value={urgent.length} status={urgent.length === 0 ? 'green' : 'red'} subtitle={`${dueThisWeek.length} due this week`} />
      </div>

      {/* Liabilities list */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">All Liabilities</h3>
          <span className="text-xs text-[#8888aa]">{liabilities.length} total</span>
        </div>

        {liabilities.length === 0 ? (
          <div className="py-12 text-center text-[#8888aa] text-sm">No liabilities recorded</div>
        ) : (
          <div className="divide-y divide-[#2a2a3a]">
            {liabilities.map((lib) => {
              const pct = paidPercent(lib.amount_paid, lib.amount_owed)
              const status = getLiabilityStatusBadge(lib.status)
              const priority = getPriorityBadge(lib.priority)
              return (
                <div key={lib.id} className="px-5 py-4 hover:bg-[#1a1a24] transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{lib.party_name}</span>
                        <StatusBadge label={priority.label} variant={priority.variant} />
                        <StatusBadge label={status.label} variant={status.variant} />
                        <StatusBadge label={LIABILITY_TYPE_LABELS[lib.type]} variant="gray" />
                      </div>
                      {lib.due_date && (
                        <span className="text-xs text-[#8888aa]">Due: {formatDate(lib.due_date)}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white tabular-nums">{formatCurrency(lib.amount_owed)}</div>
                      <div className="text-xs text-[#8888aa]">Balance: {formatCurrency(lib.balance_remaining)}</div>
                    </div>
                  </div>
                  <ProgressBar value={lib.amount_paid} max={lib.amount_owed} showLabel size="sm" />
                  {lib.status !== 'cleared' && (
                    <div className="mt-2">
                      <button
                        onClick={() => setPaymentModal(lib)}
                        className="text-xs text-white/70 hover:text-white font-medium"
                      >
                        + Record Payment
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Liability Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Add Liability" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Party Name" value={form.party_name} onChange={e => setForm({ ...form, party_name: e.target.value })} required placeholder="Vendor / Artist / Person name" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount Owed" type="number" min="0" value={form.amount_owed} onChange={e => setForm({ ...form, amount_owed: e.target.value })} required />
            <Input label="Already Paid" type="number" min="0" value={form.amount_paid} onChange={e => setForm({ ...form, amount_paid: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Original Date" type="date" value={form.original_date} onChange={e => setForm({ ...form, original_date: e.target.value })} required />
            <Input label="Due Date" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              options={Object.entries(LIABILITY_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
            <Select label="Priority" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
              options={[{ value: 'urgent', label: 'Urgent' }, { value: 'normal', label: 'Normal' }, { value: 'low', label: 'Low' }]} />
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              options={[{ value: 'unpaid', label: 'Unpaid' }, { value: 'partly_paid', label: 'Partly Paid' }, { value: 'cleared', label: 'Cleared' }, { value: 'disputed', label: 'Disputed' }]} />
          </div>
          <Select label="Project" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}
            placeholder="— No project —"
            options={projects.map(p => ({ value: p.id, label: p.name }))} />
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal open={!!paymentModal} onClose={() => setPaymentModal(null)} title="Record Payment" size="sm">
        {paymentModal && (
          <div className="space-y-4">
            <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-4">
              <div className="text-xs text-[#8888aa] mb-1">{paymentModal.party_name}</div>
              <div className="text-sm font-semibold text-white">Balance: {formatCurrency(paymentModal.balance_remaining)}</div>
            </div>
            <Input label="Payment Amount" type="number" min="0" max={paymentModal.balance_remaining}
              value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required />
            <Textarea label="Notes" value={paymentNote} onChange={e => setPaymentNote(e.target.value)} rows={2} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPaymentModal(null)}>Cancel</Button>
              <Button onClick={handlePayment} disabled={!paymentAmount} loading={savingPayment}>Save Payment</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
