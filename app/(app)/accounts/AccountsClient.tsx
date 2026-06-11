'use client'

import { useState } from 'react'
import { Plus, Landmark, ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { BankAccount } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  accounts: BankAccount[]
  todayIn: number
  todayOut: number
  userId: string
}

const EMPTY_ACCOUNT_FORM = {
  name: '',
  account_type: 'bank' as 'bank' | 'upi' | 'cash_drawer',
  account_number: '',
  ifsc: '',
  opening_balance: '',
}

const EMPTY_TXN_FORM = {
  account_id: '',
  direction: 'out' as 'in' | 'out',
  amount: '',
  txn_date: new Date().toISOString().split('T')[0],
  description: '',
  reference: '',
}

const TYPE_LABELS: Record<string, string> = {
  bank: 'Bank',
  upi: 'UPI',
  cash_drawer: 'Cash Drawer',
}

export function AccountsClient({ accounts, todayIn, todayOut, userId }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [accountModal, setAccountModal] = useState(false)
  const [txnModal, setTxnModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM)
  const [txnForm, setTxnForm] = useState(EMPTY_TXN_FORM)
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null)

  const totalBalance = accounts.filter(a => a.is_active).reduce((s, a) => s + a.current_balance, 0)

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!accountForm.name.trim()) return toast.error('Account name is required')
    setSaving(true)
    const supabase = createClient()
    const opening = parseFloat(accountForm.opening_balance) || 0
    const { data, error } = await supabase.from('bank_accounts').insert({
      name: accountForm.name.trim(),
      account_type: accountForm.account_type,
      account_number: accountForm.account_number || null,
      ifsc: accountForm.ifsc || null,
      opening_balance: opening,
      current_balance: opening,
    }).select().single()
    if (error) { toast.error("Couldn't add account"); setSaving(false); return }
    if (data) await logAction('create', 'bank_accounts', data.id, undefined, data)
    toast.success('Account added')
    setSaving(false)
    setAccountModal(false)
    setAccountForm(EMPTY_ACCOUNT_FORM)
    router.refresh()
  }

  async function handleRecordTxn(e: React.FormEvent) {
    e.preventDefault()
    if (!txnForm.account_id) return toast.error('Select an account')
    const amount = parseFloat(txnForm.amount) || 0
    if (amount <= 0) return toast.error('Amount must be positive')
    setSaving(true)
    const supabase = createClient()

    const { data: txn, error: txnErr } = await supabase.from('account_transactions').insert({
      account_id: txnForm.account_id,
      txn_date: txnForm.txn_date,
      direction: txnForm.direction,
      amount,
      description: txnForm.description || null,
      reference: txnForm.reference || null,
      created_by: userId,
    }).select().single()

    if (txnErr) { toast.error("Couldn't record transaction"); setSaving(false); return }

    // Update current_balance
    const account = accounts.find(a => a.id === txnForm.account_id)
    if (account) {
      const newBalance = txnForm.direction === 'in'
        ? account.current_balance + amount
        : account.current_balance - amount
      await supabase.from('bank_accounts').update({ current_balance: newBalance }).eq('id', txnForm.account_id)
    }

    if (txn) await logAction('create', 'account_transactions', txn.id, undefined, txn)
    toast.success('Transaction recorded')
    setSaving(false)
    setTxnModal(false)
    setTxnForm(EMPTY_TXN_FORM)
    router.refresh()
  }

  function maskAccountNumber(num?: string) {
    if (!num) return '—'
    if (num.length <= 4) return num
    return '••••' + num.slice(-4)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Accounts"
        subtitle="Track balances and transactions"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={Plus} onClick={() => setTxnModal(true)}>Record Transaction</Button>
            <Button icon={Plus} onClick={() => setAccountModal(true)}>Add Account</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Balance" value={formatCurrency(totalBalance)} icon={Landmark} status={totalBalance > 0 ? 'green' : 'yellow'} />
        <StatCard title="Active Accounts" value={accounts.filter(a => a.is_active).length} status="default" />
        <StatCard title="Today In" value={formatCurrency(todayIn)} status="green" />
        <StatCard title="Today Out" value={formatCurrency(todayOut)} status={todayOut > 0 ? 'red' : 'default'} />
      </div>

      {accounts.length === 0 ? (
        <EmptyState icon={Landmark} title="No accounts yet" description="Add bank accounts, UPI, or cash drawers to track balances."
          action={<Button icon={Plus} size="sm" onClick={() => setAccountModal(true)}>Add Account</Button>} />
      ) : (
        <div className="space-y-4">
          {accounts.map(acc => {
            const expanded = expandedAccount === acc.id
            return (
              <div key={acc.id} className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white">{acc.name}</span>
                        <StatusBadge label={TYPE_LABELS[acc.account_type]} variant="gray" />
                        {!acc.is_active && <StatusBadge label="Inactive" variant="red" />}
                      </div>
                      {acc.account_number && (
                        <div className="text-xs text-[#8888aa]">Acc: {maskAccountNumber(acc.account_number)}{acc.ifsc ? ` · IFSC: ${acc.ifsc}` : ''}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-bold tabular-nums ${acc.current_balance >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                        {formatCurrency(acc.current_balance)}
                      </div>
                      <div className="text-[10px] text-[#5a5a7a] mt-0.5">Opening: {formatCurrency(acc.opening_balance)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedAccount(expanded ? null : acc.id)}
                    className="flex items-center gap-1 text-xs text-[#8888aa] hover:text-white mt-2"
                  >
                    {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {expanded ? 'Hide' : 'View'} recent transactions
                  </button>
                </div>

                {expanded && (
                  <div className="border-t border-[#2a2a3a]">
                    {(!acc.recent_transactions || acc.recent_transactions.length === 0) ? (
                      <div className="py-6 text-center text-xs text-[#5a5a7a]">No transactions yet</div>
                    ) : (
                      <div className="divide-y divide-[#2a2a3a]">
                        {acc.recent_transactions.map(txn => (
                          <div key={txn.id} className="px-5 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${txn.direction === 'in' ? 'bg-emerald-500/15' : 'bg-red-500/15'}`}>
                                {txn.direction === 'in'
                                  ? <ArrowDownLeft size={13} className="text-emerald-400" />
                                  : <ArrowUpRight size={13} className="text-red-400" />}
                              </div>
                              <div>
                                <div className="text-xs text-white">{txn.description ?? (txn.direction === 'in' ? 'Money In' : 'Money Out')}</div>
                                <div className="text-[10px] text-[#5a5a7a]">{formatDate(txn.txn_date)}{txn.reference ? ` · Ref: ${txn.reference}` : ''}</div>
                              </div>
                            </div>
                            <div className={`text-sm font-semibold tabular-nums ${txn.direction === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {txn.direction === 'in' ? '+' : '-'}{formatCurrency(txn.amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Account Modal */}
      <Modal open={accountModal} onClose={() => setAccountModal(false)} title="Add Account" size="sm">
        <form onSubmit={handleAddAccount} className="space-y-4">
          <Input label="Account Name *" value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} required placeholder="e.g. SBI Main Account" />
          <Select label="Account Type" value={accountForm.account_type} onChange={e => setAccountForm({ ...accountForm, account_type: e.target.value as 'bank' | 'upi' | 'cash_drawer' })}
            options={[{ value: 'bank', label: 'Bank Account' }, { value: 'upi', label: 'UPI' }, { value: 'cash_drawer', label: 'Cash Drawer' }]} />
          {accountForm.account_type === 'bank' && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Account Number" value={accountForm.account_number} onChange={e => setAccountForm({ ...accountForm, account_number: e.target.value })} />
              <Input label="IFSC Code" value={accountForm.ifsc} onChange={e => setAccountForm({ ...accountForm, ifsc: e.target.value })} />
            </div>
          )}
          <MoneyInput label="Opening Balance (₹)" value={accountForm.opening_balance} onChange={v => setAccountForm({ ...accountForm, opening_balance: v })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setAccountModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Add Account</Button>
          </div>
        </form>
      </Modal>

      {/* Record Transaction Modal */}
      <Modal open={txnModal} onClose={() => setTxnModal(false)} title="Record Transaction" size="sm">
        <form onSubmit={handleRecordTxn} className="space-y-4">
          <Select label="Account *" value={txnForm.account_id} onChange={e => setTxnForm({ ...txnForm, account_id: e.target.value })}
            options={accounts.filter(a => a.is_active).map(a => ({ value: a.id, label: `${a.name} (${formatCurrency(a.current_balance)})` }))}
            placeholder="— Select account —" />
          <Select label="Direction" value={txnForm.direction} onChange={e => setTxnForm({ ...txnForm, direction: e.target.value as 'in' | 'out' })}
            options={[{ value: 'in', label: 'Money In (Credit)' }, { value: 'out', label: 'Money Out (Debit)' }]} />
          <MoneyInput label="Amount (₹) *" value={txnForm.amount} onChange={v => setTxnForm({ ...txnForm, amount: v })} required />
          <Input label="Date" type="date" value={txnForm.txn_date} onChange={e => setTxnForm({ ...txnForm, txn_date: e.target.value })} />
          <Input label="Description" value={txnForm.description} onChange={e => setTxnForm({ ...txnForm, description: e.target.value })} placeholder="What is this for?" />
          <Input label="Reference / Cheque No." value={txnForm.reference} onChange={e => setTxnForm({ ...txnForm, reference: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setTxnModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Record Transaction</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
