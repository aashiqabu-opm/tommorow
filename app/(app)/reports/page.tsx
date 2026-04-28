import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReportsClient } from './ReportsClient'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const allowed = ['founder', 'accountant', 'legal_viewer']
  if (!allowed.includes(profile?.role ?? '')) redirect('/dashboard')

  const [
    { data: cashEntries },
    { data: liabilities },
    { data: payments },
    { data: documents },
    { data: projects },
  ] = await Promise.all([
    supabase.from('cash_entries').select('*').order('entry_date', { ascending: false }).limit(90),
    supabase.from('liabilities').select('*'),
    supabase.from('payment_requests').select('*, project:projects(name)').order('created_at', { ascending: false }),
    supabase.from('documents').select('*, project:projects(name)').order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name'),
  ])

  return (
    <ReportsClient
      cashEntries={cashEntries ?? []}
      liabilities={liabilities ?? []}
      payments={payments ?? []}
      documents={documents ?? []}
      projects={projects ?? []}
      role={profile?.role ?? ''}
    />
  )
}
