'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Plus, Pencil, Trash2, Building2, ShieldAlert, Wallet, ArrowLeftRight, Receipt, Clapperboard, FileText, RefreshCw, Car, HeartPulse, CreditCard } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { LEDGER_KIND_LABELS, type PersonalLedgerEntry, type PersonalGuarantee, type PersonalAccount,
  type PersonalTaxProfile, type PersonalTaxItem, type PersonalDeduction, type PersonalCapitalGain,
  type PersonalFilmStake, type PersonalRoyalty, type PersonalDocument } from '@/lib/types'
import { TaxTab } from './TaxTab'
import { FilmTab } from './FilmTab'
import { LegalTab } from './LegalTab'
import { RecurringTab } from './RecurringTab'
import { VehicleTab } from './VehicleTab'
import { HealthTab } from './HealthTab'
import { CardsTab } from './CardsTab'
import type { PersonalRecurring, PersonalVehicle, PersonalHealthPolicy, PersonalCard, PersonalTransaction } from '@/lib/types'

type Tab = 'ledger' | 'guarantees' | 'accounts' | 'recurring' | 'vehicles' | 'health' | 'cards' | 'tax' | 'film' | 'legal'

interface Props {
  ownerId: string
  ledger: PersonalLedgerEntry[]
  guarantees: PersonalGuarantee[]
  accounts: PersonalAccount[]
  taxProfile: PersonalTaxProfile | null
  taxItems: PersonalTaxItem[]
  deductions: PersonalDeduction[]
  gains: PersonalCapitalGain[]
  stakes: PersonalFilmStake[]
  royalties: PersonalRoyalty[]
  documents: PersonalDocument[]
  recurring: PersonalRecurring[]
  vehicles: PersonalVehicle[]
  policies: PersonalHealthPolicy[]
  cards: PersonalCard[]
  transactions: PersonalTransaction[]
}

export function PersonalClient({ ownerId, ledger, guarantees, accounts, taxProfile, taxItems, deductions, gains, stakes, royalties, documents, recurring, vehicles, policies, cards, transactions }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('ledger')

  // Summary
  const owedByCompany = ledger.filter(l => l.status === 'open')
    .reduce((s, l) => s + (l.direction === 'to_company' ? Number(l.amount) : -Number(l.amount)), 0)
  const exposure = guarantees.filter(g => g.status === 'active').reduce((s, g) => s + Number(g.amount), 0)
  const cash = accounts.reduce((s, a) => s + Number(a.balance), 0)
  const netPosition = cash + owedByCompany
  // Phase 2 summary signals
  const today = new Date().toISOString().slice(0, 10)
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
  const taxDueSoon = taxItems.filter(t => t.status === 'pending' && t.due_date && t.due_date >= today && t.due_date <= in90)
    .reduce((s, t) => s + Number(t.amount), 0)
  const royaltiesPending = royalties.filter(r => r.status !== 'received').reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div>
      <div className="flex items-center gap-2 mb-1"><Lock size={16} className="text-[#f5b301]" /><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f5b301]">Private</span></div>
      <PageHeader
        title="Personal"
        subtitle="Your private founder workspace — visible only to you."
      />

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <StatCard title="Net position" value={formatCurrency(netPosition)} icon={Wallet}
          status={netPosition >= 0 ? 'green' : 'red'} subtitle="Cash + company owes you" />
        <StatCard title="Company owes you" value={formatCurrency(owedByCompany)} icon={Building2}
          status={owedByCompany >= 0 ? 'default' : 'yellow'} subtitle="Director's loan / capital net" />
        <StatCard title="Guarantee exposure" value={formatCurrency(exposure)} icon={ShieldAlert}
          status={exposure > 0 ? 'red' : 'green'} subtitle="If guarantees are called" />
        <StatCard title="Personal accounts" value={formatCurrency(cash)} icon={Wallet} subtitle={`${accounts.length} account(s)`} />
        <StatCard title="Tax due (90d)" value={formatCurrency(taxDueSoon)} icon={Receipt}
          status={taxDueSoon > 0 ? 'yellow' : 'default'} subtitle="Pending installments" />
        <StatCard title="Royalties pending" value={formatCurrency(royaltiesPending)} icon={Clapperboard}
          status={royaltiesPending > 0 ? 'green' : 'default'} subtitle="Expected / overdue" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[#2a2a3a] overflow-x-auto">
        {([['ledger', 'Founder ↔ Company', ArrowLeftRight], ['guarantees', 'Guarantees', ShieldAlert], ['accounts', 'Accounts', Wallet], ['recurring', 'Monthly', RefreshCw], ['vehicles', 'Vehicles', Car], ['health', 'Health', HeartPulse], ['cards', 'Cards', CreditCard], ['tax', 'Tax', Receipt], ['film', 'Film income', Clapperboard], ['legal', 'Legal vault', FileText]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === id ? 'border-[#f5b301] text-white' : 'border-transparent text-[#8888aa] hover:text-white'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'ledger' && <LedgerTab ownerId={ownerId} rows={ledger} onChange={() => router.refresh()} toast={toast} />}
      {tab === 'guarantees' && <GuaranteesTab ownerId={ownerId} rows={guarantees} onChange={() => router.refresh()} toast={toast} />}
      {tab === 'accounts' && <AccountsTab ownerId={ownerId} rows={accounts} onChange={() => router.refresh()} toast={toast} />}
      {tab === 'recurring' && <RecurringTab ownerId={ownerId} rows={recurring} onChange={() => router.refresh()} />}
      {tab === 'vehicles' && <VehicleTab ownerId={ownerId} rows={vehicles} onChange={() => router.refresh()} />}
      {tab === 'health' && <HealthTab ownerId={ownerId} rows={policies} onChange={() => router.refresh()} />}
      {tab === 'cards' && <CardsTab ownerId={ownerId} cards={cards} txns={transactions} onChange={() => router.refresh()} />}
      {tab === 'tax' && <TaxTab ownerId={ownerId} profile={taxProfile} items={taxItems} deductions={deductions} gains={gains} onChange={() => router.refresh()} />}
      {tab === 'film' && <FilmTab ownerId={ownerId} stakes={stakes} royalties={royalties} onChange={() => router.refresh()} />}
      {tab === 'legal' && <LegalTab ownerId={ownerId} rows={documents} onChange={() => router.refresh()} />}
    </div>
  )
}

// ─────────────────────────── Founder ↔ Company ledger ───────────────────────────
function LedgerTab({ ownerId, rows, onChange, toast }: { ownerId: string; rows: PersonalLedgerEntry[]; onChange: () => void; toast: ReturnType<typeof useToast> }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalLedgerEntry | null>(null)
  const [entity, setEntity] = useState('OPM Cinemas')
  const [direction, setDirection] = useState<'to_company' | 'from_company'>('to_company')
  const [kind, setKind] = useState<PersonalLedgerEntry['kind']>('loan')
  const [amount, setAmount] = useState('')
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState<'open' | 'settled'>('open')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function openNew() {
    setEditing(null); setEntity('OPM Cinemas'); setDirection('to_company'); setKind('loan')
    setAmount(''); setTxnDate(new Date().toISOString().slice(0, 10)); setStatus('open'); setNotes(''); setOpen(true)
  }
  function openEdit(r: PersonalLedgerEntry) {
    setEditing(r); setEntity(r.entity); setDirection(r.direction); setKind(r.kind)
    setAmount(String(r.amount)); setTxnDate(r.txn_date); setStatus(r.status); setNotes(r.notes ?? ''); setOpen(true)
  }

  async function save() {
    if (!amount) { toast.error('Enter an amount'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = { entity, direction, kind, amount: Number(amount), txn_date: txnDate, status, notes: notes || null }
    if (editing) {
      const { data, error } = await supabase.from('personal_company_ledger').update(payload).eq('id', editing.id).select().single()
      if (error) { toast.error("Couldn't save — please try again"); setSaving(false); return }
      if (data) await logAction('update', 'personal_company_ledger', editing.id)
      toast.success('Entry updated')
    } else {
      const { data, error } = await supabase.from('personal_company_ledger').insert({ ...payload, owner_id: ownerId }).select().single()
      if (error) { toast.error("Couldn't save — please try again"); setSaving(false); return }
      if (data) await logAction('create', 'personal_company_ledger', data.id)
      toast.success('Entry added')
    }
    setSaving(false); setOpen(false); onChange()
  }

  async function remove(r: PersonalLedgerEntry) {
    if (!confirm('Delete this entry?')) return
    const supabase = createClient()
    const { error } = await supabase.from('personal_company_ledger').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'personal_company_ledger', r.id)
    toast.success('Deleted'); onChange()
  }

  return (
    <div>
      <div className="flex justify-end mb-3"><Button icon={Plus} onClick={openNew}>Add entry</Button></div>
      {rows.length === 0 ? (
        <Empty text="No founder↔company entries yet. Track director's loans, capital, drawings, dividends and reimbursements here." />
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm text-white font-medium">{LEDGER_KIND_LABELS[r.kind]} <span className="text-[#8888aa] font-normal">· {r.entity}</span></div>
                <div className="text-xs text-[#8888aa] mt-0.5">{formatDate(r.txn_date)} · {r.direction === 'to_company' ? 'You → company' : 'Company → you'} · {r.status}{r.notes ? ` · ${r.notes}` : ''}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-sm font-semibold ${r.direction === 'to_company' ? 'text-emerald-300' : 'text-red-300'}`}>{r.direction === 'to_company' ? '+' : '−'}{formatCurrency(Number(r.amount))}</span>
                <button onClick={() => openEdit(r)} className="text-[#8888aa] hover:text-white"><Pencil size={15} /></button>
                <button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit entry' : 'Add founder↔company entry'}>
        <div className="space-y-3">
          <Input label="Company / entity" value={entity} onChange={e => setEntity(e.target.value)} />
          <Select label="Direction" value={direction} onChange={e => setDirection(e.target.value as 'to_company' | 'from_company')}
            options={[{ value: 'to_company', label: 'You → company (company owes you)' }, { value: 'from_company', label: 'Company → you (reduces what it owes)' }]} />
          <Select label="Type" value={kind} onChange={e => setKind(e.target.value as PersonalLedgerEntry['kind'])}
            options={Object.entries(LEDGER_KIND_LABELS).map(([value, label]) => ({ value, label }))} />
          <MoneyInput label="Amount" value={amount} onChange={setAmount} required />
          <Input label="Date" type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} />
          <Select label="Status" value={status} onChange={e => setStatus(e.target.value as 'open' | 'settled')}
            options={[{ value: 'open', label: 'Open' }, { value: 'settled', label: 'Settled' }]} />
          <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────── Guarantees ───────────────────────────
function GuaranteesTab({ ownerId, rows, onChange, toast }: { ownerId: string; rows: PersonalGuarantee[]; onChange: () => void; toast: ReturnType<typeof useToast> }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalGuarantee | null>(null)
  const [lender, setLender] = useState('')
  const [borrower, setBorrower] = useState('OPM Cinemas')
  const [amount, setAmount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [status, setStatus] = useState<'active' | 'released'>('active')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function openNew() { setEditing(null); setLender(''); setBorrower('OPM Cinemas'); setAmount(''); setStartDate(''); setExpiryDate(''); setStatus('active'); setNotes(''); setOpen(true) }
  function openEdit(r: PersonalGuarantee) { setEditing(r); setLender(r.lender); setBorrower(r.borrower); setAmount(String(r.amount)); setStartDate(r.start_date ?? ''); setExpiryDate(r.expiry_date ?? ''); setStatus(r.status); setNotes(r.notes ?? ''); setOpen(true) }

  async function save() {
    if (!lender || !amount) { toast.error('Lender and amount are required'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = { lender, borrower, amount: Number(amount), start_date: startDate || null, expiry_date: expiryDate || null, status, notes: notes || null }
    if (editing) {
      const { error } = await supabase.from('personal_guarantees').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('update', 'personal_guarantees', editing.id); toast.success('Guarantee updated')
    } else {
      const { data, error } = await supabase.from('personal_guarantees').insert({ ...payload, owner_id: ownerId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      if (data) await logAction('create', 'personal_guarantees', data.id); toast.success('Guarantee added')
    }
    setSaving(false); setOpen(false); onChange()
  }
  async function remove(r: PersonalGuarantee) {
    if (!confirm('Delete this guarantee?')) return
    const supabase = createClient()
    const { error } = await supabase.from('personal_guarantees').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'personal_guarantees', r.id); toast.success('Deleted'); onChange()
  }

  return (
    <div>
      <div className="flex justify-end mb-3"><Button icon={Plus} onClick={openNew}>Add guarantee</Button></div>
      {rows.length === 0 ? (
        <Empty text="No personal guarantees recorded. Track loans you've personally guaranteed for the company here — this is your real exposure." />
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm text-white font-medium">{r.lender} <span className="text-[#8888aa] font-normal">· for {r.borrower}</span></div>
                <div className="text-xs text-[#8888aa] mt-0.5">{r.expiry_date ? `Expires ${formatDate(r.expiry_date)}` : 'No expiry'} · {r.status}{r.notes ? ` · ${r.notes}` : ''}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-sm font-semibold ${r.status === 'active' ? 'text-red-300' : 'text-[#8888aa]'}`}>{formatCurrency(Number(r.amount))}</span>
                <button onClick={() => openEdit(r)} className="text-[#8888aa] hover:text-white"><Pencil size={15} /></button>
                <button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit guarantee' : 'Add guarantee'}>
        <div className="space-y-3">
          <Input label="Lender (bank/financier)" value={lender} onChange={e => setLender(e.target.value)} />
          <Input label="Borrower (who the loan is for)" value={borrower} onChange={e => setBorrower(e.target.value)} />
          <MoneyInput label="Guaranteed amount" value={amount} onChange={setAmount} required />
          <Input label="Start date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <Input label="Expiry date" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
          <Select label="Status" value={status} onChange={e => setStatus(e.target.value as 'active' | 'released')}
            options={[{ value: 'active', label: 'Active' }, { value: 'released', label: 'Released' }]} />
          <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}

// ─────────────────────────── Accounts ───────────────────────────
function AccountsTab({ ownerId, rows, onChange, toast }: { ownerId: string; rows: PersonalAccount[]; onChange: () => void; toast: ReturnType<typeof useToast> }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalAccount | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<PersonalAccount['type']>('bank')
  const [balance, setBalance] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  function openNew() { setEditing(null); setName(''); setType('bank'); setBalance(''); setNotes(''); setOpen(true) }
  function openEdit(r: PersonalAccount) { setEditing(r); setName(r.name); setType(r.type); setBalance(String(r.balance)); setNotes(r.notes ?? ''); setOpen(true) }

  async function save() {
    if (!name) { toast.error('Name is required'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = { name, type, balance: Number(balance || 0), notes: notes || null }
    if (editing) {
      const { error } = await supabase.from('personal_accounts').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('update', 'personal_accounts', editing.id); toast.success('Account updated')
    } else {
      const { data, error } = await supabase.from('personal_accounts').insert({ ...payload, owner_id: ownerId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      if (data) await logAction('create', 'personal_accounts', data.id); toast.success('Account added')
    }
    setSaving(false); setOpen(false); onChange()
  }
  async function remove(r: PersonalAccount) {
    if (!confirm('Delete this account?')) return
    const supabase = createClient()
    const { error } = await supabase.from('personal_accounts').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'personal_accounts', r.id); toast.success('Deleted'); onChange()
  }

  const TYPE_LABELS: Record<PersonalAccount['type'], string> = { bank: 'Bank', cash: 'Cash', wallet: 'Wallet', investment: 'Investment' }

  return (
    <div>
      <div className="flex justify-end mb-3"><Button icon={Plus} onClick={openNew}>Add account</Button></div>
      {rows.length === 0 ? (
        <Empty text="No personal accounts yet. Add your bank, cash and wallet balances to see your net position." />
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm text-white font-medium">{r.name}</div>
                <div className="text-xs text-[#8888aa] mt-0.5">{TYPE_LABELS[r.type]}{r.notes ? ` · ${r.notes}` : ''}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-white">{formatCurrency(Number(r.balance))}</span>
                <button onClick={() => openEdit(r)} className="text-[#8888aa] hover:text-white"><Pencil size={15} /></button>
                <button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit account' : 'Add account'}>
        <div className="space-y-3">
          <Input label="Account name" value={name} onChange={e => setName(e.target.value)} />
          <Select label="Type" value={type} onChange={e => setType(e.target.value as PersonalAccount['type'])}
            options={[{ value: 'bank', label: 'Bank' }, { value: 'cash', label: 'Cash' }, { value: 'wallet', label: 'Wallet' }, { value: 'investment', label: 'Investment' }]} />
          <MoneyInput label="Current balance" value={balance} onChange={setBalance} />
          <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-sm text-[#8888aa] bg-[#13131a] border border-dashed border-[#2a2a3a] rounded-xl py-10 px-6">{text}</div>
}
