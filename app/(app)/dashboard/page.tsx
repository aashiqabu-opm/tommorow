import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Wallet, Building2, AlertTriangle, Clock, FileWarning, FileX, Clapperboard } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDate, paidPercent, cn } from '@/lib/utils'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role

  const isFinance = role === 'founder' || role === 'accountant'

  // Fetch data in parallel
  const [
    cashResult,
    liabilitiesResult,
    paymentRequestsResult,
    documentsResult,
    projectsResult,
  ] = await Promise.all([
    isFinance ? supabase.from('cash_entries').select('closing_cash').order('entry_date', { ascending: false }).limit(1) : Promise.resolve({ data: null }),
    isFinance ? supabase.from('liabilities').select('amount_owed, amount_paid, balance_remaining, status, priority, due_date') : Promise.resolve({ data: null }),
    supabase.from('payment_requests').select('approval_status, payment_status').eq('approval_status', 'pending'),
    supabase.from('documents').select('status, expiry_date'),
    supabase.from('projects').select('id, name, status'),
  ])

  const cashInHand = cashResult.data?.[0]?.closing_cash ?? 0
  const liabilities = liabilitiesResult.data ?? []
  const totalLiabilities = liabilities.reduce((s, l) => s + (l.amount_owed ?? 0), 0)
  const totalPaid = liabilities.reduce((s, l) => s + (l.amount_paid ?? 0), 0)
  const pendingApprovals = paymentRequestsResult.data?.length ?? 0

  const today = new Date()
  const in30 = new Date(today.getTime() + 30 * 86400000)
  const documents = documentsResult.data ?? []
  const expiringDocs = documents.filter(d => d.expiry_date && new Date(d.expiry_date) <= in30 && new Date(d.expiry_date) >= today)
  const missingDocTypes = 5 // simplified placeholder

  const urgentLiabilities = liabilities.filter(l => l.priority === 'urgent' && l.status !== 'cleared')
  const projects = projectsResult.data ?? []

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
              title="Total Liabilities"
              value={formatCurrency(totalLiabilities)}
              icon={AlertTriangle}
              status={totalLiabilities === 0 ? 'green' : totalLiabilities > 2000000 ? 'red' : 'yellow'}
              subtitle={`${paidPercent(totalPaid, totalLiabilities)}% paid`}
            />
            <StatCard
              title="Urgent Dues"
              value={urgentLiabilities.length}
              icon={Clock}
              status={urgentLiabilities.length === 0 ? 'green' : 'red'}
              subtitle="Require immediate action"
            />
            <StatCard
              title="Paid Liabilities"
              value={`${paidPercent(totalPaid, totalLiabilities)}%`}
              icon={Building2}
              status={paidPercent(totalPaid, totalLiabilities) >= 80 ? 'green' : paidPercent(totalPaid, totalLiabilities) >= 40 ? 'yellow' : 'red'}
              subtitle={`${formatCurrency(totalPaid)} of ${formatCurrency(totalLiabilities)}`}
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
          <Link href="/projects" className="text-xs text-violet-400 hover:text-violet-300">View all</Link>
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
            <Link href="/liabilities" className="text-xs text-violet-400 hover:text-violet-300">Manage</Link>
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
    </div>
  )
}

function ProjectCard({ project }: { project: { id: string; name: string; status: string } }) {
  const statusConfig = {
    active: { label: 'Active', color: 'text-emerald-400', dot: 'bg-emerald-400' },
    development: { label: 'Development', color: 'text-blue-400', dot: 'bg-blue-400' },
    post_production: { label: 'Post Production', color: 'text-violet-400', dot: 'bg-violet-400' },
    released: { label: 'Released', color: 'text-gray-400', dot: 'bg-gray-400' },
    on_hold: { label: 'On Hold', color: 'text-amber-400', dot: 'bg-amber-400' },
    cancelled: { label: 'Cancelled', color: 'text-red-400', dot: 'bg-red-400' },
  }[project.status] ?? { label: project.status, color: 'text-gray-400', dot: 'bg-gray-400' }

  return (
    <Link href={`/projects/${project.id}`}>
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 hover:border-violet-500/30 hover:bg-[#16161f] transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
            <Clapperboard size={18} className="text-violet-400" />
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
