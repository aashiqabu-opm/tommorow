import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { ProjectDetailClient } from './ProjectDetailClient'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const profile = await requireProfile()

  const isFinance = ['founder', 'accountant'].includes(profile.role)

  const [
    { data: project },
    { data: documents },
    { data: payments },
    { data: liabilities },
    { data: income },
    funding,
    budgetLines,
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('payment_requests').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('liabilities').select('*').eq('project_id', id),
    supabase.from('project_income').select('*').eq('project_id', id).order('income_date', { ascending: false }),
    // Finance-only; gracefully empty if the table isn't migrated yet
    isFinance
      ? supabase.from('project_funding')
          .select('*, transactions:funding_transactions(*)')
          .eq('project_id', id)
          .order('created_at', { ascending: true })
          .order('txn_date', { referencedTable: 'funding_transactions', ascending: false })
          .then(r => r.data ?? [])
      : Promise.resolve([]),
    isFinance
      ? supabase.from('budget_lines').select('*').eq('project_id', id).order('sort_order', { ascending: true }).then(r => r.data ?? [])
      : Promise.resolve([]),
  ])

  if (!project) notFound()

  return (
    <ProjectDetailClient
      project={project}
      documents={documents ?? []}
      payments={payments ?? []}
      liabilities={liabilities ?? []}
      income={income ?? []}
      funding={funding ?? []}
      budgetLines={budgetLines ?? []}
      userId={profile.id}
      role={profile.role}
    />
  )
}
