import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth'
import { Wallet, Building2, AlertTriangle, Clock, FileWarning, FileX, Clapperboard, Landmark } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { BarChart } from '@/components/ui/BarChart'
import { formatCurrency, formatDate, paidPercent, cn } from '@/lib/utils'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const profile = await requireProfile()
  const role = profile.role

  const isFinance = role === 'founder' || role === 'accountant'

  const sixMonthsAgo = new Date(new Date().setMonth(new Date().getMonth() - 6))

  // Fetch everything in one parallel wave — including the monthly chart data,
  // which previously ran as two extra sequential round-trips after this batch.
  const [
    cashResult,
    liabilitiesResult,
    paymentRequestsResult,
    documentsResult,
    projectsResult,
    bankAccountsResult,
    monthlySpendResult,
    monthlyIncomeResult,
  ] = await Promise.all([
    isFinance ? supabase.from('cash_entries').select('closing_cash').order('entry_date', { ascending: false }).limit(1) : Promise.resolve({ data: null }),
    isFinance ? supabase.from('liabilities').select('amount_owed, amount_paid, balance_remaining, status, priority, due_date') : Promise.resolve({ data: null }),
    supabase.from('payment_requests').select('approval_status, payment_status').eq('approval_status', 'pending'),
    supabase.from('documents').select('status, expiry_date'),
    supabase.from('projects').select('id, name, status'),
    isFinance ? supabase.from('bank_accounts').select('current_balance').eq('is_active', true) : Promise.resolve({ data: null }),
    isFinance ? supabase.from('payment_requests').select('created_at, amount').eq('approval_status', 'approved').gte('created_at', sixMonthsAgo.toISOString()) : Promise.resolve({ data: null }),
    isFinance ? supabase.from('project_income').select('income_date, amount').gte('income_date', sixMonthsAgo.toISOString().split('T')[0]) : Promise.resolve({ data: null }),
  ])

  const cashInHand = cashResult.data?.[0]?.closing_cash ?? 0
  const bankBalance = (bankAccountsResult.data ?? []).reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const liabilities = liabilitiesResult.data ?? []
  const totalLiabilities = liabilities.reduce((s, l) => s + (l.amount_owed ?? 0), 0)
  const totalPaid = liabilities.reduce((s, l) => s + (l.amount_paid ?? 0), 0)
  const outstanding = liabilities
    .filter(l => l.status !== 'cleared')
    .reduce((s, l) => s + (l.balance_remaining ?? 0), 0)
  const pendingApprovals = paymentRequestsResult.data?.length ?? 0

  const today = new Date()
  const in30 = new Date(today.getTime() + 30 * 86400000)
  const documents = documentsResult.data ?? []
  const expiringDocs = documents.filter(d => d.expiry_date && new Date(d.expiry_date) <= in30 && new Date(d.expiry_date) >= today)
  const missingDocTypes = 5 // simplified placeholder

  const urgentLiabilities = liabilities.filter(l => l.priority === 'urgent' && l.status !== 'cleared')
  const projects = projectsResult.data ?? []

  const monthlySpend = monthlySpendResult.data
  const monthlyIncome = monthlyIncomeResult.data

  // Build last 6 months labels and data
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    return {
      label: d.toLocaleString('en-IN', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    }
  })

  const spendByMonth = months.map(m => {
    const total = (monthlySpend ?? [])
      .filter(p => {
        const d = new Date(p.created_at)
        return d.getFullYear() === m.year && d.getMonth() === m.month
      })
      .reduce((s, p) => s + (p.amount ?? 0), 0)
    return { label: m.label, value: total }
  })

  const incomeByMonth = months.map(m => {
    const total = (monthlyIncome ?? [])
      .filter(p => {
        const d = new Date(p.income_date)
        return d.getFullYear() === m.year && d.getMonth() === m.month
      })
      .reduce((s, p) => s + (p.amount ?? 0), 0)
    return { label: m.label, value: total }
  })

  const dualChartData = months.map((m, i) => ({
    label: m.label,
    value: spendByMonth[i].value,
    value2: incomeByMonth[i].value,
  }))

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-white">Company Overview</h1>
        <p className="text-sm text-[#8888aa] mt-0.5">Everything at a glance</p>
      </div>

      {/* Finance Stats — Founder/Accountant only */}
      {isFinance && (
        <section>
          <h2 className="text-xs font-semibold text-[#8888aa] uppercase tracking-wider mb-3">Finance</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Cash in Hand"
              value={formatCurrency(cashInHand)}
              icon={Wallet}
              status={cashInHand > 500000 ? 'green' : cashInHand > 100000 ? 'yellow' : 'red'}
              subtitle="Latest closing balance"
            />
            <StatCard
              title="Bank Balance"
              value={formatCurrency(bankBalance)}
              icon={Landmark}
              status={bankBalance > 500000 ? 'green' : bankBalance > 100000 ? 'yellow' : 'red'}
              subtitle="Sum of active accounts"
            />
            <StatCard
              title="Outstanding Liabilities"
              value={formatCurrency(outstanding)}
              icon={AlertTriangle}
              status={outstanding === 0 ? 'green' : outstanding > 2000000 ? 'red' : 'yellow'}
              subtitle={`of ${formatCurrency(totalLiabilities)} total owed`}
            />
            <StatCard
              title="Urgent Dues"
              value={urgentLiabilities.length}
              icon={Clock}
              status={urgentLiabilities.length === 0 ? 'green' : 'red'}
              subtitle="Require immediate action"
            />
          </div>
        </section>
      )}

      {/* Operations Stats */}
      <section>
        <h2 className="text-xs font-semibold text-[#8888aa] uppercase tracking-wider mb-3">Operations</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard
            title="Pending Approvals"
            value={pendingApprovals}
            icon={Clock}
            status={pendingApprovals === 0 ? 'green' : pendingApprovals > 5 ? 'red' : 'yellow'}
            subtitle="Payment requests awaiting"
          />
          <StatCard
            title="Expiring Agreements"
            value={expiringDocs.length}
            icon={FileWarning}
            status={expiringDocs.length === 0 ? 'green' : expiringDocs.length > 3 ? 'red' : 'yellow'}
            subtitle="Expiring within 30 days"
          />
          <StatCard
            title="Active Projects"
            value={projects.filter(p => p.status === 'active').length}
            icon={Clapperboard}
            status="default"
            subtitle={`${projects.length} total projects`}
          />
        </div>
      </section>

      {/* Projects Grid */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-[#8888aa] uppercase tracking-wider">Projects</h2>
          <Link href="/projects" className="text-xs text-white/70 hover:text-white">View all</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.slice(0, 6).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {projects.length === 0 && (
            <div className="col-span-3 text-center py-10 text-[#8888aa] text-sm">
              No projects yet
            </div>
          )}
        </div>
      </section>

      {/* Liability Progress — Finance only */}
      {isFinance && liabilities.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-[#8888aa] uppercase tracking-wider">Liability Tracker</h2>
            <Link href="/liabilities" className="text-xs text-white/70 hover:text-white">Manage</Link>
          </div>
          <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl divide-y divide-[#2a2a3a]">
            {liabilities.slice(0, 5).map((lib, i) => {
              const pct = paidPercent(lib.amount_paid ?? 0, lib.amount_owed ?? 0)
              return (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{formatCurrency(lib.amount_owed)}</span>
                      <StatusBadge
                        label={lib.priority}
                        variant={lib.priority === 'urgent' ? 'red' : lib.priority === 'normal' ? 'yellow' : 'gray'}
                      />
                    </div>
                    <span className="text-xs text-[#8888aa]">{pct}% paid</span>
                  </div>
                  <ProgressBar value={lib.amount_paid ?? 0} max={lib.amount_owed ?? 1} showLabel={false} />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Monthly Charts — Finance only */}
      {isFinance && (
        <section>
          <h2 className="text-xs font-semibold text-[#8888aa] uppercase tracking-wider mb-3">Monthly Trends</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
              <div className="text-sm font-semibold text-white mb-4">Monthly Spend</div>
              <BarChart
                data={spendByMonth}
                label1="Spend"
                formatValue={(v) => `₹${Math.round(v / 1000)}K`}
                height={120}
              />
            </div>
            <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
              <div className="text-sm font-semibold text-white mb-4">Income vs Expenses</div>
              <BarChart
                data={dualChartData}
                label1="Expenses"
                label2="Income"
                formatValue={(v) => `₹${Math.round(v / 1000)}K`}
                height={120}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: { id: string; name: string; status: string } }) {
  const statusConfig = {
    active: { label: 'Active', color: 'text-emerald-400', dot: 'bg-emerald-400' },
    development: { label: 'Development', color: 'text-gray-300', dot: 'bg-gray-300' },
    post_production: { label: 'Post Production', color: 'text-gray-300', dot: 'bg-gray-400' },
    released: { label: 'Released', color: 'text-gray-400', dot: 'bg-gray-400' },
    on_hold: { label: 'On Hold', color: 'text-amber-400', dot: 'bg-amber-400' },
    cancelled: { label: 'Cancelled', color: 'text-red-400', dot: 'bg-red-400' },
  }[project.status] ?? { label: project.status, color: 'text-gray-400', dot: 'bg-gray-400' }

  return (
    <Link href={`/projects/${project.id}`}>
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 hover:border-white/30 hover:bg-[#16161f] transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
            <Clapperboard size={18} className="text-white/70" />
          </div>
          <div className={cn('flex items-center gap-1.5 text-xs font-medium', statusConfig.color)}>
            <div className={cn('w-1.5 h-1.5 rounded-full', statusConfig.dot)} />
            {statusConfig.label}
          </div>
        </div>
        <h3 className="text-sm font-semibold text-white">{project.name}</h3>
      </div>
    </Link>
  )
}
