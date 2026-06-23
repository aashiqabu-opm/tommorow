import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { ReceivablesClient, type Deal, type Encumbrance } from '../ReceivablesClient'

export const dynamic = 'force-dynamic'

// Receivables + encumbrances — money coming in, and how much of it is already
// claimed by creditors. Management view; encumbrance edits are finance-only.
export default async function ReceivablesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireProfile()
  if (!['founder', 'accountant', 'general_manager', 'executive_producer'].includes(profile.role)) redirect(`/projects/${id}`)
  const isFinance = ['founder', 'accountant'].includes(profile.role)

  const supabase = await createClient()
  const [{ data: project }, { data: deals }, { data: encumbrances }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', id).single(),
    supabase.from('project_deals').select('id, kind, counterparty, territory, mg_amount, total_value, received_amount, received_date, expected_date, status').eq('project_id', id).order('created_at', { ascending: true }),
    supabase.from('receivable_encumbrances').select('*').eq('project_id', id).order('created_at', { ascending: false }),
  ])
  if (!project) notFound()

  return (
    <div className="max-w-5xl mx-auto">
      <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-xs text-[#8888aa] hover:text-white mb-4">
        <ArrowLeft size={13} /> Back to project
      </Link>
      <PageHeader title={`${project.name} — Receivables`} subtitle="Money coming in vs money already claimed by creditors. Free receivable = outstanding − active encumbrances." />
      <ReceivablesClient
        projectId={id}
        deals={(deals ?? []) as Deal[]}
        encumbrances={(encumbrances ?? []) as Encumbrance[]}
        userId={profile.id}
        isFinance={isFinance}
        isFounder={profile.role === 'founder'}
      />
    </div>
  )
}
