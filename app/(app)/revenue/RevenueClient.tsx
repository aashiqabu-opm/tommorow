'use client'

import { useMemo, useState } from 'react'
import { Plus, TrendingUp, Hourglass, Download, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { REVENUE_SOURCES, REVENUE_SOURCE_LABELS } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { useRouter } from 'next/navigation'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

interface Props {
  income: Row[]
  projects: { id: string; name: string }[]
  userId: string
}

const INITIAL = {
  project_id: '',
  source: 'theatrical',
  status: 'received',
  party: '',
  territory: '',
  gross_amount: '',
  commission_amount: '',
  amount: '',
  income_date: new Date().toISOString().split('T')[0],
  expected_date: '',
  notes: '',
}

function fyStart(): string {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-04-01`
}

export function RevenueClient({ income, projects, userId }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(INITIAL)
  const [projectFilter, setProjectFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const rows = useMemo(() => income.filter(r =>
    (!projectFilter || r.project_id === projectFilter) &&
    (!typeFilter || r.source === typeFilter) &&
    (!statusFilter || (r.status ?? 'received') === statusFilter)
  ), [income, projectFilter, typeFilter, statusFilter])

  const received = income.filter(r => (r.status ?? 'received') === 'received')
  const receivable = income.filter(r => r.status === 'receivable')
  const totalCollected = received.reduce((s, r) => s + (r.amount ?? 0), 0)
  const totalReceivable = receivable.reduce((s, r) => s + (r.amount ?? 0), 0)
  const fy = fyStart()
  const collectedFY = received.filter(r => (r.income_date ?? '') >= fy).reduce((s, r) => s + (r.amount ?? 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_id) return toast.error('Select a project')
    if (!form.amount) return toast.error('Enter the net amount')
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('project_income').insert({
      project_id: form.project_id,
      source: form.source,
      status: form.status,
      party: form.party || null,
      territory: form.territory || null,
      gross_amount: parseFloat(form.gross_amount) || null,
      commission_amount: parseFloat(form.commission_amount) || null,
      amount: parseFloat(form.amount) || 0,
      income_date: form.income_date,
      expected_date: form.status === 'receivable' ? (form.expected_date || null) : null,
      notes: form.notes || null,
      recorded_by: userId,
    }).select().single()
    if (error) { toast.error("Couldn't save — try again"); setSaving(false); return }
    if (data) await logAction('create', 'project_income', data.id, undefined, data)
    toast.success('Revenue recorded')
    setSaving(false)
    setOpen(false)
    setForm(INITIAL)
    router.refresh()
  }

  function exportCSV() {
    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const headers = ['Date', 'Project', 'Type', 'Party', 'Territory', 'Gross', 'Commission', 'Net', 'Status', 'Expected Date', 'Notes']
    const lines = rows.map(r => [
      r.income_date, r.project?.name ?? '', REVENUE_SOURCE_LABELS[r.source] ?? r.source,
      r.party ?? '', r.territory ?? '', r.gross_amount ?? '', r.commission_amount ?? '',
      r.amount ?? 0, r.status ?? 'received', r.expected_date ?? '', r.notes ?? '',
    ].map(esc).join(','))
    const total = ['TOTAL', '', '', '', '', '', '', rows.reduce((s, r) => s + (r.amount ?? 0), 0), '', '', '']
    const csv = '﻿' + [headers.join(','), ...lines, total.map(esc).join(',')].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `OPM_revenue_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue"
        subtitle="Collections, distributor settlements & rights income"
        action={<Button icon={Plus} onClick={() => { setForm(INITIAL); setOpen(true) }}>Record Revenue</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Collected" value={formatCurrency(totalCollected)} status="green" icon={TrendingUp} />
        <StatCard title="Outstanding Receivable" value={formatCurrency(totalReceivable)} status={totalReceivable > 0 ? 'yellow' : 'green'} icon={Hourglass} subtitle={`${receivable.length} pending`} />
        <StatCard title="Collected (this FY)" value={formatCurrency(collectedFY)} status="default" icon={Wallet} subtitle={`Since ${formatDate(fy)}`} />
        <StatCard title="Entries" value={income.length} status="default" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-3">
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
          className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40">
          <option value="">All projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40">
          <option value="">All types</option>
          {REVENUE_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40">
          <option value="">All statuses</option>
          <option value="received">Received</option>
          <option value="receivable">Receivable</option>
        </select>
        <Button variant="secondary" size="sm" icon={Download} onClick={exportCSV} className="ml-auto">Export CSV</Button>
      </div>

      {/* Table */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#2a2a3a]">
              {['Date', 'Project', 'Type', 'Party', 'Gross', 'Commission', 'Net', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-medium text-[#8888aa] uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-[#2a2a3a]">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-[#1a1a24]">
                  <td className="px-4 py-3 text-[#8888aa] whitespace-nowrap">{formatDate(r.income_date)}</td>
                  <td className="px-4 py-3 text-white whitespace-nowrap">{r.project?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[#c8c8da] whitespace-nowrap">{REVENUE_SOURCE_LABELS[r.source] ?? r.source}</td>
                  <td className="px-4 py-3 text-[#8888aa]">{r.party ?? '—'}{r.territory ? <span className="text-[#5a5a7a]"> · {r.territory}</span> : ''}</td>
                  <td className="px-4 py-3 text-[#8888aa] tabular-nums whitespace-nowrap">{r.gross_amount ? formatCurrency(r.gross_amount) : '—'}</td>
                  <td className="px-4 py-3 text-red-400/80 tabular-nums whitespace-nowrap">{r.commission_amount ? `-${formatCurrency(r.commission_amount)}` : '—'}</td>
                  <td className="px-4 py-3 text-emerald-400 font-semibold tabular-nums whitespace-nowrap">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3">
                    {(r.status ?? 'received') === 'received'
                      ? <StatusBadge label="Received" variant="green" />
                      : <StatusBadge label="Receivable" variant="yellow" />}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-[#8888aa] text-sm">No revenue recorded{(projectFilter || typeFilter || statusFilter) ? ' for this filter' : ' yet'}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Revenue Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Record Revenue" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Project *" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}
              options={projects.map(p => ({ value: p.id, label: p.name }))} placeholder="— Select project —" />
            <Select label="Revenue Type" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} options={REVENUE_SOURCES} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Party (distributor / platform)" value={form.party} onChange={e => setForm({ ...form, party: e.target.value })} placeholder="e.g. Central Pictures" />
            <Input label="Territory" value={form.territory} onChange={e => setForm({ ...form, territory: e.target.value })} placeholder="e.g. Kerala / Worldwide" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Gross / Deal Value (₹)" value={form.gross_amount} onChange={v => setForm({ ...form, gross_amount: v })} />
            <MoneyInput label="Commission / Deduction (₹)" value={form.commission_amount} onChange={v => setForm({ ...form, commission_amount: v })} />
          </div>
          <MoneyInput label="Net Amount (₹) *" value={form.amount} onChange={v => setForm({ ...form, amount: v })} required />
          {form.gross_amount && form.commission_amount && !form.amount && (
            <p className="text-[11px] text-[#5a5a7a]">Tip: net is usually gross − commission ({formatCurrency((parseFloat(form.gross_amount) || 0) - (parseFloat(form.commission_amount) || 0))}).</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              options={[{ value: 'received', label: 'Received' }, { value: 'receivable', label: 'Receivable (expected)' }]} />
            <Input label={form.status === 'receivable' ? 'Recorded Date' : 'Received Date'} type="date" value={form.income_date} onChange={e => setForm({ ...form, income_date: e.target.value })} />
          </div>
          {form.status === 'receivable' && (
            <Input label="Expected Collection Date" type="date" value={form.expected_date} onChange={e => setForm({ ...form, expected_date: e.target.value })} />
          )}
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save Revenue</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
