'use client'

import { useState } from 'react'
import { Plus, Clapperboard, TrendingUp, TrendingDown, Star } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatDate, formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { Project } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface PaymentRow { project_id: string; amount: number; approval_status: string }
interface LiabilityRow { project_id: string; amount_owed: number; amount_paid: number; balance_remaining: number; status: string }
interface IncomeRow { project_id: string; amount: number; status?: 'received' | 'receivable' }

interface Props {
  projects: Project[]
  payments: PaymentRow[]
  liabilities: LiabilityRow[]
  income: IncomeRow[]
  userId: string
  role: string
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'development', label: 'Development' },
  { value: 'post_production', label: 'Post Production' },
  { value: 'released', label: 'Released' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_CONFIG: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray' }> = {
  active: { label: 'Active', variant: 'green' },
  development: { label: 'Development', variant: 'gray' },
  post_production: { label: 'Post Production', variant: 'gray' },
  released: { label: 'Released', variant: 'gray' },
  on_hold: { label: 'On Hold', variant: 'yellow' },
  cancelled: { label: 'Cancelled', variant: 'red' },
}

const INITIAL_FORM = { name: '', status: 'development', description: '', start_date: '', end_date: '', budget: '', is_priority: false }

export function ProjectsClient({ projects, payments, liabilities, income, userId, role }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)

  const canCreate = role === 'founder'

  // Priority projects float to the top
  const sortedProjects = [...projects].sort(
    (a, b) => Number(b.is_priority ?? false) - Number(a.is_priority ?? false)
  )

  function plForProject(id: string) {
    // Only realized (received) income counts toward P&L; receivables are pending.
    const totalIncome = income.filter(i => i.project_id === id && (i.status ?? 'received') === 'received').reduce((s, i) => s + i.amount, 0)
    const spent = payments
      .filter(p => p.project_id === id && (p.approval_status === 'approved' || p.approval_status === 'paid'))
      .reduce((s, p) => s + p.amount, 0)
    const liabPaid = liabilities.filter(l => l.project_id === id).reduce((s, l) => s + l.amount_paid, 0)
    const liabOutstanding = liabilities
      .filter(l => l.project_id === id && l.status !== 'cleared')
      .reduce((s, l) => s + l.balance_remaining, 0)
    const totalCommitted = spent + liabPaid + liabOutstanding
    return { totalIncome, totalCommitted, net: totalIncome - totalCommitted }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const slug = form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const { data, error } = await supabase.from('projects').insert({
      name: form.name, slug, status: form.status,
      description: form.description || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: parseFloat(form.budget) || null,
      is_priority: form.is_priority,
      created_by: userId,
    }).select().single()
    if (error) { toast.error("Couldn't create project"); setSaving(false); return }
    if (data) await logAction('create', 'projects', data.id, undefined, data)
    toast.success('Project created')
    setSaving(false)
    setOpen(false)
    setForm(INITIAL_FORM)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="OPM Cinemas film projects — P&L per project"
        action={canCreate ? <Button icon={Plus} onClick={() => setOpen(true)}>New Project</Button> : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedProjects.map((project) => {
          const cfg = STATUS_CONFIG[project.status] ?? { label: project.status, variant: 'gray' as const }
          const { totalIncome, totalCommitted, net } = plForProject(project.id)
          const budget = project.budget ?? 0
          const budgetUsedPct = budget > 0 ? Math.min(Math.round((totalCommitted / budget) * 100), 100) : 0
          const budgetStatus = budgetUsedPct >= 100 ? 'red' : budgetUsedPct >= 80 ? 'yellow' : 'green'
          const hasFinancials = totalIncome > 0 || totalCommitted > 0

          return (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className={`bg-[#13131a] border rounded-2xl p-5 hover:bg-[#16161f] transition-all cursor-pointer group h-full flex flex-col ${project.is_priority ? 'border-amber-500/40 hover:border-amber-400/60' : 'border-[#2a2a3a] hover:border-white/30'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center group-hover:bg-white/15 transition-colors shrink-0">
                    <Clapperboard size={20} className="text-white/70" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {project.is_priority && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
                        <Star size={9} fill="currentColor" /> PRIORITY
                      </span>
                    )}
                    <StatusBadge label={cfg.label} variant={cfg.variant} />
                  </div>
                </div>

                <h3 className="text-base font-semibold text-white mb-1">{project.name}</h3>
                {project.description && (
                  <p className="text-xs text-[#8888aa] line-clamp-2 mb-3">{project.description}</p>
                )}

                {/* P&L mini summary */}
                {hasFinancials && (
                  <div className="mt-auto pt-3 border-t border-[#2a2a3a] space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-1 text-emerald-400"><TrendingUp size={11} /> Income</span>
                      <span className="text-emerald-400 font-semibold tabular-nums">{formatCurrency(totalIncome)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-1 text-red-400"><TrendingDown size={11} /> Committed</span>
                      <span className="text-red-400 font-semibold tabular-nums">{formatCurrency(totalCommitted)}</span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-[#2a2a3a] pt-2">
                      <span className="text-[#8888aa]">Net P&L</span>
                      <span className={`font-bold tabular-nums ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {net >= 0 ? '+' : ''}{formatCurrency(net)}
                      </span>
                    </div>
                    {budget > 0 && (
                      <ProgressBar value={totalCommitted} max={budget} status={budgetStatus} size="sm" showLabel={false} />
                    )}
                  </div>
                )}

                {!hasFinancials && (
                  <div className="mt-auto pt-2">
                    <div className="text-[11px] text-[#5a5a7a]">
                      {project.start_date ? `From ${formatDate(project.start_date)}` : 'No financial data yet'}
                    </div>
                  </div>
                )}
              </div>
            </Link>
          )
        })}

        {projects.length === 0 && (
          <div className="col-span-3 py-16 text-center text-[#8888aa] text-sm">
            No projects yet. {canCreate && 'Create your first project.'}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Project" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Project Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Rifle Club 2" />
          <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STATUS_OPTIONS} />
          <Textarea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            <Input label="End Date" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <MoneyInput label="Total Budget (₹)" value={form.budget} onChange={v => setForm({ ...form, budget: v })} />
          <label className="flex items-center gap-2 cursor-pointer text-sm text-white">
            <input
              type="checkbox"
              checked={form.is_priority}
              onChange={e => setForm({ ...form, is_priority: e.target.checked })}
              className="h-4 w-4 accent-amber-400 shrink-0"
            />
            <Star size={13} className="text-amber-400" /> Priority project
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Project</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
