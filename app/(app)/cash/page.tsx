import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { CashClientPage } from './CashClient'

export default async function CashPage() {
  const supabase = await createClient()
  const profile = await requireProfile()
  if (profile.role !== 'founder' && profile.role !== 'accountant') redirect('/dashboard')

  const { data: entries } = await supabase
    .from('cash_entries')
    .select('*, profile:profiles(full_name)')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30)

  return <CashClientPage entries={entries ?? []} userId={profile.id} />
}
