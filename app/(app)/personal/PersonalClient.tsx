'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Plus, Pencil, Trash2, Building2, ShieldAlert, Wallet, ArrowLeftRight, Receipt, Clapperboard, FileText, RefreshCw, Car, HeartPulse, CreditCard, ArrowLeft } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState<Tab | null>(null)

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

  const BLOCK_ITEMS = [
    {
      id: 'ledger' as const,
      title: 'Founder ↔ Company Ledger',
      description: 'Capital contributions, personal loans, and repayments between you and the company.',
      icon: ArrowLeftRight,
      summary: owedByCompany >= 0 ? `Company owes you ${formatCurrency(owedByCompany)}` : `You owe company ${formatCurrency(Math.abs(owedByCompany))}`,
    },
    {
      id: 'guarantees' as const,
      title: 'Personal Guarantees',
      description: 'Guarantees given to banks or third parties on behalf of company projects.',
      icon: ShieldAlert,
      summary: exposure > 0 ? `Active exposure: ${formatCurrency(exposure)}` : 'No active exposure',
    },
    {
      id: 'accounts' as const,
      title: 'Personal Bank Accounts',
      description: 'Private savings and current accounts details for personal transaction monitoring.',
      icon: Wallet,
      summary: `${accounts.length} linked account(s) · Bal: ${formatCurrency(cash)}`,
    },
    {
      id: 'recurring' as const,
      title: 'Monthly Recurring Bills',
      description: 'Track fixed monthly bills, EMIs, insurance premiums, and utilities with autopay status.',
      icon: RefreshCw,
      summary: `${recurring.filter(r => r.active).length} active · ${recurring.filter(r => r.autopay).length} autopay`,
    },
    {
      id: 'vehicles' as const,
      title: 'Vehicles & Registration',
      description: 'Keep track of vehicle documents, tax renewals, insurance, and fitness certificates.',
      icon: Car,
      summary: `${vehicles.length} vehicle(s) registered`,
    },
    {
      id: 'health' as const,
      title: 'Health & Life Insurance',
      description: 'Manage family health insurance policies, policy numbers, premium dues, and renewals.',
      icon: HeartPulse,
      summary: `${policies.length} active insurance policy/policies`,
    },
    {
      id: 'cards' as const,
      title: 'Cards & Personal Spend',
      description: 'Monitor credit/debit card limits, statement cycles, and verify manual or automatic charges.',
      icon: CreditCard,
      summary: `${cards.length} card(s) · ${transactions.length} recent transactions`,
    },
    {
      id: 'tax' as const,
      title: 'Tax & Compliance',
      description: 'Manage personal tax profile, advance tax installments, capital gains, and ITR documents.',
      icon: Receipt,
      summary: `${taxItems.filter(t => t.status === 'pending').length} pending tax items`,
    },
    {
      id: 'film' as const,
      title: 'Film Stakes & Royalties',
      description: 'Review personal equity/profit sharing stakes in releases and platform royalties.',
      icon: Clapperboard,
      summary: royaltiesPending > 0 ? `₹${royaltiesPending.toLocaleString()} pending royalties` : 'All royalties received',
    },
    {
      id: 'legal' as const,
      title: 'Legal Document Vault',
      description: 'Secure personal documents repository for agreements, legal notices, registrations, and certificates.',
      icon: FileText,
      summary: `${documents.length} document(s) saved`,
    },
  ]

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

      {/* Workspace Hub Grid or Active Tab Content */}
      {!activeTab ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BLOCK_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="bg-[#13131a] border border-[#2a2a3a] hover:border-white/20 hover:bg-[#181824] p-5 rounded-2xl text-left transition-all group flex flex-col h-full focus:outline-none focus:ring-1 focus:ring-[#f5b301] cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 group-hover:bg-[#f5b301]/10 group-hover:border-[#f5b301]/30 transition-all">
                  <Icon size={18} className="text-[#8888aa] group-hover:text-[#f5b301] transition-all" />
                </div>
                <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-[#f5b301] transition-all">{item.title}</h3>
                <p className="text-[11px] text-[#8888aa] mb-4 flex-grow line-clamp-2">{item.description}</p>
                <div className="mt-auto pt-2.5 border-t border-[#2a2a3a] w-full flex justify-between items-center text-[10px]">
                  <span className="text-[#5a5a7a] uppercase tracking-wider font-semibold">Status</span>
                  <span className="font-semibold text-white/90 truncate max-w-[200px]">{item.summary}</span>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-[#2a2a3a]">
            <button
              onClick={() => setActiveTab(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1a1a24] border border-[#2a2a3a] rounded-lg text-[#8888aa] hover:text-white transition-all cursor-pointer"
            >
              <ArrowLeft size={13} /> Back to Hub
            </button>
            <span className="text-[#5a5a7a] text-xs">/</span>
            <span className="text-white font-semibold text-sm flex items-center gap-2">
              {BLOCK_ITEMS.find(item => item.id === activeTab)?.title}
            </span>
          </div>

          {activeTab === 'ledger' && <LedgerTab ownerId={ownerId} rows={ledger} onChange={() => router.refresh()} toast={toast} />}
          {activeTab === 'guarantees' && <GuaranteesTab ownerId={ownerId} rows={guarantees} onChange={() => router.refresh()} toast={toast} />}
          {activeTab === 'accounts' && <AccountsTab ownerId={ownerId} rows={accounts} onChange={() => router.refresh()} toast={toast} />}
          {activeTab === 'recurring' && <RecurringTab ownerId={ownerId} rows={recurring} onChange={() => router.refresh()} />}
          {activeTab === 'vehicles' && <VehicleTab ownerId={ownerId} rows={vehicles} onChange={() => router.refresh()} />}
          {activeTab === 'health' && <HealthTab ownerId={ownerId} rows={policies} onChange={() => router.refresh()} />}
          {activeTab === 'cards' && <CardsTab ownerId={ownerId} cards={cards} txns={transactions} onChange={() => router.refresh()} />}
          {activeTab === 'tax' && <TaxTab ownerId={ownerId} profile={taxProfile} items={taxItems} deductions={deductions} gains={gains} onChange={() => router.refresh()} />}
          {activeTab === 'film' && <FilmTab ownerId={ownerId} stakes={stakes} royalties={royalties} onChange={() => router.refresh()} />}
          {activeTab === 'legal' && <LegalTab ownerId={ownerId} rows={documents} onChange={() => router.refresh()} />}
        </div>
      )}
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
  const [bankName, setBankName] = useState('')
  const [accountNo, setAccountNo] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [branch, setBranch] = useState('')
  const [saving, setSaving] = useState(false)

  function openNew() { setEditing(null); setName(''); setType('bank'); setBalance(''); setNotes(''); setBankName(''); setAccountNo(''); setIfsc(''); setBranch(''); setOpen(true) }
  function openEdit(r: PersonalAccount) { setEditing(r); setName(r.name); setType(r.type); setBalance(String(r.balance)); setNotes(r.notes ?? ''); setBankName(r.bank_name ?? ''); setAccountNo(r.account_no ?? ''); setIfsc(r.ifsc ?? ''); setBranch(r.branch ?? ''); setOpen(true) }

  async function save() {
    if (!name) { toast.error('Name is required'); return }
    setSaving(true)
    const supabase = createClient()
    const payload = { name, type, balance: Number(balance || 0), notes: notes || null, bank_name: bankName || null, account_no: accountNo || null, ifsc: ifsc || null, branch: branch || null }
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
                <div className="text-sm text-white font-medium">{r.name}{r.bank_name ? ` · ${r.bank_name}` : ''}</div>
                <div className="text-xs text-[#8888aa] mt-0.5">{TYPE_LABELS[r.type]}{r.account_no ? ` · A/c ${r.account_no}` : ''}{r.ifsc ? ` · ${r.ifsc}` : ''}{r.branch ? ` · ${r.branch}` : ''}{r.notes ? ` · ${r.notes}` : ''}</div>
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
          {type === 'bank' && (
            <>
              <Input label="Bank name" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="HDFC Bank" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Account number" value={accountNo} onChange={e => setAccountNo(e.target.value)} />
                <Input label="IFSC code" value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" />
              </div>
              <Input label="Branch" value={branch} onChange={e => setBranch(e.target.value)} placeholder="MG Road, Kochi" />
            </>
          )}
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
