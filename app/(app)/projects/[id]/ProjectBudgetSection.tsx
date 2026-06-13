'use client'

import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Wand2, ListTree } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { SECTION_LABELS, SECTION_ORDER, PHASE_LABELS, BUDGET_TEMPLATE } from '@/lib/budget'
import type { BudgetLine, BudgetSection, BudgetPhase } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { useRouter } from 'next/navigation'

export type CodedPayment = {
  id: string; payee: string; amount: number; net_payable: number | null
  payment_status: string; approval_status: string; budget_line_id: string | null
}

interface Props {
  projectId: string
  budgetLines: BudgetLine[]
  payments: CodedPayment[]
  extraSpentByLine?: Record<string, number>  // e.g. petty-cash expenses coded to a head
  userId: string
  canManage: boolean
}

const outflow = (p: CodedPayment) => Number(p.net_payable ?? p.amount ?? 0)

const EMPTY = { section: 'below_line' as BudgetSection, phase: 'production' as BudgetPhase, head: '', estimated: '', notes: '' }

export function ProjectBudgetSection({ projectId, budgetLines, payments, extraSpentByLine, userId, canManage }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [editing, setEditing] = useState<BudgetLine | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [assigning, setAssigning] = useState<string | null>(null)

  // Roll up actuals per budget line from coded payments
  const perLine = useMemo(() => {
    const m: Record<string, { spent: number; committed: number }> = {}
    for (const l of budgetLines) m[l.id] = { spent: 0, committed: 0 }
    for (const p of payments) {
      if (!p.budget_line_id || !m[p.budget_line_id]) continue
      if (p.payment_status === 'paid') m[p.budget_line_id].spent += outflow(p)
      else if (p.approval_status === 'approved') m[p.budget_line_id].committed += outflow(p)
    }
    for (const [lineId, amt] of Object.entries(extraSpentByLine ?? {})) {
      if (m[lineId]) m[lineId].spent += amt
    }
    return m
  }, [budgetLines, payments, extraSpentByLine])

  const totals = useMemo(() => {
    let budget = 0, spent = 0, committed = 0
    for (const l of budgetLines) {
      budget += Number(l.estimated || 0)
      spent += perLine[l.id]?.spent ?? 0
      committed += perLine[l.id]?.committed ?? 0
    }
    return { budget, spent, committed, remaining: budget - spent - committed }
  }, [budgetLines, perLine])

  const uncoded = useMemo(
    () => payments.filter(p => !p.budget_line_id && p.approval_status !== 'rejected'),
    [payments]
  )

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(l: BudgetLine) {
    setEditing(l)
    setForm({ section: l.section, phase: l.phase, head: l.head ?? '', estimated: l.estimated != null ? String(l.estimated) : '', notes: l.notes ?? '' })
    setOpen(true)
  }

  async function applyTemplate() {
    setSeeding(true)
    const supabase = createClient()
    const rows = BUDGET_TEMPLATE.map((t, i) => ({ project_id: projectId, section: t.section, phase: t.phase, head: t.head, estimated: 0, sort_order: i, created_by: userId }))
    const { error } = await supabase.from('budget_lines').insert(rows)
    if (error) {
      const hint = /relation .*budget_lines.* does not exist/i.test(error.message) ? 'run migration-budget.sql first' : error.message
      toast.error(`Couldn't apply template — ${String(hint).slice(0, 90)}`)
      setSeeding(false); return
    }
    toast.success('Standard budget template added')
    setSeeding(false)
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.head.trim()) return toast.error('Enter a head name')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, section: form.section, phase: form.phase,
      head: form.head.trim(), estimated: parseFloat(form.estimated) || 0, notes: form.notes || null,
    }
    if (editing) {
      const { data, error } = await supabase.from('budget_lines').update(payload).eq('id', editing.id).select().single()
      if (error) { toast.error("Couldn't update — try again"); setSaving(false); return }
      if (data) await logAction('update', 'budget_lines', editing.id, editing as unknown as Record<string, unknown>, data)
      toast.success('Budget head updated')
    } else {
      const { data, error } = await supabase.from('budget_lines').insert({ ...payload, sort_order: budgetLines.length, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save — try again"); setSaving(false); return }
      if (data) await logAction('create', 'budget_lines', data.id, undefined, data)
      toast.success('Budget head added')
    }
    setSaving(false); setOpen(false); setEditing(null); router.refresh()
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm(`Delete the "${editing.head}" budget head? Payments coded to it become uncoded.`)) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('budget_lines').delete().eq('id', editing.id)
    if (error) { toast.error("Couldn't delete — try again"); setDeleting(false); return }
    await logAction('delete', 'budget_lines', editing.id, editing as unknown as Record<string, unknown>, undefined)
    toast.success('Budget head deleted')
    setDeleting(false); setOpen(false); setEditing(null); router.refresh()
  }

  async function assign(paymentId: string, lineId: string) {
    setAssigning(paymentId)
    const supabase = createClient()
    const value = lineId || null
    const { error } = await supabase.from('payment_requests').update({ budget_line_id: value }).eq('id', paymentId)
    if (error) { toast.error("Couldn't code the payment"); setAssigning(null); return }
    await logAction('update', 'payment_requests', paymentId, undefined, { budget_line_id: value })
    router.refresh()
    setAssigning(null)
  }

  const usedPct = totals.budget > 0 ? Math.round(((totals.spent + totals.committed) / totals.budget) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Film Budget &amp; Cost Report</h3>
          <p className="text-xs text-[#8888aa] mt-0.5">Head-wise budget vs actual — actuals roll up from coded payments</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {budgetLines.length === 0 && (
              <Button variant="secondary" size="sm" icon={Wand2} loading={seeding} onClick={applyTemplate}>Apply Template</Button>
            )}
            <Button icon={Plus} size="sm" onClick={openNew}>Add Head</Button>
          </div>
        )}
      </div>

      {budgetLines.length === 0 ? (
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl py-10 text-center text-sm text-[#8888aa]">
          No budget yet.{canManage ? ' Apply the standard feature-film template, or add heads manually.' : ''}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard title="Total Budget" value={formatCurrency(totals.budget)} status="default" />
            <StatCard title="Spent" value={formatCurrency(totals.spent)} status="red" subtitle={`${usedPct}% of budget used`} />
            <StatCard title="Committed" value={formatCurrency(totals.committed)} status="yellow" subtitle="Approved, unpaid" />
            <StatCard title="Remaining" value={formatCurrency(totals.remaining)} status={totals.remaining < 0 ? 'red' : 'green'} />
          </div>

          {/* Cost report */}
          <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#2a2a3a]">
                  {['Head', 'Phase', 'Budget', 'Committed', 'Spent', 'Remaining', ''].map((h, i) => (
                    <th key={i} className={`px-4 py-2.5 text-[11px] font-medium text-[#8888aa] uppercase tracking-wider whitespace-nowrap ${i >= 2 && i <= 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr></thead>
                {SECTION_ORDER.map(section => {
                    const lines = budgetLines.filter(l => l.section === section).sort((a, b) => a.sort_order - b.sort_order)
                    if (lines.length === 0) return null
                    const sub = lines.reduce((acc, l) => {
                      acc.budget += Number(l.estimated || 0)
                      acc.spent += perLine[l.id]?.spent ?? 0
                      acc.committed += perLine[l.id]?.committed ?? 0
                      return acc
                    }, { budget: 0, spent: 0, committed: 0 })
                    return (
                      <tbody key={section}>
                        <tr className="bg-[#1a1a24]">
                          <td colSpan={2} className="px-4 py-2 text-[11px] font-semibold text-white uppercase tracking-wide">{SECTION_LABELS[section]}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-[#c8c8da]">{formatCurrency(sub.budget)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-amber-400/80">{formatCurrency(sub.committed)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-red-400/80">{formatCurrency(sub.spent)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-[#c8c8da]">{formatCurrency(sub.budget - sub.spent - sub.committed)}</td>
                          <td />
                        </tr>
                        {lines.map(l => {
                          const m = perLine[l.id] ?? { spent: 0, committed: 0 }
                          const remaining = Number(l.estimated || 0) - m.spent - m.committed
                          const over = Number(l.estimated || 0) > 0 && (m.spent + m.committed) > Number(l.estimated)
                          return (
                            <tr key={l.id} className="border-b border-[#2a2a3a] hover:bg-[#1a1a24]">
                              <td className="px-4 py-2.5 text-white">{l.head}</td>
                              <td className="px-4 py-2.5"><StatusBadge label={PHASE_LABELS[l.phase]} variant="gray" /></td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-[#c8c8da]">{formatCurrency(l.estimated)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-amber-400/80">{m.committed ? formatCurrency(m.committed) : '—'}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-red-400/80">{m.spent ? formatCurrency(m.spent) : '—'}</td>
                              <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${over ? 'text-red-400' : 'text-white'}`}>{formatCurrency(remaining)}</td>
                              <td className="px-4 py-2.5 text-right">
                                {canManage && <button onClick={() => openEdit(l)} className="text-[#8888aa] hover:text-white"><Pencil size={13} /></button>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    )
                  })}
              </table>
            </div>
          </div>
        </>
      )}

      {/* Uncoded payments — assign to a head so they count */}
      {canManage && budgetLines.length > 0 && uncoded.length > 0 && (
        <div className="bg-[#13131a] border border-amber-500/20 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center gap-2">
            <ListTree size={15} className="text-amber-400" />
            <h4 className="text-sm font-semibold text-white">Uncoded payments ({uncoded.length})</h4>
            <span className="text-xs text-[#8888aa] ml-auto">Assign each to a budget head so it shows in the cost report</span>
          </div>
          <div className="divide-y divide-[#2a2a3a] max-h-72 overflow-y-auto">
            {uncoded.map(p => (
              <div key={p.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-white truncate">{p.payee}</div>
                  <div className="text-xs text-[#8888aa]">{formatCurrency(outflow(p))} · {p.payment_status === 'paid' ? 'paid' : p.approval_status === 'approved' ? 'approved' : 'pending'}</div>
                </div>
                <select
                  defaultValue=""
                  disabled={assigning === p.id}
                  onChange={e => e.target.value && assign(p.id, e.target.value)}
                  className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40 max-w-[200px]"
                >
                  <option value="">{assigning === p.id ? 'Saving…' : 'Code to head…'}</option>
                  {SECTION_ORDER.map(section => {
                    const lines = budgetLines.filter(l => l.section === section)
                    if (!lines.length) return null
                    return (
                      <optgroup key={section} label={SECTION_LABELS[section]}>
                        {lines.map(l => <option key={l.id} value={l.id}>{l.head}</option>)}
                      </optgroup>
                    )
                  })}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit head modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Budget Head' : 'Add Budget Head'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Head / Department *" value={form.head} onChange={e => setForm({ ...form, head: e.target.value })} required placeholder="e.g. Camera / Cinematography" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Section" value={form.section} onChange={e => setForm({ ...form, section: e.target.value as BudgetSection })}
              options={SECTION_ORDER.map(s => ({ value: s, label: SECTION_LABELS[s] }))} />
            <Select label="Phase" value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value as BudgetPhase })}
              options={(Object.keys(PHASE_LABELS) as BudgetPhase[]).map(p => ({ value: p, label: PHASE_LABELS[p] }))} />
          </div>
          <MoneyInput label="Budget Estimate (₹)" value={form.estimated} onChange={v => setForm({ ...form, estimated: v })} />
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex items-center justify-between gap-2 pt-2">
            {editing ? (
              <Button variant="ghost" type="button" icon={Trash2} loading={deleting} onClick={handleDelete} className="text-red-400 hover:text-red-300">Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Add Head'}</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
