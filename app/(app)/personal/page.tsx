import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { PersonalClient } from './PersonalClient'
import type {
  PersonalLedgerEntry, PersonalGuarantee, PersonalAccount,
  PersonalTaxProfile, PersonalTaxItem, PersonalDeduction, PersonalCapitalGain,
  PersonalFilmStake, PersonalRoyalty, PersonalDocument,
} from '@/lib/types'

// Founder-only private workspace. RLS only ever returns the owner's own rows
// (or a delegate's granted view), so the data is scoped even beyond this gate.
export default async function PersonalPage() {
  const profile = await requireProfile()
  if (profile.role !== 'founder') redirect('/dashboard')

  const supabase = await createClient()
  const [ledger, guarantees, accounts, taxProfile, taxItems, deductions, gains, stakes, royalties, documents] = await Promise.all([
    supabase.from('personal_company_ledger').select('*').order('txn_date', { ascending: false }),
    supabase.from('personal_guarantees').select('*').order('status').order('expiry_date'),
    supabase.from('personal_accounts').select('*').order('created_at'),
    supabase.from('personal_tax_profile').select('*').maybeSingle(),
    supabase.from('personal_tax_items').select('*').order('due_date'),
    supabase.from('personal_deductions').select('*').order('created_at'),
    supabase.from('personal_capital_gains').select('*').order('created_at', { ascending: false }),
    supabase.from('personal_film_stakes').select('*').order('created_at'),
    supabase.from('personal_royalties').select('*').order('status').order('expected_date'),
    supabase.from('personal_documents').select('*').order('expiry_date', { nullsFirst: false }),
  ])

  return (
    <PersonalClient
      ownerId={profile.id}
      ledger={(ledger.data ?? []) as PersonalLedgerEntry[]}
      guarantees={(guarantees.data ?? []) as PersonalGuarantee[]}
      accounts={(accounts.data ?? []) as PersonalAccount[]}
      taxProfile={(taxProfile.data ?? null) as PersonalTaxProfile | null}
      taxItems={(taxItems.data ?? []) as PersonalTaxItem[]}
      deductions={(deductions.data ?? []) as PersonalDeduction[]}
      gains={(gains.data ?? []) as PersonalCapitalGain[]}
      stakes={(stakes.data ?? []) as PersonalFilmStake[]}
      royalties={(royalties.data ?? []) as PersonalRoyalty[]}
      documents={(documents.data ?? []) as PersonalDocument[]}
    />
  )
}
