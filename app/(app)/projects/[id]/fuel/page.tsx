import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { FuelClient, type FuelEstimate } from '../FuelClient'

export const dynamic = 'force-dynamic'

// Fuel estimates — vehicle per-km, generator per-hour. Management; founder deletes.
export default async function FuelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireProfile()
  if (!['founder', 'accountant', 'general_manager', 'executive_producer'].includes(profile.role)) redirect(`/projects/${id}`)

  const supabase = await createClient()
  const [{ data: project }, { data: rows }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', id).single(),
    supabase.from('fuel_estimates').select('*').eq('project_id', id).order('source_type').order('label'),
  ])
  if (!project) notFound()

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-xs text-[#8888aa] hover:text-white mb-4">
        <ArrowLeft size={13} /> Back to project
      </Link>
      <PageHeader title={`${project.name} — Fuel Estimates`} subtitle="Forecast fuel for vehicles (per km) and generators (per hour). Actual fuel spend is tracked in vehicle logs and the budget." />
      <FuelClient
        projectId={id}
        rows={(rows ?? []) as FuelEstimate[]}
        userId={profile.id}
        canManage={true}
        canDelete={profile.role === 'founder'}
      />
    </div>
  )
}
