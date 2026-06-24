import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { WhatMatters } from '@/components/ui/WhatMatters'
import { paymentsWhatMatters } from '@/lib/what-matters'
import { PaymentsClient } from './PaymentsClient'

export default async function PaymentsPage() {
  const supabase = await createClient()
  const profile = await requireProfile()
  const role = profile.role

  const allowed = ['founder', 'accountant', 'general_manager', 'executive_producer']
  if (!allowed.includes(role)) redirect('/dashboard')

  const [{ data: requests }, { data: projects }, { data: comments }, { data: vendors }, { data: budgetLines }, { data: settings }] = await Promise.all([
    supabase.from('payment_requests')
      .select('*, project:projects(name), requester:profiles!requested_by(full_name), vendor:vendors(pan)')
      .order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name'),
    supabase.from('comments')
      .select('*, profile:profiles(full_name)')
      .eq('entity_type', 'payment_requests')
      .order('created_at', { ascending: true }),
    supabase.from('vendors').select('id, name, pan').order('name'),
    // Finance-only via RLS (empty for GM/EP); used to code a payment to a budget head
    supabase.from('budget_lines').select('id, project_id, section, head').order('sort_order', { ascending: true }),
    supabase.from('app_settings').select('value').eq('key', 'approval_limit').maybeSingle(),
  ])

  const approvalLimit = parseFloat(settings?.value ?? '') || 0

  return (
    <div className="space-y-4">
      <WhatMatters items={paymentsWhatMatters(requests ?? [])} />
      <PaymentsClient requests={requests ?? []} projects={projects ?? []} comments={comments ?? []} vendors={vendors ?? []} budgetLines={budgetLines ?? []} userId={profile.id} role={role} approvalLimit={approvalLimit} />
    </div>
  )
}
