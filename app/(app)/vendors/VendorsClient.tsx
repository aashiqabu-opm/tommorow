'use client'

import { useState } from 'react'
import { Plus, Building2, Search } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { Vendor } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  vendors: Vendor[]
  totalEverPaid: number
  userId: string
}

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  gst_number: '',
  pan: '',
  bank_account_name: '',
  bank_account_number: '',
  bank_ifsc: '',
  upi_id: '',
  notes: '',
}

export function VendorsClient({ vendors, totalEverPaid, userId }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase()
    return (
      v.name.toLowerCase().includes(q) ||
      (v.phone ?? '').includes(q) ||
      (v.gst_number ?? '').toLowerCase().includes(q)
    )
  })

  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function openEdit(v: Vendor) {
    setEditId(v.id)
    setForm({
      name: v.name,
      phone: v.phone ?? '',
      email: v.email ?? '',
      gst_number: v.gst_number ?? '',
      pan: v.pan ?? '',
      bank_account_name: v.bank_account_name ?? '',
      bank_account_number: v.bank_account_number ?? '',
      bank_ifsc: v.bank_ifsc ?? '',
      upi_id: v.upi_id ?? '',
      notes: v.notes ?? '',
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Vendor name is required')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      name: form.name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      gst_number: form.gst_number || null,
      pan: form.pan || null,
      bank_account_name: form.bank_account_name || null,
      bank_account_number: form.bank_account_number || null,
      bank_ifsc: form.bank_ifsc || null,
      upi_id: form.upi_id || null,
      notes: form.notes || null,
    }

    if (editId) {
      const { data, error } = await supabase.from('vendors').update(payload).eq('id', editId).select().single()
      if (error) { toast.error("Couldn't update vendor"); setSaving(false); return }
      if (data) await logAction('update', 'vendors', editId, undefined, data)
      toast.success('Vendor updated')
    } else {
      const { data, error } = await supabase.from('vendors').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't add vendor"); setSaving(false); return }
      if (data) await logAction('create', 'vendors', data.id, undefined, data)
      toast.success('Vendor added')
    }

    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Directory"
        subtitle="Manage vendors and track payments"
        action={<Button icon={Plus} onClick={openAdd}>Add Vendor</Button>}
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Total Vendors" value={vendors.length} icon={Building2} status="default" />
        <StatCard title="Total Ever Paid" value={formatCurrency(totalEverPaid)} status="green" subtitle="Via linked vendor payments" />
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8888aa]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, GST..."
          className="w-full bg-[#13131a] border border-[#2a2a3a] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-white/30"
        />
      </div>

      {/* Vendor grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={search ? 'No vendors match your search' : 'No vendors yet'}
          description={!search ? 'Add vendors to link them to payment requests and track total payments.' : undefined}
          action={!search ? <Button icon={Plus} size="sm" onClick={openAdd}>Add Vendor</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(v => (
            <div key={v.id} className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-white/60" />
                </div>
                {(v.total_paid ?? 0) > 0 && (
                  <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
                    {formatCurrency(v.total_paid ?? 0)} paid
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{v.name}</h3>
              {v.phone && <div className="text-xs text-[#8888aa]">{v.phone}</div>}
              {v.gst_number && <div className="text-xs text-[#5a5a7a] mt-0.5">GST: {v.gst_number}</div>}
              {v.email && <div className="text-xs text-[#5a5a7a] mt-0.5">{v.email}</div>}
              <button
                onClick={() => openEdit(v)}
                className="mt-3 text-xs text-white/60 hover:text-white transition-colors"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit Vendor' : 'Add Vendor'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Vendor Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Company or person name" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 ..." />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="GST Number" value={form.gst_number} onChange={e => setForm({ ...form, gst_number: e.target.value })} placeholder="22AAAAA0000A1Z5" />
            <Input label="PAN" value={form.pan} onChange={e => setForm({ ...form, pan: e.target.value })} placeholder="AAAAA0000A" />
          </div>
          <div className="border-t border-[#2a2a3a] pt-4">
            <div className="text-xs font-medium text-[#8888aa] mb-3 uppercase tracking-wider">Bank Details</div>
            <div className="space-y-3">
              <Input label="Account Holder Name" value={form.bank_account_name} onChange={e => setForm({ ...form, bank_account_name: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Account Number" value={form.bank_account_number} onChange={e => setForm({ ...form, bank_account_number: e.target.value })} />
                <Input label="IFSC Code" value={form.bank_ifsc} onChange={e => setForm({ ...form, bank_ifsc: e.target.value })} placeholder="SBIN0001234" />
              </div>
              <Input label="UPI ID" value={form.upi_id} onChange={e => setForm({ ...form, upi_id: e.target.value })} placeholder="vendor@upi" />
            </div>
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editId ? 'Update Vendor' : 'Add Vendor'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
