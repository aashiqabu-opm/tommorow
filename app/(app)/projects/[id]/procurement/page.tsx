import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProcurementClient, type PO, type Advance } from '../ProcurementClient'

export const dynamic = 'force-dynamic'

// Purchase orders + vendor advances — pre-prod "money in the field".
// Read: management. Write: finance (RLS on these tables). Founder deletes.
export default async function ProcurementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireProfile()
  if (!['founder', 'accountant', 'general_manager', 'executive_producer'].includes(profile.role)) redirect(`/projects/${id}`)
  const isFinance = ['founder', 'accountant'].includes(profile.role)

  const supabase = await createClient()
  const [{ data: project }, { data: pos }, { data: advances }, { data: vendors }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', id).single(),
    supabase.from('purchase_orders').select('id, po_number, vendor_id, department, description, order_amount, status, expected_delivery_date').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('vendor_advances').select('id, vendor_id, purchase_order_id, amount, paid_date, expected_delivery_date, status, payment_request_id, notes').eq('project_id', id).order('paid_date', { ascending: false }),
    supabase.from('vendors').select('id, name').order('name'),
  ])
  if (!project) notFound()

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-xs text-[#8888aa] hover:text-white mb-4">
        <ArrowLeft size={13} /> Back to project
      </Link>
      <PageHeader title={`${project.name} — Procurement`} subtitle="Purchase orders and vendor advances — track committed spend and money paid before delivery." />
      <ProcurementClient
        projectId={id}
        vendors={vendors ?? []}
        pos={(pos ?? []) as PO[]}
        advances={(advances ?? []) as Advance[]}
        userId={profile.id}
        canManage={isFinance}
        canDelete={profile.role === 'founder'}
      />
    </div>
  )
}
