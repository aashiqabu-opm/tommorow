import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { PersonalClient } from './PersonalClient'
import type { PersonalLedgerEntry, PersonalGuarantee, PersonalAccount } from '@/lib/types'

// Founder-only private workspace. RLS only ever returns the owner's own rows
// (or a delegate's granted view), so the data is scoped even beyond this gate.
export default async function PersonalPage() {
  const profile = await requireProfile()
  if (profile.role !== 'founder') redirect('/dashboard')

  const supabase = await createClient()
  const [ledger, guarantees, accounts] = await Promise.all([
    supabase.from('personal_company_ledger').select('*').order('txn_date', { ascending: false }),
    supabase.from('personal_guarantees').select('*').order('status').order('expiry_date'),
    supabase.from('personal_accounts').select('*').order('created_at'),
  ])

  return (
    <PersonalClient
      ownerId={profile.id}
      ledger={(ledger.data ?? []) as PersonalLedgerEntry[]}
      guarantees={(guarantees.data ?? []) as PersonalGuarantee[]}
      accounts={(accounts.data ?? []) as PersonalAccount[]}
    />
  )
}
