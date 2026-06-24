import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth'
import { Wallet, Building2, AlertTriangle, Clock, FileWarning, FileX, Clapperboard, Landmark } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { BarChart } from '@/components/ui/BarChart'
import { formatCurrency, formatDate, paidPercent, cn } from '@/lib/utils'
import { fundingMetrics } from '@/lib/funding'
import { Watchlist } from './Watchlist'
import { AiReview } from './AiReview'
import type { ProjectFunding } from '@/lib/types'
import { Coins, Percent } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const profile = await requireProfile()
  const role = profile.role

  const isFinance = role === 'founder' || role === 'accountant'

  const sixMonthsAgo = new Date(new Date().setMonth(new Date().getMonth() - 6))
  const todayStr = new Date().toISOString().slice(0, 10)
  const in7Str = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const since90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)

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
    fundingResult,
    upcomingShootResult,
    payrollResult,
    paid90Result,
    income90Result,
  ] = await Promise.all([
    isFinance ? supabase.from('cash_entries').select('closing_cash').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(1) : Promise.resolve({ data: null }),
    isFinance ? supabase.from('liabilities').select('amount_owed, amount_paid, balance_remaining, status, priority, due_date') : Promise.resolve({ data: null }),
    supabase.from('payment_requests').select('approval_status, payment_status, amount').eq('approval_status', 'pending'),
    supabase.from('documents').select('status, expiry_date'),
    supabase.from('projects').select('id, name, status, is_priority'),
    isFinance ? supabase.from('bank_accounts').select('current_balance').eq('is_active', true) : Promise.resolve({ data: null }),
    isFinance ? supabase.from('payment_requests').select('created_at, amount').eq('approval_status', 'approved').gte('created_at', sixMonthsAgo.toISOString()) : Promise.resolve({ data: null }),
    isFinance ? supabase.from('project_income').select('income_date, amount').gte('income_date', sixMonthsAgo.toISOString().split('T')[0]) : Promise.resolve({ data: null }),
    isFinance ? supabase.from('project_funding').select('*, transactions:funding_transactions(*)').then(r => ({ data: r.data })) : Promise.resolve({ data: null }),
    // Shoot days in the next 7 days (all roles) — graceful if not migrated
    supabase.from('project_schedule').select('shoot_date, call_time, project:projects(name), location:locations(name)').gte('shoot_date', todayStr).lte('shoot_date', in7Str).order('shoot_date').then(r => ({ data: r.data })).then(r => r, () => ({ data: null })),
    isFinance ? supabase.from('staff_salaries').select('monthly_salary').eq('is_active', true) : Promise.resolve({ data: null }),
    isFinance ? supabase.from('payment_requests').select('amount, net_payable').eq('payment_status', 'paid').gte('paid_at', since90) : Promise.resolve({ data: null }),
    isFinance ? supabase.from('project_income').select('amount').eq('status', 'received').gte('income_date', since90) : Promise.resolve({ data: null }),
  ])

  const funding = (fundingResult.data ?? []) as ProjectFunding[]
  const totalCapital = funding.reduce((s, f) => s + Number(f.amount ?? 0), 0)
  const loanMonthlyInterest = funding
    .filter(f => f.kind === 'loan' && f.status === 'active')
    .reduce((s, f) => s + fundingMetrics(f).monthlyInterest, 0)

  const cashInHand = cashResult.data?.[0]?.closing_cash ?? 0
  const bankBalance = (bankAccountsResult.data ?? []).reduce((s, a) => s + (a.current_balance ?? 0), 0)
  const liabilities = liabilitiesResult.data ?? []
  const totalLiabilities = liabilities.reduce((s, l) => s + (l.amount_owed ?? 0), 0)
  const totalPaid = liabilities.reduce((s, l) => s + (l.amount_paid ?? 0), 0)
  const outstanding = liabilities
    .filter(l => l.status !== 'cleared')
    .reduce((s, l) => s + ((l.amount_owed ?? 0) - (l.amount_paid ?? 0)), 0)
  const pendingApprovals = paymentRequestsResult.data?.length ?? 0
  const pendingApprovalTotal = (paymentRequestsResult.data ?? []).reduce((s, p) => s + Number((p as { amount?: number }).amount ?? 0), 0)

  // "First eyeball" signals
  const available = Number(cashInHand) + Number(bankBalance)
  const monthlyPayroll = (payrollResult.data ?? []).reduce((s, p) => s + Number(p.monthly_salary ?? 0), 0)
  const paid90 = (paid90Result.data ?? []).reduce((s, p) => s + Number((p as { net_payable?: number; amount?: number }).net_payable ?? (p as { amount?: number }).amount ?? 0), 0)
  const income90 = (income90Result.data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)
  const monthlyBurn = Math.max(0, monthlyPayroll + (paid90 / 3))
  const runwayWeeks = monthlyBurn > 0 ? Math.round((available / monthlyBurn) * 4.33) : null
  type ShootRow = { shoot_date: string; call_time?: string | null; project?: { name?: string } | null; location?: { name?: string } | null }
  const upcomingShoot = (upcomingShootResult.data ?? []) as ShootRow[]

  const today = new Date()
  const in30 = new Date(today.getTime() + 30 * 86400000)
  const documents = documentsResult.data ?? []
  const expiringDocs = documents.filter(d => d.expiry_date && new Date(d.expiry_date) <= in30 && new Date(d.expiry_date) >= today)
  const missingDocTypes = 5 // simplified placeholder

  const urgentLiabilities = liabilities.filter(l => l.priority === 'urgent' && l.status !== 'cleared')
  const projects = (projectsResult.data ?? []).sort(
    (a, b) => Number(b.is_priority ?? false) - Number(a.is_priority ?? false)
  )

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
      .reduce((s, p) => s + Number(p.amount ?? 0), 0)
    return { label: m.label, value: total }
  })

  const incomeByMonth = months.map(m => {
    const total = (monthlyIncome ?? [])
      .filter(p => {
        const d = new Date(p.income_date)
        return d.getFullYear() === m.year && d.getMonth() === m.month
      })
      .reduce((s, p) => s + Number(p.amount ?? 0), 0)
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
        <h1 className="text-xl font-bold text-white">Hi {(profile.full_name as string)?.split(' ')[0] ?? 'there'} 👋</h1>
        <p className="text-sm text-[#8888aa] mt-0.5">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} — here's what needs you.</p>
      </div>

      {/* HEADLINE — first eyeball */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isFinance ? (
          <>
            <HeroTile label="Available now" value={formatCurrency(available)} status={available > 500000 ? 'green' : available > 100000 ? 'yellow' : 'red'} sub="Cash + bank" />
            <HeroTile label="Cash runway" value={runwayWeeks === null ? '∞' : `${runwayWeeks} wk`} status={runwayWeeks === null ? 'green' : runwayWeeks <= 4 ? 'red' : runwayWeeks <= 8 ? 'yellow' : 'green'} sub={`Burn ${formatCurrency(Math.round(monthlyBurn))}/mo`} />
            <HeroTile label="Approvals pending" value={String(pendingApprovals)} status={pendingApprovals === 0 ? 'green' : pendingApprovals > 5 ? 'red' : 'yellow'} sub={pendingApprovalTotal ? formatCurrency(pendingApprovalTotal) : 'all clear'} href="/payments" />
            <HeroTile label="Shoot this week" value={String(upcomingShoot.length)} status="default" sub={upcomingShoot.filter(s => s.shoot_date === todayStr).length ? 'shooting today' : 'next 7 days'} href="/projects" />
          </>
        ) : (
          <>
            <HeroTile label="Active films" value={String(projects.filter(p => p.status === 'active').length)} status="default" sub="In production" href="/projects" />
            <HeroTile label="Shoot this week" value={String(upcomingShoot.length)} status="default" sub={upcomingShoot.filter(s => s.shoot_date === todayStr).length ? 'shooting today' : 'next 7 days'} href="/projects" />
            <HeroTile label="Approvals pending" value={String(pendingApprovals)} status={pendingApprovals === 0 ? 'green' : 'yellow'} sub="Payment requests" href="/payments" />
            <HeroTile label="Expiring agreements" value={String(expiringDocs.length)} status={expiringDocs.length === 0 ? 'green' : 'yellow'} sub="Within 30 days" href="/documents" />
          </>
        )}
      </div>

      {/* NEEDS YOU NOW + SHOOT THIS WEEK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-xl p-4">
          <h2 className="text-xs font-semibold text-[#8888aa] uppercase tracking-wider mb-3">Needs you now</h2>
          {(() => {
            const items: { text: string; href: string; tone: string }[] = []
            if (pendingApprovals > 0) items.push({ text: `${pendingApprovals} payment ${pendingApprovals === 1 ? 'request' : 'requests'} to approve${pendingApprovalTotal ? ` (${formatCurrency(pendingApprovalTotal)})` : ''}`, href: '/payments', tone: 'amber' })
            if (isFinance && urgentLiabilities.length) items.push({ text: `${urgentLiabilities.length} urgent due${urgentLiabilities.length === 1 ? '' : 's'}`, href: '/liabilities', tone: 'red' })
            if (isFinance && runwayWeeks !== null && runwayWeeks <= 8) items.push({ text: `Cash runway ~${runwayWeeks} weeks at current burn`, href: '/forecast', tone: runwayWeeks <= 4 ? 'red' : 'amber' })
            if (expiringDocs.length) items.push({ text: `${expiringDocs.length} agreement${expiringDocs.length === 1 ? '' : 's'} expiring in 30 days`, href: '/documents', tone: 'amber' })
            if (!items.length) return <p className="text-sm text-emerald-300">All clear — nothing pressing right now. ✅</p>
            return <div className="space-y-2">{items.map((it, i) => (
              <Link key={i} href={it.href} className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2.5 hover:border-white/20">
                <span className="text-sm text-white/90">{it.text}</span>
                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${it.tone === 'red' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300'}`}>{it.tone === 'red' ? 'urgent' : 'review'}</span>
              </Link>
            ))}</div>
          })()}
        </div>
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-xl p-4">
          <h2 className="text-xs font-semibold text-[#8888aa] uppercase tracking-wider mb-3">Shoot this week</h2>
          {upcomingShoot.length === 0 ? <p className="text-sm text-[#8888aa]">No shoot days scheduled in the next 7 days.</p> : (
            <div className="space-y-2">{upcomingShoot.slice(0, 6).map((s, i) => (
              <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 ${s.shoot_date === todayStr ? 'bg-[#D6B16F]/10 border border-[#D6B16F]/30' : 'bg-[#1a1a24] border border-[#2a2a3a]'}`}>
                <div className="text-sm text-white">{s.project?.name ?? 'Film'} <span className="text-[#8888aa]">· {s.location?.name ?? '—'}</span></div>
                <div className="text-xs text-[#8888aa]">{s.shoot_date === todayStr ? 'TODAY' : formatDate(s.shoot_date)}{s.call_time ? ` · ${s.call_time}` : ''}</div>
              </div>
            ))}</div>
          )}
        </div>
      </div>

      {/* Proactive watchlist + on-demand AI review — finance only */}
      {isFinance && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Watchlist />
          <AiReview />
        </div>
      )}

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
          {funding.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              <StatCard
                title="Capital Deployed"
                value={formatCurrency(totalCapital)}
                icon={Coins}
                status="default"
                subtitle={`${funding.length} funding source${funding.length === 1 ? '' : 's'}`}
              />
              <StatCard
                title="Loan Interest / mo"
                value={formatCurrency(loanMonthlyInterest)}
                icon={Percent}
                status={loanMonthlyInterest > 0 ? 'yellow' : 'green'}
                subtitle="Across active loans"
              />
            </div>
          )}
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

function ProjectCard({ project }: { project: { id: string; name: string; status: string; is_priority?: boolean } }) {
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
      <div className={cn(
        'bg-[#13131a] border rounded-2xl p-5 hover:bg-[#16161f] transition-all cursor-pointer',
        project.is_priority ? 'border-amber-500/40 hover:border-amber-400/60' : 'border-[#2a2a3a] hover:border-white/30'
      )}>
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
            <Clapperboard size={18} className="text-white/70" />
          </div>
          <div className="flex items-center gap-2">
            {project.is_priority && (
              <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">★ PRIORITY</span>
            )}
            <div className={cn('flex items-center gap-1.5 text-xs font-medium', statusConfig.color)}>
              <div className={cn('w-1.5 h-1.5 rounded-full', statusConfig.dot)} />
              {statusConfig.label}
            </div>
          </div>
        </div>
        <h3 className="text-sm font-semibold text-white">{project.name}</h3>
      </div>
    </Link>
  )
}

function HeroTile({ label, value, status, sub, href }: { label: string; value: string; status: 'green' | 'yellow' | 'red' | 'default'; sub?: string; href?: string }) {
  const ring = status === 'green' ? 'border-emerald-500/25' : status === 'yellow' ? 'border-amber-500/25' : status === 'red' ? 'border-red-500/30' : 'border-[#2a2a3a]'
  const val = status === 'green' ? 'text-emerald-300' : status === 'yellow' ? 'text-amber-300' : status === 'red' ? 'text-red-300' : 'text-white'
  const inner = (
    <div className={`bg-gradient-to-br from-[#1a1a24] to-[#13131a] border ${ring} rounded-2xl p-4 h-full ${href ? 'hover:border-white/25 transition-colors' : ''}`}>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#8888aa]">{label}</div>
      <div className={`text-2xl lg:text-3xl font-bold mt-1.5 ${val}`}>{value}</div>
      {sub && <div className="text-xs text-[#8888aa] mt-1">{sub}</div>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}
