import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { VendorsClient } from './VendorsClient'

export default async function VendorsPage() {
  const supabase = await createClient()
  const profile = await requireProfile()

  const allowed = ['founder', 'accountant', 'general_manager']
  if (!allowed.includes(profile.role)) redirect('/dashboard')

  const [{ data: vendors }, { data: paidStats }] = await Promise.all([
    supabase.from('vendors').select('*').order('name'),
    supabase.from('payment_requests')
      .select('payee_vendor_id, amount')
      .not('payee_vendor_id', 'is', null)
      .eq('payment_status', 'paid'),
  ])

  // Aggregate total paid per vendor
  const paidByVendor: Record<string, number> = {}
  for (const p of paidStats ?? []) {
    if (p.payee_vendor_id) {
      paidByVendor[p.payee_vendor_id] = (paidByVendor[p.payee_vendor_id] ?? 0) + (p.amount ?? 0)
    }
  }

  const vendorsWithPaid = (vendors ?? []).map(v => ({
    ...v,
    total_paid: paidByVendor[v.id] ?? 0,
  }))

  const totalEverPaid = Object.values(paidByVendor).reduce((s, v) => s + v, 0)

  return (
    <VendorsClient
      vendors={vendorsWithPaid}
      totalEverPaid={totalEverPaid}
      userId={profile.id}
    />
  )
}
