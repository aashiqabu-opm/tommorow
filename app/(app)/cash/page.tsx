import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CashClientPage } from './CashClient'

export default async function CashPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'founder' && profile?.role !== 'accountant') redirect('/dashboard')

  const { data: entries } = await supabase
    .from('cash_entries')
    .select('*, profile:profiles(full_name)')
    .order('entry_date', { ascending: false })
    .limit(30)

  return <CashClientPage entries={entries ?? []} userId={user.id} />
}
