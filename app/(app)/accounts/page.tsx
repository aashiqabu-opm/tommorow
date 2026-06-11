import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountsClient } from './AccountsClient'

export default async function AccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role

  const allowed = ['founder', 'accountant']
  if (!allowed.includes(role ?? '')) redirect('/dashboard')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: accounts }, { data: todayTxns }] = await Promise.all([
    supabase.from('bank_accounts').select('*').order('name'),
    supabase.from('account_transactions')
      .select('*')
      .eq('txn_date', today),
  ])

  // Fetch recent 10 transactions per account
  const accountsWithTxns = await Promise.all(
    (accounts ?? []).map(async (acc) => {
      const { data: txns } = await supabase
        .from('account_transactions')
        .select('*')
        .eq('account_id', acc.id)
        .order('txn_date', { ascending: false })
        .limit(10)
      return { ...acc, recent_transactions: txns ?? [] }
    })
  )

  const todayIn = (todayTxns ?? []).filter(t => t.direction === 'in').reduce((s, t) => s + t.amount, 0)
  const todayOut = (todayTxns ?? []).filter(t => t.direction === 'out').reduce((s, t) => s + t.amount, 0)

  return (
    <AccountsClient
      accounts={accountsWithTxns}
      todayIn={todayIn}
      todayOut={todayOut}
      userId={user.id}
    />
  )
}
