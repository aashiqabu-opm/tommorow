import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth'
import { ReconcileClient } from './ReconcileClient'

export default async function ReconcilePage() {
  const profile = await requireProfile()
  if (!['founder', 'accountant'].includes(profile.role)) redirect('/dashboard')
  const supabase = await createClient()

  const sixMonthsAgo = new Date(Date.now() - 183 * 86400000).toISOString().slice(0, 10)
  const [{ data: accounts }, { data: txns }, { data: pays }, { data: incomes }] = await Promise.all([
    supabase.from('bank_accounts').select('id, name, current_balance').order('name'),
    supabase.from('bank_transactions').select('*').order('txn_date', { ascending: false }).limit(1000),
    supabase.from('payment_requests').select('id, payee, amount, gst_amount, tds_amount, net_payable, approval_status, payment_status, paid_at, created_at').gte('created_at', sixMonthsAgo),
    supabase.from('project_income').select('id, source, amount, gst_amount, income_date, status, project:projects(name)').gte('income_date', sixMonthsAgo),
  ])

  return (
    <ReconcileClient
      accounts={accounts ?? []}
      txns={txns ?? []}
      payments={pays ?? []}
      incomes={incomes ?? []}
      userId={profile.id}
    />
  )
}
