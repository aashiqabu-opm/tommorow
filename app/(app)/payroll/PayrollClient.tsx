'use client'

import { useState } from 'react'
import { Plus, Users, Wallet, AlertTriangle, Edit2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { StaffSalary } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  staff: StaffSalary[]
  vendors: { id: string; name: string }[]
  totalMonthlyPayroll: number
  pendingThisMonth: number
  userId: string
}

const EMPTY_FORM = {
  person_name: '',
  role_title: '',
  monthly_salary: '',
  vendor_id: '',
  is_active: true,
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export function PayrollClient({ staff, vendors, totalMonthlyPayroll, pendingThisMonth, userId }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)

  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth)

  const activeStaff = staff.filter(s => s.is_active)

  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function openEdit(s: StaffSalary) {
    setEditId(s.id)
    setForm({
      person_name: s.person_name,
      role_title: s.role_title ?? '',
      monthly_salary: String(s.monthly_salary),
      vendor_id: s.vendor_id ?? '',
      is_active: s.is_active,
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.person_name.trim()) return toast.error('Person name is required')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      person_name: form.person_name.trim(),
      role_title: form.role_title || null,
      monthly_salary: parseFloat(form.monthly_salary) || 0,
      vendor_id: form.vendor_id || null,
      is_active: form.is_active,
    }

    if (editId) {
      const { data, error } = await supabase.from('staff_salaries').update(payload).eq('id', editId).select().single()
      if (error) { toast.error("Couldn't update staff"); setSaving(false); return }
      if (data) await logAction('update', 'staff_salaries', editId, undefined, data)
      toast.success('Staff updated')
    } else {
      const { data, error } = await supabase.from('staff_salaries').insert(payload).select().single()
      if (error) { toast.error("Couldn't add staff"); setSaving(false); return }
      if (data) await logAction('create', 'staff_salaries', data.id, undefined, data)
      toast.success('Staff added')
    }

    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  async function handleGenerateSalaries() {
    if (!selectedMonth) return toast.error('Select a month')
    const [year, month] = selectedMonth.split('-').map(Number)
    const monthName = MONTH_NAMES[month - 1]
    const marker = `Salary for ${monthName} ${year}`

    setGenerating(true)
    const supabase = createClient()

    // Check which liabilities already exist for this month
    const { data: existing } = await supabase
      .from('liabilities')
      .select('party_name, notes')
      .eq('type', 'salary')
      .ilike('notes', `%${marker}%`)

    const existingNames = new Set((existing ?? []).map(e => e.party_name))

    const activeStaffList = staff.filter(s => s.is_active)
    const toCreate = activeStaffList.filter(s => !existingNames.has(s.person_name))

    if (toCreate.length === 0) {
      toast.success(`All ${activeStaffList.length} salary liabilities already exist for ${monthName} ${year}`)
      setGenerating(false)
      return
    }

    // Due date: 5th of next month
    const nextMonth = new Date(year, month, 5) // month is already 1-based, Date uses 0-based so month = next month
    const dueDate = nextMonth.toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    const inserts = toCreate.map(s => ({
      party_name: s.person_name,
      amount_owed: s.monthly_salary,
      amount_paid: 0,
      balance_remaining: s.monthly_salary,
      type: 'salary',
      priority: 'normal',
      status: 'unpaid',
      due_date: dueDate,
      notes: marker,
      original_date: today,
      created_by: userId,
    }))

    const { error } = await supabase.from('liabilities').insert(inserts)
    if (error) { toast.error("Couldn't generate liabilities"); setGenerating(false); return }

    await logAction('create', 'liabilities', 'batch_salary', undefined, { month: marker, count: toCreate.length })
    toast.success(`Generated ${toCreate.length} liabilities, skipped ${activeStaffList.length - toCreate.length} (already exist)`)
    setGenerating(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        subtitle="Manage staff salaries and generate monthly liabilities"
        action={<Button icon={Plus} onClick={openAdd}>Add Staff</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard title="Active Staff" value={activeStaff.length} icon={Users} status="default" />
        <StatCard title="Monthly Payroll" value={formatCurrency(totalMonthlyPayroll)} icon={Wallet} status="green" subtitle="Active staff total" />
        <StatCard title="Pending This Month" value={pendingThisMonth} icon={AlertTriangle} status={pendingThisMonth > 0 ? 'yellow' : 'green'} subtitle="Salary liabilities unpaid" />
      </div>

      {/* Generate salaries section */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Generate Salary Liabilities</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-[#8888aa] mb-1">Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/30"
            />
          </div>
          <div className="pt-5">
            <Button onClick={handleGenerateSalaries} loading={generating} disabled={activeStaff.length === 0}>
              Generate Liabilities for {selectedMonth ? (() => {
                const [y, m] = selectedMonth.split('-').map(Number)
                return `${MONTH_NAMES[m - 1]} ${y}`
              })() : '...'}
            </Button>
          </div>
        </div>
        {activeStaff.length === 0 && (
          <p className="text-xs text-[#5a5a7a] mt-2">Add active staff members first</p>
        )}
      </div>

      {/* Staff list */}
      {staff.length === 0 ? (
        <EmptyState icon={Users} title="No staff members yet" description="Add staff to manage payroll and generate monthly salary liabilities."
          action={<Button icon={Plus} size="sm" onClick={openAdd}>Add Staff</Button>} />
      ) : (
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Staff ({staff.length})</h3>
          </div>
          <div className="divide-y divide-[#2a2a3a]">
            {staff.map(s => (
              <div key={s.id} className="px-5 py-4 flex items-center justify-between hover:bg-[#1a1a24] transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{s.person_name}</span>
                    <StatusBadge label={s.is_active ? 'Active' : 'Inactive'} variant={s.is_active ? 'green' : 'gray'} />
                  </div>
                  {s.role_title && <div className="text-xs text-[#8888aa] mt-0.5">{s.role_title}</div>}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm font-semibold text-white tabular-nums">{formatCurrency(s.monthly_salary)}<span className="text-xs text-[#5a5a7a] font-normal">/mo</span></div>
                  <button onClick={() => openEdit(s)} className="text-[#8888aa] hover:text-white p-1">
                    <Edit2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editId ? 'Edit Staff' : 'Add Staff'} size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Person Name *" value={form.person_name} onChange={e => setForm({ ...form, person_name: e.target.value })} required />
          <Input label="Role / Title" value={form.role_title} onChange={e => setForm({ ...form, role_title: e.target.value })} placeholder="e.g. Director of Photography" />
          <MoneyInput label="Monthly Salary (₹) *" value={form.monthly_salary} onChange={v => setForm({ ...form, monthly_salary: v })} required />
          <Select label="Link to Vendor (optional)" value={form.vendor_id}
            onChange={e => setForm({ ...form, vendor_id: e.target.value })}
            options={vendors.map(v => ({ value: v.id, label: v.name }))}
            placeholder="— No vendor link —" />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={e => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 accent-white"
            />
            <label htmlFor="is_active" className="text-sm text-[#8888aa]">Active (include in payroll)</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editId ? 'Update' : 'Add Staff'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
