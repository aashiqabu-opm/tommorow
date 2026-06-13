'use client'

import { useState } from 'react'
import { Clapperboard, FileText, CreditCard, AlertTriangle, Plus, TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge, getDocumentStatusBadge, getPaymentStatusBadge } from '@/components/ui/StatusBadge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, DOCUMENT_TYPE_LABELS } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { Project, Document, Liability, ProjectIncome, ProjectFunding, BudgetLine, PettyCashFloat } from '@/lib/types'
import { FundingSection } from './FundingSection'
import { ProjectBudgetSection, type CodedPayment } from './ProjectBudgetSection'
import { PettyCashSection } from './PettyCashSection'
import { useRouter } from 'next/navigation'

interface PaymentRequest {
  id: string; payee: string; purpose: string; amount: number
  approval_status: string; verification_status: string; created_at: string; category?: string
}

interface Props {
  project: Project
  documents: Document[]
  payments: PaymentRequest[]
  liabilities: Liability[]
  income: ProjectIncome[]
  funding: ProjectFunding[]
  budgetLines: BudgetLine[]
  pettyFloats: PettyCashFloat[]
  extraSpentByLine: Record<string, number>
  userId: string
  role: string
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active', development: 'Development', post_production: 'Post Production',
  released: 'Released', on_hold: 'On Hold', cancelled: 'Cancelled',
}
const STATUS_VARIANTS: Record<string, 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray'> = {
  active: 'green', development: 'gray', post_production: 'gray',
  released: 'gray', on_hold: 'yellow', cancelled: 'red',
}

const INCOME_SOURCES = [
  { value: 'theatrical', label: 'Theatrical Release' },
  { value: 'ott', label: 'OTT / Streaming' },
  { value: 'satellite', label: 'Satellite Rights' },
  { value: 'music', label: 'Music Rights' },
  { value: 'advance', label: 'Producer Advance' },
  { value: 'investor', label: 'Investor Funding' },
  { value: 'other', label: 'Other' },
]

export function ProjectDetailClient({ project, documents, payments, liabilities, income, funding, budgetLines, pettyFloats, extraSpentByLine, userId, role }: Props) {
  const isFinance = ['founder', 'accountant'].includes(role)
  const budgetHeads = budgetLines.map(l => ({ id: l.id, section: l.section, head: l.head }))
  const router = useRouter()
  const toast = useToast()
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [incomeForm, setIncomeForm] = useState({ amount: '', source: 'theatrical', income_date: new Date().toISOString().split('T')[0], notes: '' })
  const [budgetForm, setBudgetForm] = useState({ budget: project.budget ? String(project.budget) : '' })

  const canEdit = ['founder', 'accountant', 'general_manager'].includes(role)

  // ── P&L calculations ──────────────────────────────────────────
  const totalIncome = income.reduce((s, i) => s + i.amount, 0)

  // Expenses = approved/paid payment requests + liability amounts paid
  const approvedPayments = payments.filter(p =>
    p.approval_status === 'approved' || p.approval_status === 'paid'
  )
  const totalPaymentsSpent = approvedPayments.reduce((s, p) => s + p.amount, 0)
  const totalLiabilitiesPaid = liabilities.reduce((s, l) => s + l.amount_paid, 0)
  const totalLiabilitiesOwed = liabilities.reduce((s, l) => s + l.amount_owed, 0)
  const totalLiabilitiesOutstanding = liabilities
    .filter(l => l.status !== 'cleared')
    .reduce((s, l) => s + l.balance_remaining, 0)

  const totalSpent = totalPaymentsSpent + totalLiabilitiesPaid
  const totalCommitted = totalSpent + totalLiabilitiesOutstanding // spent + still owed

  const netPL = totalIncome - totalCommitted
  const budget = project.budget ?? 0
  const budgetUsedPct = budget > 0 ? Math.min(Math.round((totalCommitted / budget) * 100), 100) : 0
  const budgetStatus = budgetUsedPct >= 100 ? 'red' : budgetUsedPct >= 80 ? 'yellow' : 'green'

  const pendingPayments = payments.filter(p => p.approval_status === 'pending').length

  // ── Spend by category ──────────────────────────────────────
  const categorySpend = approvedPayments.reduce<Record<string, number>>((acc, p) => {
    const cat = p.category?.trim() || 'Uncategorised'
    acc[cat] = (acc[cat] ?? 0) + p.amount
    return acc
  }, {})
  const categoryEntries = Object.entries(categorySpend)
    .sort((a, b) => b[1] - a[1])

  const expiring = documents.filter(d => {
    if (!d.expiry_date) return false
    const exp = new Date(d.expiry_date)
    const now = new Date()
    return exp > now && exp < new Date(now.getTime() + 30 * 86400000)
  })

  async function handleAddIncome(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('project_income').insert({
      project_id: project.id,
      amount: parseFloat(incomeForm.amount) || 0,
      source: incomeForm.source,
      income_date: incomeForm.income_date,
      notes: incomeForm.notes || null,
      recorded_by: userId,
    }).select().single()
    if (error) { toast.error("Couldn't save income — try again"); setSaving(false); return }
    if (data) await logAction('create', 'project_income', data.id, undefined, data)
    toast.success('Income recorded')
    setSaving(false)
    setIncomeOpen(false)
    setIncomeForm({ amount: '', source: 'theatrical', income_date: new Date().toISOString().split('T')[0], notes: '' })
    router.refresh()
  }

  async function handleUpdateBudget(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const newBudget = parseFloat(budgetForm.budget) || null
    const { error } = await supabase.from('projects').update({ budget: newBudget }).eq('id', project.id)
    if (error) { toast.error("Couldn't update budget"); setSaving(false); return }
    await logAction('update', 'projects', project.id, { budget: project.budget }, { budget: newBudget })
    toast.success('Budget updated')
    setSaving(false)
    setBudgetOpen(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
            <Clapperboard size={22} className="text-white/70" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{project.name}</h1>
              <StatusBadge label={STATUS_LABELS[project.status] ?? project.status} variant={STATUS_VARIANTS[project.status] ?? 'gray'} size="md" />
            </div>
            {project.description && <p className="text-sm text-[#8888aa] mt-0.5">{project.description}</p>}
          </div>
        </div>
        <Link href="/projects" className="text-sm text-[#8888aa] hover:text-white shrink-0">← Back</Link>
      </div>

      {/* ── P&L Overview ─────────────────────────────────────── */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Profit & Loss</h2>
          {canEdit && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setBudgetOpen(true)} icon={Target}>
                {budget > 0 ? 'Edit Budget' : 'Set Budget'}
              </Button>
              <Button size="sm" onClick={() => setIncomeOpen(true)} icon={Plus}>Add Income</Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#0e1f17] border border-emerald-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={13} className="text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-medium uppercase tracking-wide">Total Income</span>
            </div>
            <div className="text-lg font-bold text-emerald-300 tabular-nums">{formatCurrency(totalIncome)}</div>
            <div className="text-[10px] text-emerald-500 mt-0.5">{income.length} entries</div>
          </div>

          <div className="bg-[#1f0e0e] border border-red-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={13} className="text-red-400" />
              <span className="text-[11px] text-red-400 font-medium uppercase tracking-wide">Total Spent</span>
            </div>
            <div className="text-lg font-bold text-red-300 tabular-nums">{formatCurrency(totalSpent)}</div>
            <div className="text-[10px] text-red-500 mt-0.5">+{formatCurrency(totalLiabilitiesOutstanding)} outstanding</div>
          </div>

          <div className={`rounded-xl p-4 border ${netPL >= 0 ? 'bg-[#0e1f17] border-emerald-500/20' : 'bg-[#1f0e0e] border-red-500/20'}`}>
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={13} className={netPL >= 0 ? 'text-emerald-400' : 'text-red-400'} />
              <span className={`text-[11px] font-medium uppercase tracking-wide ${netPL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Net P&L</span>
            </div>
            <div className={`text-lg font-bold tabular-nums ${netPL >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {netPL >= 0 ? '+' : ''}{formatCurrency(netPL)}
            </div>
            <div className={`text-[10px] mt-0.5 ${netPL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {netPL >= 0 ? 'Profit' : 'Loss'} so far
            </div>
          </div>

          <div className="bg-[#13131a] border border-[#2a2a3a] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target size={13} className="text-white/60" />
              <span className="text-[11px] text-[#8888aa] font-medium uppercase tracking-wide">Budget</span>
            </div>
            {budget > 0 ? (
              <>
                <div className="text-lg font-bold text-white tabular-nums">{formatCurrency(budget)}</div>
                <div className={`text-[10px] mt-0.5 ${budgetStatus === 'red' ? 'text-red-400' : budgetStatus === 'yellow' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {budgetUsedPct}% committed
                </div>
              </>
            ) : (
              <div className="text-sm text-[#5a5a7a] mt-1">Not set</div>
            )}
          </div>
        </div>

        {/* Budget progress bar */}
        {budget > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[#8888aa]">
              <span>Budget utilisation — {formatCurrency(totalCommitted)} of {formatCurrency(budget)}</span>
              <span className={budgetStatus === 'red' ? 'text-red-400' : budgetStatus === 'yellow' ? 'text-amber-400' : 'text-emerald-400'}>
                {budgetUsedPct}%
              </span>
            </div>
            <ProgressBar value={totalCommitted} max={budget} status={budgetStatus} size="md" showLabel={false} />
            {budget > totalCommitted && (
              <div className="text-xs text-[#5a5a7a]">{formatCurrency(budget - totalCommitted)} remaining in budget</div>
            )}
            {budget < totalCommitted && (
              <div className="text-xs text-red-400">Over budget by {formatCurrency(totalCommitted - budget)}</div>
            )}
          </div>
        )}

        {/* Expense breakdown */}
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#2a2a3a]">
          <div>
            <div className="text-[11px] text-[#8888aa] mb-1">Payment Requests (approved/paid)</div>
            <div className="text-sm font-semibold text-white tabular-nums">{formatCurrency(totalPaymentsSpent)}</div>
            <div className="text-[10px] text-[#5a5a7a]">{approvedPayments.length} transactions</div>
          </div>
          <div>
            <div className="text-[11px] text-[#8888aa] mb-1">Liabilities</div>
            <div className="text-sm font-semibold text-white tabular-nums">{formatCurrency(totalLiabilitiesOwed)}</div>
            <div className="text-[10px] text-[#5a5a7a]">{formatCurrency(totalLiabilitiesPaid)} paid · {formatCurrency(totalLiabilitiesOutstanding)} outstanding</div>
          </div>
        </div>

        {/* Spend by category */}
        {categoryEntries.length > 0 && (
          <div className="pt-3 border-t border-[#2a2a3a]">
            <div className="text-[11px] text-[#8888aa] font-medium uppercase tracking-wider mb-3">Spend by Category</div>
            <div className="space-y-2.5">
              {categoryEntries.map(([cat, amount]) => {
                const pct = totalPaymentsSpent > 0 ? Math.round((amount / totalPaymentsSpent) * 100) : 0
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#8888aa]">{cat}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#5a5a7a]">{pct}%</span>
                        <span className="text-xs font-medium text-white tabular-nums">{formatCurrency(amount)}</span>
                      </div>
                    </div>
                    <ProgressBar value={amount} max={totalPaymentsSpent || 1} showLabel={false} size="sm" />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Documents" value={documents.length} icon={FileText} status="default" />
        <StatCard title="Pending Payments" value={pendingPayments} icon={CreditCard} status={pendingPayments > 0 ? 'yellow' : 'green'} />
        <StatCard title="Liabilities Outstanding" value={formatCurrency(totalLiabilitiesOutstanding)} icon={AlertTriangle} status={totalLiabilitiesOutstanding > 0 ? 'red' : 'green'} />
        <StatCard title="Expiring Docs" value={expiring.length} status={expiring.length > 0 ? 'yellow' : 'green'} subtitle="Within 30 days" />
      </div>

      {/* Film Budget & Cost Report (finance only) */}
      {isFinance && (
        <ProjectBudgetSection
          projectId={project.id}
          budgetLines={budgetLines}
          payments={payments as unknown as CodedPayment[]}
          extraSpentByLine={extraSpentByLine}
          userId={userId}
          canManage={isFinance}
        />
      )}

      {/* Petty Cash Floats (finance only) */}
      {isFinance && (
        <PettyCashSection
          projectId={project.id}
          floats={pettyFloats}
          budgetLines={budgetHeads}
          userId={userId}
          canManage={isFinance}
        />
      )}

      {/* Funding & Capital Stack (finance only) */}
      {isFinance && (
        <FundingSection projectId={project.id} funding={funding} userId={userId} canManage={isFinance} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income history */}
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Income Entries</h3>
            <span className="text-xs text-emerald-400 font-semibold tabular-nums">{formatCurrency(totalIncome)}</span>
          </div>
          {income.length === 0 ? (
            <div className="py-8 text-center text-[#8888aa] text-sm">No income recorded yet</div>
          ) : (
            <div className="divide-y divide-[#2a2a3a]">
              {income.map(i => (
                <div key={i.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white">{i.source}</div>
                    <div className="text-xs text-[#8888aa]">{formatDate(i.income_date)}{i.notes ? ` · ${i.notes}` : ''}</div>
                  </div>
                  <div className="text-sm font-semibold text-emerald-400 tabular-nums">+{formatCurrency(i.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Requests */}
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Payment Requests</h3>
            <Link href="/payments" className="text-xs text-white/70 hover:text-white">View all</Link>
          </div>
          {payments.length === 0 ? (
            <div className="py-8 text-center text-[#8888aa] text-sm">No payment requests</div>
          ) : (
            <div className="divide-y divide-[#2a2a3a]">
              {payments.slice(0, 6).map(p => {
                const s = getPaymentStatusBadge(p.approval_status)
                return (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm text-white truncate">{p.payee}</div>
                      <div className="text-xs text-[#8888aa] truncate">{p.purpose}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-white tabular-nums">{formatCurrency(p.amount)}</div>
                      <StatusBadge label={s.label} variant={s.variant} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Documents</h3>
            <Link href="/documents" className="text-xs text-white/70 hover:text-white">View all</Link>
          </div>
          {documents.length === 0 ? (
            <div className="py-8 text-center text-[#8888aa] text-sm">No documents</div>
          ) : (
            <div className="divide-y divide-[#2a2a3a]">
              {documents.slice(0, 5).map(doc => {
                const s = getDocumentStatusBadge(doc.status)
                return (
                  <div key={doc.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white">{doc.title}</div>
                      <div className="text-xs text-[#8888aa]">{DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type}</div>
                    </div>
                    <StatusBadge label={s.label} variant={s.variant} />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Liabilities */}
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Liabilities</h3>
            <Link href="/liabilities" className="text-xs text-white/70 hover:text-white">View all</Link>
          </div>
          {liabilities.length === 0 ? (
            <div className="py-8 text-center text-[#8888aa] text-sm">No liabilities</div>
          ) : (
            <div className="divide-y divide-[#2a2a3a]">
              {liabilities.map(l => (
                <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{l.party_name}</div>
                    <div className="text-xs text-[#8888aa]">Balance: {formatCurrency(l.balance_remaining)}</div>
                  </div>
                  <div className="text-sm font-semibold text-white tabular-nums shrink-0">{formatCurrency(l.amount_owed)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project meta */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Project Details</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          {project.start_date && <div><div className="text-xs text-[#8888aa] mb-1">Start Date</div><div className="text-white">{formatDate(project.start_date)}</div></div>}
          {project.end_date && <div><div className="text-xs text-[#8888aa] mb-1">End Date</div><div className="text-white">{formatDate(project.end_date)}</div></div>}
          {project.budget && <div><div className="text-xs text-[#8888aa] mb-1">Budget</div><div className="text-white">{formatCurrency(project.budget)}</div></div>}
          <div><div className="text-xs text-[#8888aa] mb-1">Created</div><div className="text-white">{formatDate(project.created_at)}</div></div>
        </div>
      </div>

      {/* Add Income Modal */}
      <Modal open={incomeOpen} onClose={() => setIncomeOpen(false)} title="Record Income" size="sm">
        <form onSubmit={handleAddIncome} className="space-y-4">
          <MoneyInput label="Amount *" value={incomeForm.amount} onChange={v => setIncomeForm({ ...incomeForm, amount: v })} required />
          <Select label="Source" value={incomeForm.source} onChange={e => setIncomeForm({ ...incomeForm, source: e.target.value })} options={INCOME_SOURCES} />
          <Input label="Date" type="date" value={incomeForm.income_date} onChange={e => setIncomeForm({ ...incomeForm, income_date: e.target.value })} />
          <Textarea label="Notes" value={incomeForm.notes} onChange={e => setIncomeForm({ ...incomeForm, notes: e.target.value })} rows={2} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setIncomeOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Budget Modal */}
      <Modal open={budgetOpen} onClose={() => setBudgetOpen(false)} title="Set Project Budget" size="sm">
        <form onSubmit={handleUpdateBudget} className="space-y-4">
          <MoneyInput label="Total Budget (₹)" value={budgetForm.budget} onChange={v => setBudgetForm({ budget: v })} />
          <p className="text-xs text-[#8888aa]">This is the total amount allocated for this project. The app will track what percentage has been committed (payments + liabilities).</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setBudgetOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Update Budget</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
