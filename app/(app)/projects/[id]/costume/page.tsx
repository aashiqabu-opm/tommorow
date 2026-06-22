import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { CostumeClient, type CostumeLook } from '../CostumeClient'

export const dynamic = 'force-dynamic'

// Costume readiness — per-look fabrication pipeline. Management roles; founder deletes.
export default async function CostumePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireProfile()
  if (!['founder', 'accountant', 'general_manager', 'executive_producer'].includes(profile.role)) redirect(`/projects/${id}`)

  const supabase = await createClient()
  const [{ data: project }, { data: rows }] = await Promise.all([
    supabase.from('projects').select('id, name, start_date').eq('id', id).single(),
    supabase.from('costume_looks').select('*').eq('project_id', id).order('look_number', { ascending: true, nullsFirst: false }),
  ])
  if (!project) notFound()

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-xs text-[#8888aa] hover:text-white mb-4">
        <ArrowLeft size={13} /> Back to project
      </Link>
      <PageHeader title={`${project.name} — Costume Readiness`} subtitle="Each character look from research to ready. % complete vs days-to-shoot, so nothing's unfinished on Day 1." />
      <CostumeClient
        projectId={id}
        rows={(rows ?? []) as CostumeLook[]}
        shootStart={project.start_date ?? null}
        userId={profile.id}
        canManage={true}
        canDelete={profile.role === 'founder'}
      />
    </div>
  )
}
