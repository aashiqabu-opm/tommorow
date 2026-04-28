import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Clapperboard, FileText, CreditCard, AlertTriangle } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge, getDocumentStatusBadge, getPaymentStatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatDate, DOCUMENT_TYPE_LABELS } from '@/lib/utils'
import Link from 'next/link'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: project }, { data: documents }, { data: payments }, { data: liabilities }] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('payment_requests').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('liabilities').select('*').eq('project_id', id),
  ])

  if (!project) notFound()

  const totalLiabilities = (liabilities ?? []).reduce((s, l) => s + l.amount_owed, 0)
  const pendingPayments = (payments ?? []).filter(p => p.approval_status === 'pending').length
  const expiring = (documents ?? []).filter(d => {
    if (!d.expiry_date) return false
    const exp = new Date(d.expiry_date)
    const now = new Date()
    return exp > now && exp < new Date(now.getTime() + 30 * 86400000)
  })

  const STATUS_LABELS: Record<string, string> = {
    active: 'Active', development: 'Development', post_production: 'Post Production',
    released: 'Released', on_hold: 'On Hold', cancelled: 'Cancelled',
  }

  const STATUS_VARIANTS: Record<string, 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray'> = {
    active: 'green', development: 'blue', post_production: 'purple',
    released: 'gray', on_hold: 'yellow', cancelled: 'red',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center">
            <Clapperboard size={22} className="text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{project.name}</h1>
              <StatusBadge label={STATUS_LABELS[project.status] ?? project.status} variant={STATUS_VARIANTS[project.status] ?? 'gray'} size="md" />
            </div>
            {project.description && <p className="text-sm text-[#8888aa] mt-0.5">{project.description}</p>}
          </div>
        </div>
        <Link href="/projects" className="text-sm text-[#8888aa] hover:text-white">← Back</Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Documents" value={(documents ?? []).length} icon={FileText} status="default" />
        <StatCard title="Pending Payments" value={pendingPayments} icon={CreditCard} status={pendingPayments > 0 ? 'yellow' : 'green'} />
        <StatCard title="Total Liabilities" value={formatCurrency(totalLiabilities)} icon={AlertTriangle} status={totalLiabilities > 0 ? 'red' : 'green'} />
        <StatCard title="Expiring Docs" value={expiring.length} status={expiring.length > 0 ? 'yellow' : 'green'} subtitle="Within 30 days" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documents */}
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Documents</h3>
            <Link href="/documents" className="text-xs text-violet-400 hover:text-violet-300">View all</Link>
          </div>
          {(documents ?? []).length === 0 ? (
            <div className="py-8 text-center text-[#8888aa] text-sm">No documents</div>
          ) : (
            <div className="divide-y divide-[#2a2a3a]">
              {(documents ?? []).slice(0, 5).map(doc => {
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

        {/* Payment Requests */}
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Payment Requests</h3>
            <Link href="/payments" className="text-xs text-violet-400 hover:text-violet-300">View all</Link>
          </div>
          {(payments ?? []).length === 0 ? (
            <div className="py-8 text-center text-[#8888aa] text-sm">No payment requests</div>
          ) : (
            <div className="divide-y divide-[#2a2a3a]">
              {(payments ?? []).slice(0, 5).map(p => {
                const s = getPaymentStatusBadge(p.approval_status)
                return (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white">{p.payee}</div>
                      <div className="text-xs text-[#8888aa]">{p.purpose}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-white tabular-nums">{formatCurrency(p.amount)}</div>
                      <StatusBadge label={s.label} variant={s.variant} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Project details */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Project Details</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          {project.start_date && <div><div className="text-xs text-[#8888aa] mb-1">Start Date</div><div className="text-white">{formatDate(project.start_date)}</div></div>}
          {project.end_date && <div><div className="text-xs text-[#8888aa] mb-1">End Date</div><div className="text-white">{formatDate(project.end_date)}</div></div>}
          {project.budget && <div><div className="text-xs text-[#8888aa] mb-1">Budget</div><div className="text-white">{formatCurrency(project.budget)}</div></div>}
          <div><div className="text-xs text-[#8888aa] mb-1">Created</div><div className="text-white">{formatDate(project.created_at)}</div></div>
        </div>
      </div>
    </div>
  )
}
