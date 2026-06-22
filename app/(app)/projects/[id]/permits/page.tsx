import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { PermitsClient, type Permit } from '../PermitsClient'

export const dynamic = 'force-dynamic'

// Permit application tracker. Management roles; founder deletes.
export default async function PermitsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireProfile()
  if (!['founder', 'accountant', 'general_manager', 'executive_producer'].includes(profile.role)) redirect(`/projects/${id}`)

  const supabase = await createClient()
  const [{ data: project }, { data: rows }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', id).single(),
    supabase.from('permits').select('*').eq('project_id', id).order('valid_to', { ascending: true, nullsFirst: false }),
  ])
  if (!project) notFound()

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-xs text-[#8888aa] hover:text-white mb-4">
        <ArrowLeft size={13} /> Back to project
      </Link>
      <PageHeader title={`${project.name} — Permits`} subtitle="KSFDC, Forest, Police, Fire, AWBI and more — applied → approved, with legal-gate flags that block shoot days when missing." />
      <PermitsClient
        projectId={id}
        rows={(rows ?? []) as Permit[]}
        userId={profile.id}
        canManage={true}
        canDelete={profile.role === 'founder'}
      />
    </div>
  )
}
