import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { CrewOnboardingClient, type Onboarding } from '../CrewOnboardingClient'

export const dynamic = 'force-dynamic'

// Crew onboarding + consent. Management roles; founder deletes.
export default async function CrewOnboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireProfile()
  if (!['founder', 'accountant', 'general_manager', 'executive_producer'].includes(profile.role)) redirect(`/projects/${id}`)

  const supabase = await createClient()
  const [{ data: project }, { data: rows }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', id).single(),
    supabase.from('crew_onboarding')
      .select('*, consents:crew_consents(id, consent_type, granted, granted_at, method)')
      .eq('project_id', id).order('created_at', { ascending: false }),
  ])
  if (!project) notFound()

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-xs text-[#8888aa] hover:text-white mb-4">
        <ArrowLeft size={13} /> Back to project
      </Link>
      <PageHeader title={`${project.name} — Crew Onboarding`} subtitle="Sign → consent → check-in, one record per crew member. Consent is an immutable, timestamped log." />
      <CrewOnboardingClient
        projectId={id}
        rows={(rows ?? []) as Onboarding[]}
        userId={profile.id}
        canManage={true}
        canDelete={profile.role === 'founder'}
      />
    </div>
  )
}
