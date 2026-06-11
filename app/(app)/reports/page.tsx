import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReportsClient } from './ReportsClient'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = ['founder', 'accountant', 'general_manager', 'legal_viewer']
  if (!allowed.includes(profile?.role ?? '')) redirect('/dashboard')

  const [
    { data: cashEntries },
    { data: liabilities },
    { data: liabilityPayments },
    { data: payments },
    { data: documents },
    { data: projects },
  ] = await Promise.all([
    // No limit — CA needs full cash book
    supabase.from('cash_entries')
      .select('*, entered_by_profile:profiles!entered_by(full_name)')
      .order('entry_date', { ascending: true }),
    supabase.from('liabilities').select('*, project:projects(name)').order('created_at', { ascending: true }),
    supabase.from('liability_payments')
      .select('*, liability:liabilities(party_name), paid_by_profile:profiles!paid_by(full_name)')
      .order('payment_date', { ascending: true }),
    supabase.from('payment_requests')
      .select('*, project:projects(name), requester:profiles!requested_by(full_name), approver:profiles!approved_by(full_name)')
      .order('created_at', { ascending: true }),
    supabase.from('documents').select('*, project:projects(name)').order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name'),
  ])

  return (
    <ReportsClient
      cashEntries={cashEntries ?? []}
      liabilities={liabilities ?? []}
      liabilityPayments={liabilityPayments ?? []}
      payments={payments ?? []}
      documents={documents ?? []}
      projects={projects ?? []}
      role={profile?.role ?? ''}
    />
  )
}
