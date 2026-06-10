import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PaymentsClient } from './PaymentsClient'

export default async function PaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role

  const allowed = ['founder', 'accountant', 'general_manager', 'executive_producer', 'production_manager']
  if (!allowed.includes(role ?? '')) redirect('/dashboard')

  const [{ data: requests }, { data: projects }] = await Promise.all([
    supabase.from('payment_requests')
      .select('*, project:projects(name), requester:profiles!requested_by(full_name)')
      .order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name'),
  ])

  return <PaymentsClient requests={requests ?? []} projects={projects ?? []} userId={user.id} role={role ?? ''} />
}
