import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { AccountsClient } from './AccountsClient'

export default async function AccountsPage() {
  const supabase = await createClient()
  const profile = await requireProfile()

  const allowed = ['founder', 'accountant']
  if (!allowed.includes(profile.role)) redirect('/dashboard')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: accounts }, { data: todayTxns }, { data: recentTxns }] = await Promise.all([
    supabase.from('bank_accounts').select('*').order('name'),
    supabase.from('account_transactions').select('*').eq('txn_date', today),
    // One query for recent transactions across all accounts, instead of an
    // N+1 fan-out; we slice the latest 10 per account in memory below.
    supabase.from('account_transactions')
      .select('*')
      .order('txn_date', { ascending: false })
      .limit(500),
  ])

  const txnsByAccount = new Map<string, typeof recentTxns>()
  for (const txn of recentTxns ?? []) {
    const list = txnsByAccount.get(txn.account_id) ?? []
    if (list.length < 10) {
      list.push(txn)
      txnsByAccount.set(txn.account_id, list)
    }
  }

  const accountsWithTxns = (accounts ?? []).map(acc => ({
    ...acc,
    recent_transactions: txnsByAccount.get(acc.id) ?? [],
  }))

  const todayIn = (todayTxns ?? []).filter(t => t.direction === 'in').reduce((s, t) => s + t.amount, 0)
  const todayOut = (todayTxns ?? []).filter(t => t.direction === 'out').reduce((s, t) => s + t.amount, 0)

  return (
    <AccountsClient
      accounts={accountsWithTxns}
      todayIn={todayIn}
      todayOut={todayOut}
      userId={profile.id}
    />
  )
}
