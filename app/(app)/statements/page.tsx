import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth'
import { StatementsClient } from './StatementsClient'

export default async function StatementsPage() {
  const profile = await requireProfile()
  if (!['founder', 'accountant'].includes(profile.role)) redirect('/dashboard')
  const supabase = await createClient()

  const [{ data: ledgers }, { data: vouchers }, { data: payments }, { data: settings }] = await Promise.all([
    supabase.from('ledgers').select('name, parent, opening_balance'),
    supabase.from('vouchers').select('voucher_date, entries:voucher_entries(ledger_name, dr, amount)').order('voucher_date', { ascending: true }),
    supabase.from('payment_requests').select('payee, amount, tds_amount, tds_section, paid_at, created_at, approval_status, payment_status, vendor:vendors(pan)'),
    supabase.from('app_settings').select('key, value').eq('key', 'tally_tds_ledger'),
  ])
  const tdsLedger = (settings ?? []).find(s => s.key === 'tally_tds_ledger')?.value || 'TDS Payable'

  return (
    <StatementsClient
      ledgers={ledgers ?? []}
      vouchers={vouchers ?? []}
      payments={payments ?? []}
      tdsLedger={tdsLedger}
    />
  )
}
