'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Landmark } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { LOAN_TYPE_LABELS, LOAN_STATUS_LABELS, type PersonalLoan } from '@/lib/types'

const num = (v: string) => (v === '' ? null : Number(v))

export function LoansTab({ ownerId, rows, onChange }: { ownerId: string; rows: PersonalLoan[]; onChange: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalLoan | null>(null)
  const [lender, setLender] = useState('')
  const [loanType, setLoanType] = useState<PersonalLoan['loan_type']>('auto')
  const [asset, setAsset] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [sanctioned, setSanctioned] = useState('')
  const [outstanding, setOutstanding] = useState('')
  const [emi, setEmi] = useState('')
  const [rate, setRate] = useState('')
  const [tenure, setTenure] = useState('')
  const [emisPaid, setEmisPaid] = useState('')
  const [emiDay, setEmiDay] = useState('')
  const [debitAccount, setDebitAccount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState<PersonalLoan['status']>('active')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const active = rows.filter(r => r.status === 'active')
  const monthlyEmi = active.reduce((s, r) => s + Number(r.emi_amount || 0), 0)
  const totalOutstanding = active.reduce((s, r) => s + Number(r.outstanding || 0), 0)

  function openNew() {
    setEditing(null); setLender(''); setLoanType('auto'); setAsset(''); setAccountNo(''); setSanctioned(''); setOutstanding('')
    setEmi(''); setRate(''); setTenure(''); setEmisPaid(''); setEmiDay(''); setDebitAccount(''); setStartDate(''); setEndDate(''); setStatus('active'); setNotes(''); setOpen(true)
  }
  function openEdit(r: PersonalLoan) {
    setEditing(r); setLender(r.lender); setLoanType(r.loan_type); setAsset(r.asset ?? ''); setAccountNo(r.account_no ?? '')
    setSanctioned(r.sanctioned_amount != null ? String(r.sanctioned_amount) : ''); setOutstanding(r.outstanding != null ? String(r.outstanding) : '')
    setEmi(r.emi_amount != null ? String(r.emi_amount) : ''); setRate(r.interest_rate != null ? String(r.interest_rate) : '')
    setTenure(r.tenure_months != null ? String(r.tenure_months) : ''); setEmisPaid(r.emis_paid != null ? String(r.emis_paid) : '')
    setEmiDay(r.emi_day != null ? String(r.emi_day) : ''); setDebitAccount(r.debit_account ?? ''); setStartDate(r.start_date ?? ''); setEndDate(r.end_date ?? '')
    setStatus(r.status); setNotes(r.notes ?? ''); setOpen(true)
  }

  async function save() {
    if (!lender) { toast.error('Lender required'); return }
    setSaving(true); const supabase = createClient()
    const payload = {
      lender, loan_type: loanType, asset: asset || null, account_no: accountNo || null,
      sanctioned_amount: num(sanctioned), outstanding: num(outstanding), emi_amount: num(emi),
      interest_rate: num(rate), tenure_months: num(tenure), emis_paid: num(emisPaid), emi_day: num(emiDay),
      debit_account: debitAccount || null, start_date: startDate || null, end_date: endDate || null, status, notes: notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('personal_loans').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('update', 'personal_loans', editing.id)
    } else {
      const { data, error } = await supabase.from('personal_loans').insert({ ...payload, owner_id: ownerId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      if (data) await logAction('create', 'personal_loans', data.id)
    }
    setSaving(false); setOpen(false); toast.success('Saved'); onChange()
  }
  async function remove(r: PersonalLoan) {
    if (!confirm('Delete this loan?')) return
    const supabase = createClient()
    await supabase.from('personal_loans').delete().eq('id', r.id)
    await logAction('delete', 'personal_loans', r.id)
    toast.success('Deleted'); onChange()
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-3">
          <div className="text-xs text-[#8888aa]">Active loans</div>
          <div className="text-lg font-semibold text-white mt-1">{active.length}</div>
        </div>
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-3">
          <div className="text-xs text-[#8888aa]">Monthly EMI</div>
          <div className="text-lg font-semibold text-amber-300 mt-1">{formatCurrency(monthlyEmi)}</div>
        </div>
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-3">
          <div className="text-xs text-[#8888aa]">Total outstanding</div>
          <div className="text-lg font-semibold text-white mt-1">{totalOutstanding ? formatCurrency(totalOutstanding) : '—'}</div>
        </div>
      </div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-[#8888aa]">Track auto, home and personal loans — EMI, outstanding, rate and tenure.</p>
        <Button icon={Plus} onClick={openNew}>Add loan</Button>
      </div>
      {rows.length === 0 ? (
        <div className="text-center text-sm text-[#8888aa] bg-[#13131a] border border-dashed border-[#2a2a3a] rounded-xl py-10 px-6">No loans yet. Add your auto, home or personal loans to track EMIs and balances.</div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#1c1c26] border border-[#2a2a3a] flex items-center justify-center shrink-0 text-[#8888aa]"><Landmark size={15} /></div>
                  <div className="min-w-0">
                    <div className="text-sm text-white font-medium truncate">
                      {r.lender} <span className="text-[#8888aa] font-normal">· {LOAN_TYPE_LABELS[r.loan_type]}</span>
                      {r.asset ? <span className="text-[#8888aa] font-normal"> · {r.asset}</span> : null}
                    </div>
                    <div className="text-xs text-[#8888aa] mt-0.5">
                      {r.emi_amount ? `EMI ${formatCurrency(Number(r.emi_amount))}` : 'EMI —'}
                      {r.emi_day ? ` · day ${r.emi_day}` : ''}
                      {r.interest_rate ? ` · ${r.interest_rate}%` : ''}
                      {r.tenure_months ? ` · ${r.tenure_months}mo` : ''}
                      {r.debit_account ? ` · from ${r.debit_account}` : ''}
                    </div>
                    {r.account_no ? <div className="text-xs text-[#6a6a82] mt-0.5">A/c {r.account_no}</div> : null}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white">{r.outstanding ? formatCurrency(Number(r.outstanding)) : '—'}</div>
                    <div className={`text-[11px] mt-0.5 ${r.status === 'active' ? 'text-emerald-300' : r.status === 'overdue' ? 'text-red-400' : 'text-[#8888aa]'}`}>{LOAN_STATUS_LABELS[r.status]}</div>
                  </div>
                  <button onClick={() => openEdit(r)} className="text-[#8888aa] hover:text-white"><Pencil size={15} /></button>
                  <button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit loan' : 'Add loan'}>
        <div className="space-y-3">
          <Input label="Lender" value={lender} onChange={e => setLender(e.target.value)} placeholder="HDFC Bank" />
          <Select label="Loan type" value={loanType} onChange={e => setLoanType(e.target.value as PersonalLoan['loan_type'])} options={Object.entries(LOAN_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
          <Input label="Financed asset / collateral" value={asset} onChange={e => setAsset(e.target.value)} placeholder="Volvo XC90 / Apartment" />
          <Input label="Loan account no." value={accountNo} onChange={e => setAccountNo(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Sanctioned amount" value={sanctioned} onChange={setSanctioned} />
            <MoneyInput label="Outstanding" value={outstanding} onChange={setOutstanding} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="EMI amount" value={emi} onChange={setEmi} />
            <Input label="Interest rate %" type="number" value={rate} onChange={e => setRate(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Tenure (months)" type="number" value={tenure} onChange={e => setTenure(e.target.value)} />
            <Input label="EMIs paid" type="number" value={emisPaid} onChange={e => setEmisPaid(e.target.value)} />
            <Input label="EMI day" type="number" value={emiDay} onChange={e => setEmiDay(e.target.value)} />
          </div>
          <Input label="EMI debit account" value={debitAccount} onChange={e => setDebitAccount(e.target.value)} placeholder="Axis Bank A/c XX4325" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <Input label="End date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <Select label="Status" value={status} onChange={e => setStatus(e.target.value as PersonalLoan['status'])} options={Object.entries(LOAN_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
          <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}
