import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth'
import { VouchersClient } from './VouchersClient'

export default async function VouchersPage() {
  const profile = await requireProfile()
  if (!['founder', 'accountant'].includes(profile.role)) redirect('/dashboard')
  const supabase = await createClient()

  const [{ data: ledgers }, { data: vouchers }] = await Promise.all([
    supabase.from('ledgers').select('*').order('name'),
    supabase.from('vouchers').select('*, entries:voucher_entries(*)').order('voucher_date', { ascending: false }).order('created_at', { ascending: false }).limit(50),
  ])

  return <VouchersClient ledgers={ledgers ?? []} vouchers={vouchers ?? []} userId={profile.id} />
}
