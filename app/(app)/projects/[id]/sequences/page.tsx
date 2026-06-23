import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { SequencesClient, type Stunt, type Animal, type Song, type Equipment } from '../SequencesClient'

export const dynamic = 'force-dynamic'

// Special sequences — safety/legal gates. Management roles; founder deletes.
export default async function SequencesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireProfile()
  if (!['founder', 'accountant', 'general_manager', 'executive_producer'].includes(profile.role)) redirect(`/projects/${id}`)

  const supabase = await createClient()
  const [{ data: project }, { data: stunts }, { data: animals }, { data: songs }, { data: equipment }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', id).single(),
    supabase.from('stunt_sequences').select('*').eq('project_id', id).order('shoot_date', { ascending: true, nullsFirst: false }),
    supabase.from('animal_usage').select('*').eq('project_id', id).order('shoot_date', { ascending: true, nullsFirst: false }),
    supabase.from('song_sequences').select('*').eq('project_id', id).order('shoot_date', { ascending: true, nullsFirst: false }),
    supabase.from('special_equipment').select('*').eq('project_id', id).order('created_at', { ascending: false }),
  ])
  if (!project) notFound()

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-xs text-[#8888aa] hover:text-white mb-4">
        <ArrowLeft size={13} /> Back to project
      </Link>
      <PageHeader title={`${project.name} — Special Sequences`} subtitle="Action and animal days with hard safety/legal gates. A blocked sequence cannot be shot until every condition is met." />
      <SequencesClient
        projectId={id}
        stunts={(stunts ?? []) as Stunt[]}
        animals={(animals ?? []) as Animal[]}
        songs={(songs ?? []) as Song[]}
        equipment={(equipment ?? []) as Equipment[]}
        userId={profile.id}
        canManage={true}
        canDelete={profile.role === 'founder'}
      />
    </div>
  )
}
