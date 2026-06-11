import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PaymentsClient } from './PaymentsClient'

export default async function PaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role

  const allowed = ['founder', 'accountant', 'general_manager', 'executive_producer']
  if (!allowed.includes(role ?? '')) redirect('/dashboard')

  const [{ data: requests }, { data: projects }, { data: comments }, { data: vendors }] = await Promise.all([
    supabase.from('payment_requests')
      .select('*, project:projects(name), requester:profiles!requested_by(full_name), vendor:vendors(pan)')
      .order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name'),
    supabase.from('comments')
      .select('*, profile:profiles(full_name)')
      .eq('entity_type', 'payment_requests')
      .order('created_at', { ascending: true }),
    supabase.from('vendors').select('id, name').order('name'),
  ])

  return <PaymentsClient requests={requests ?? []} projects={projects ?? []} comments={comments ?? []} vendors={vendors ?? []} userId={user.id} role={role ?? ''} />
}
