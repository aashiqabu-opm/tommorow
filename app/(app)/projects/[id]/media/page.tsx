import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { MediaAssetsClient, type MediaAsset } from '../MediaAssetsClient'

export const dynamic = 'force-dynamic'

// Media asset register — drives/cards/cloud/archive. Management roles; founder deletes.
export default async function MediaAssetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireProfile()
  if (!['founder', 'accountant', 'general_manager', 'executive_producer'].includes(profile.role)) redirect(`/projects/${id}`)

  const supabase = await createClient()
  const [{ data: project }, { data: rows }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', id).single(),
    supabase.from('media_assets').select('*').eq('project_id', id).order('created_at', { ascending: false }),
  ])
  if (!project) notFound()

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-xs text-[#8888aa] hover:text-white mb-4">
        <ArrowLeft size={13} /> Back to project
      </Link>
      <PageHeader title={`${project.name} — Media Assets`} subtitle="Drives, cards, cloud and archive register. Import the DIT log instead of scanning hundreds of cards by hand." />
      <MediaAssetsClient
        projectId={id}
        rows={(rows ?? []) as MediaAsset[]}
        userId={profile.id}
        canManage={true}
        canDelete={profile.role === 'founder'}
      />
    </div>
  )
}
