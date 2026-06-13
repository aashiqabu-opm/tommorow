'use client'

import { useState } from 'react'
import { Plus, Users, Landmark, Building2, Percent, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { fundingMetrics } from '@/lib/funding'
import { FUNDING_TXN_LABELS } from '@/lib/types'
import type { ProjectFunding, FundingKind, FundingTxnType } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  funding: ProjectFunding[]
  userId: string
  canManage: boolean
}

const KIND_META: Record<FundingKind, { label: string; icon: typeof Users; variant: 'blue' | 'purple' | 'green' }> = {
  investor: { label: 'Investor', icon: Users, variant: 'purple' },
  loan: { label: 'Loan / Finance', icon: Landmark, variant: 'blue' },
  opm: { label: 'OPM Investment', icon: Building2, variant: 'green' },
}

const EMPTY = {
  kind: 'investor' as FundingKind,
  name: '',
  amount: '',
  equity_percent: '',
  interest_rate: '',
  interest_basis: 'monthly',
  interest_method: 'simple',
  start_date: new Date().toISOString().split('T')[0],
  tenure_months: '',
  status: 'active',
  contact_person: '',
  contact_phone: '',
  contact_email: '',
  notes: '',
}

const TXN_EMPTY = { txn_date: new Date().toISOString().split('T')[0], type: 'capital_in' as FundingTxnType, amount: '', notes: '' }

export function FundingSection({ projectId, funding, userId, canManage }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState<ProjectFunding | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [txnForm, setTxnForm] = useState(TXN_EMPTY)
  const [savingTxn, setSavingTxn] = useState(false)

  const investors = funding.filter(f => f.kind === 'investor')
  const loans = funding.filter(f => f.kind === 'loan')
  const opm = funding.filter(f => f.kind === 'opm')
  const sum = (arr: ProjectFunding[]) => arr.reduce((s, f) => s + Number(f.amount || 0), 0)
  const totalCapital = sum(funding)
  const monthlyInterestTotal = loans.filter(l => l.status === 'active').reduce((s, l) => s + fundingMetrics(l).monthlyInterest, 0)
  const outstandingInterestTotal = loans.reduce((s, l) => s + fundingMetrics(l).outstandingInterest, 0)

  function openNew() {
    setEditing(null)
    setForm(EMPTY)
    setOpen(true)
  }

  function openEdit(f: ProjectFunding) {
    setEditing(f)
    setForm({
      kind: f.kind,
      name: f.name ?? '',
      amount: f.amount != null ? String(f.amount) : '',
      equity_percent: f.equity_percent != null ? String(f.equity_percent) : '',
      interest_rate: f.interest_rate != null ? String(f.interest_rate) : '',
      interest_basis: f.interest_basis ?? 'monthly',
      interest_method: f.interest_method ?? 'simple',
      start_date: f.start_date ?? new Date().toISOString().split('T')[0],
      tenure_months: f.tenure_months != null ? String(f.tenure_months) : '',
      status: f.status ?? 'active',
      contact_person: f.contact_person ?? '',
      contact_phone: f.contact_phone ?? '',
      contact_email: f.contact_email ?? '',
      notes: f.notes ?? '',
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Enter a name')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId,
      kind: form.kind,
      name: form.name.trim(),
      amount: parseFloat(form.amount) || 0,
      equity_percent: form.kind === 'investor' && form.equity_percent ? parseFloat(form.equity_percent) : null,
      interest_rate: form.kind === 'loan' && form.interest_rate ? parseFloat(form.interest_rate) : null,
      interest_basis: form.kind === 'loan' ? form.interest_basis : null,
      interest_method: form.kind === 'loan' ? form.interest_method : null,
      start_date: form.start_date || null,
      tenure_months: form.kind === 'loan' && form.tenure_months ? parseInt(form.tenure_months) : null,
      status: form.status,
      contact_person: form.contact_person || null,
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || null,
      notes: form.notes || null,
    }
    if (editing) {
      const { data, error } = await supabase.from('project_funding').update(payload).eq('id', editing.id).select().single()
      if (error) { toast.error("Couldn't update — try again"); setSaving(false); return }
      if (data) await logAction('update', 'project_funding', editing.id, editing as unknown as Record<string, unknown>, data)
      toast.success('Funding source updated')
    } else {
      const { data, error } = await supabase.from('project_funding').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save — try again"); setSaving(false); return }
      if (data) await logAction('create', 'project_funding', data.id, undefined, data)
      toast.success('Funding source added')
    }
    setSaving(false)
    setOpen(false)
    setEditing(null)
    router.refresh()
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm(`Delete ${editing.name} and all its transactions? This cannot be undone.`)) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('project_funding').delete().eq('id', editing.id)
    if (error) { toast.error("Couldn't delete — try again"); setDeleting(false); return }
    await logAction('delete', 'project_funding', editing.id, editing as unknown as Record<string, unknown>, undefined)
    toast.success('Funding source deleted')
    setDeleting(false)
    setOpen(false)
    setEditing(null)
    router.refresh()
  }

  async function addTxn(fundingId: string) {
    if (!txnForm.amount) return toast.error('Enter an amount')
    setSavingTxn(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('funding_transactions').insert({
      funding_id: fundingId,
      txn_date: txnForm.txn_date,
      type: txnForm.type,
      amount: parseFloat(txnForm.amount) || 0,
      notes: txnForm.notes || null,
      created_by: userId,
    }).select().single()
    if (error) { toast.error("Couldn't log transaction — try again"); setSavingTxn(false); return }
    if (data) await logAction('create', 'funding_transactions', data.id, undefined, data)
    toast.success('Transaction logged')
    setSavingTxn(false)
    setTxnForm(TXN_EMPTY)
    router.refresh()
  }

  async function deleteTxn(id: string) {
    if (!window.confirm('Delete this transaction?')) return
    const supabase = createClient()
    const { error } = await supabase.from('funding_transactions').delete().eq('id', id)
    if (error) { toast.error("Couldn't delete transaction"); return }
    await logAction('delete', 'funding_transactions', id, undefined, undefined)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Funding &amp; Capital Stack</h3>
          <p className="text-xs text-[#8888aa] mt-0.5">Investors, loans &amp; OPM investment for this project</p>
        </div>
        {canManage && <Button icon={Plus} size="sm" onClick={openNew}>Add Source</Button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Capital" value={formatCurrency(totalCapital)} status="default" subtitle={`${funding.length} source${funding.length === 1 ? '' : 's'}`} />
        <StatCard title="Investor Capital" value={formatCurrency(sum(investors))} status="default" icon={Users} subtitle={`${investors.length} investor${investors.length === 1 ? '' : 's'}`} />
        <StatCard title="Loans / Finance" value={formatCurrency(sum(loans))} status={loans.length ? 'yellow' : 'default'} icon={Landmark} subtitle={monthlyInterestTotal > 0 ? `${formatCurrency(monthlyInterestTotal)}/mo interest` : 'No active interest'} />
        <StatCard title="OPM Investment" value={formatCurrency(sum(opm))} status="green" icon={Building2} />
      </div>

      {outstandingInterestTotal > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2.5 text-xs text-amber-300">
          Accrued interest outstanding across loans: <strong>{formatCurrency(outstandingInterestTotal)}</strong> — log interest payments to keep this current.
        </div>
      )}

      {funding.length === 0 ? (
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl py-10 text-center text-sm text-[#8888aa]">
          No funding sources yet.{canManage ? ' Add the project’s investors, loans, and OPM investment.' : ''}
        </div>
      ) : (
        <div className="space-y-3">
          {funding.map(f => {
            const meta = KIND_META[f.kind]
            const m = fundingMetrics(f)
            const isOpen = expanded === f.id
            const txns = f.transactions ?? []
            return (
              <div key={f.id} className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <meta.icon size={15} className="text-white/70 shrink-0" />
                        <span className="text-sm font-semibold text-white">{f.name}</span>
                        <StatusBadge label={meta.label} variant={meta.variant} />
                        {f.status === 'closed' && <StatusBadge label="Closed" variant="gray" />}
                      </div>
                      <div className="text-xs text-[#8888aa] flex flex-wrap gap-x-3 gap-y-0.5">
                        {f.kind === 'investor' && f.equity_percent != null && <span className="flex items-center gap-1"><Percent size={11} />{f.equity_percent}% share</span>}
                        {f.kind === 'loan' && f.interest_rate != null && <span>{f.interest_rate}% / {f.interest_basis === 'annual' ? 'yr' : 'mo'}</span>}
                        {f.start_date && <span>From {formatDate(f.start_date)}</span>}
                        {f.contact_person && <span>{f.contact_person}{f.contact_phone ? ` · ${f.contact_phone}` : ''}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-white tabular-nums">{formatCurrency(f.amount)}</div>
                      {canManage && (
                        <button onClick={() => openEdit(f)} className="text-[11px] text-[#8888aa] hover:text-white inline-flex items-center gap-1 mt-1"><Pencil size={11} /> Edit</button>
                      )}
                    </div>
                  </div>

                  {/* Loan interest math */}
                  {f.kind === 'loan' && f.interest_rate != null && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      {[
                        ['Monthly interest', formatCurrency(m.monthlyInterest)],
                        ['Outstanding principal', formatCurrency(m.outstandingPrincipal)],
                        [`Accrued (${m.monthsElapsed.toFixed(1)} mo)`, formatCurrency(m.accruedInterest)],
                        ['Interest outstanding', formatCurrency(m.outstandingInterest)],
                      ].map(([label, val]) => (
                        <div key={label} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2">
                          <div className="text-[10px] text-[#8888aa] uppercase tracking-wide">{label}</div>
                          <div className="text-sm font-semibold text-white tabular-nums mt-0.5">{val}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Investor / general roll-up */}
                  {f.kind !== 'loan' && (m.capitalIn > 0 || m.payouts > 0) && (
                    <div className="flex gap-4 mt-3 text-xs">
                      <span className="text-[#8888aa]">Received in: <span className="text-emerald-400 font-semibold tabular-nums">{formatCurrency(m.capitalIn)}</span></span>
                      <span className="text-[#8888aa]">Paid out: <span className="text-red-400 font-semibold tabular-nums">{formatCurrency(m.payouts)}</span></span>
                    </div>
                  )}

                  <button onClick={() => { setExpanded(isOpen ? null : f.id); setTxnForm(TXN_EMPTY) }}
                    className="mt-3 text-xs text-[#8888aa] hover:text-white inline-flex items-center gap-1">
                    {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    Transaction log ({txns.length})
                  </button>
                </div>

                {/* Transaction log */}
                {isOpen && (
                  <div className="border-t border-[#2a2a3a] bg-[#0f0f16] px-5 py-4 space-y-3">
                    {txns.length === 0 ? (
                      <p className="text-xs text-[#5a5a7a]">No transactions logged yet.</p>
                    ) : (
                      <div className="divide-y divide-[#2a2a3a]">
                        {txns.map(t => (
                          <div key={t.id} className="py-2 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs text-white">{FUNDING_TXN_LABELS[t.type]}{t.notes ? <span className="text-[#8888aa]"> · {t.notes}</span> : ''}</div>
                              <div className="text-[11px] text-[#5a5a7a]">{formatDate(t.txn_date)}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-semibold tabular-nums ${t.type === 'payout' || t.type === 'principal_repaid' ? 'text-red-400' : 'text-emerald-400'}`}>
                                {formatCurrency(t.amount)}
                              </span>
                              {canManage && <button onClick={() => deleteTxn(t.id)} className="text-[#5a5a7a] hover:text-red-400"><Trash2 size={12} /></button>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {canManage && (
                      <div className="flex flex-wrap items-end gap-2 pt-1">
                        <input type="date" value={txnForm.txn_date} onChange={e => setTxnForm({ ...txnForm, txn_date: e.target.value })}
                          className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40" />
                        <select value={txnForm.type} onChange={e => setTxnForm({ ...txnForm, type: e.target.value as FundingTxnType })}
                          className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40">
                          {Object.entries(FUNDING_TXN_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <input inputMode="decimal" placeholder="Amount" value={txnForm.amount} onChange={e => setTxnForm({ ...txnForm, amount: e.target.value })}
                          className="w-28 bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-white/40" />
                        <input placeholder="Note (optional)" value={txnForm.notes} onChange={e => setTxnForm({ ...txnForm, notes: e.target.value })}
                          className="flex-1 min-w-[120px] bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-white/40" />
                        <Button size="sm" onClick={() => addTxn(f.id)} loading={savingTxn}>Log</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Funding Source' : 'Add Funding Source'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as FundingKind })}
              options={[{ value: 'investor', label: 'Investor' }, { value: 'loan', label: 'Loan / Finance' }, { value: 'opm', label: 'OPM Investment' }]} />
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              options={[{ value: 'active', label: 'Active' }, { value: 'closed', label: 'Closed' }]} />
          </div>
          <Input label={form.kind === 'loan' ? 'Lender Name *' : form.kind === 'opm' ? 'Label *' : 'Investor Name *'}
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
            placeholder={form.kind === 'loan' ? 'e.g. HDFC / financier' : form.kind === 'opm' ? 'e.g. OPM Cinemas' : 'e.g. JM Infotainments'} />
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label={form.kind === 'loan' ? 'Loan Principal (₹) *' : 'Amount (₹) *'} value={form.amount} onChange={v => setForm({ ...form, amount: v })} required />
            <Input label={form.kind === 'loan' ? 'Disbursal Date' : 'Date Onboarded'} type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </div>

          {form.kind === 'investor' && (
            <Input label="Profit / Equity Share (%)" inputMode="decimal" value={form.equity_percent} onChange={e => setForm({ ...form, equity_percent: e.target.value })} placeholder="e.g. 25" />
          )}

          {form.kind === 'loan' && (
            <div className="grid grid-cols-3 gap-3">
              <Input label="Interest Rate (%)" inputMode="decimal" value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: e.target.value })} placeholder="e.g. 2" />
              <Select label="Per" value={form.interest_basis} onChange={e => setForm({ ...form, interest_basis: e.target.value })}
                options={[{ value: 'monthly', label: 'Month' }, { value: 'annual', label: 'Year' }]} />
              <Input label="Tenure (months)" inputMode="numeric" value={form.tenure_months} onChange={e => setForm({ ...form, tenure_months: e.target.value })} placeholder="optional" />
            </div>
          )}

          {form.kind !== 'opm' && (
            <div className="grid grid-cols-3 gap-3">
              <Input label="Contact Person" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} />
              <Input label="Phone" value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
              <Input label="Email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
            </div>
          )}

          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Terms, agreement reference, etc." />

          <div className="flex items-center justify-between gap-2 pt-2">
            {editing ? (
              <Button variant="ghost" type="button" icon={Trash2} loading={deleting} onClick={handleDelete} className="text-red-400 hover:text-red-300">Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Add Source'}</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
