import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LiabilitiesClient } from './LiabilitiesClient'

export default async function LiabilitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'founder' && profile?.role !== 'accountant') redirect('/dashboard')

  const [{ data: liabilities }, { data: projects }] = await Promise.all([
    supabase.from('liabilities').select('*').order('priority').order('due_date'),
    supabase.from('projects').select('id, name'),
  ])

  return <LiabilitiesClient liabilities={liabilities ?? []} projects={projects ?? []} userId={user.id} />
}
