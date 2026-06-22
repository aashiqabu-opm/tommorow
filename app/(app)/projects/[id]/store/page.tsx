import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { StoreClient, type StoreItem } from '../StoreClient'

export const dynamic = 'force-dynamic'

// Store & inventory — dept-wise stock with perishable flag. Management; founder deletes.
export default async function StorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireProfile()
  if (!['founder', 'accountant', 'general_manager', 'executive_producer'].includes(profile.role)) redirect(`/projects/${id}`)

  const supabase = await createClient()
  const [{ data: project }, { data: rows }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', id).single(),
    supabase.from('store_items')
      .select('*, movements:consumption_logs(id, log_date, change_type, quantity, notes)')
      .eq('project_id', id).order('name'),
  ])
  if (!project) notFound()

  // newest movements first for each item
  const items = (rows ?? []).map((r: StoreItem) => ({
    ...r,
    movements: [...(r.movements ?? [])].sort((a, b) => (b.log_date || '').localeCompare(a.log_date || '')),
  }))

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-xs text-[#8888aa] hover:text-white mb-4">
        <ArrowLeft size={13} /> Back to project
      </Link>
      <PageHeader title={`${project.name} — Store & Inventory`} subtitle="Dept-wise materials, purchases and consumption. Perishables flagged for day-of purchase; reorder alerts at threshold." />
      <StoreClient
        projectId={id}
        rows={items as StoreItem[]}
        userId={profile.id}
        canManage={true}
        canDelete={profile.role === 'founder'}
      />
    </div>
  )
}
