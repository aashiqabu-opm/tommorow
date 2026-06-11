import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProjectsClient } from './ProjectsClient'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  // Fetch P&L summary per project
  const projectIds = (projects ?? []).map(p => p.id)
  const [{ data: payments }, { data: liabilities }, { data: income }] = projectIds.length
    ? await Promise.all([
        supabase.from('payment_requests').select('project_id, amount, approval_status').in('project_id', projectIds),
        supabase.from('liabilities').select('project_id, amount_owed, amount_paid, balance_remaining, status').in('project_id', projectIds),
        supabase.from('project_income').select('project_id, amount').in('project_id', projectIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  return (
    <ProjectsClient
      projects={projects ?? []}
      payments={payments ?? []}
      liabilities={liabilities ?? []}
      income={income ?? []}
      userId={user.id}
      role={profile?.role ?? ''}
    />
  )
}
