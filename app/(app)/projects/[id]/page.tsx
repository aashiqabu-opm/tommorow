import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { ProjectDetailClient } from './ProjectDetailClient'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const profile = await requireProfile()

  const [
    { data: project },
    { data: documents },
    { data: payments },
    { data: liabilities },
    { data: income },
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('payment_requests').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('liabilities').select('*').eq('project_id', id),
    supabase.from('project_income').select('*').eq('project_id', id).order('income_date', { ascending: false }),
  ])

  if (!project) notFound()

  return (
    <ProjectDetailClient
      project={project}
      documents={documents ?? []}
      payments={payments ?? []}
      liabilities={liabilities ?? []}
      income={income ?? []}
      userId={profile.id}
      role={profile.role}
    />
  )
}
