'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, CalendarClock } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { TAX_KIND_LABELS, type PersonalTaxProfile, type PersonalTaxItem, type PersonalDeduction, type PersonalCapitalGain } from '@/lib/types'

type Toast = ReturnType<typeof useToast>

interface Props {
  ownerId: string
  profile: PersonalTaxProfile | null
  items: PersonalTaxItem[]
  deductions: PersonalDeduction[]
  gains: PersonalCapitalGain[]
  onChange: () => void
}

// Current Indian FY label, e.g. "2026-27" (FY starts 1 April).
function currentFY(): string {
  const d = new Date(); const y = d.getFullYear(); const startY = d.getMonth() >= 3 ? y : y - 1
  return `${startY}-${String((startY + 1) % 100).padStart(2, '0')}`
}

export function TaxTab({ ownerId, profile, items, deductions, gains, onChange }: Props) {
  const toast = useToast()
  return (
    <div className="space-y-6">
      <ProfileBlock ownerId={ownerId} profile={profile} onChange={onChange} toast={toast} />
      <TaxItemsBlock ownerId={ownerId} items={items} onChange={onChange} toast={toast} />
      <DeductionsBlock ownerId={ownerId} rows={deductions} onChange={onChange} toast={toast} />
      <GainsBlock ownerId={ownerId} rows={gains} onChange={onChange} toast={toast} />
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold text-white">{title}</h3>{action}</div>
      {children}
    </div>
  )
}

function ProfileBlock({ ownerId, profile, onChange, toast }: { ownerId: string; profile: PersonalTaxProfile | null; onChange: () => void; toast: Toast }) {
  const [pan, setPan] = useState(profile?.pan ?? '')
  const [regime, setRegime] = useState<'old' | 'new'>(profile?.regime ?? 'new')
  const [saving, setSaving] = useState(false)
  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('personal_tax_profile').upsert({ owner_id: ownerId, pan: pan || null, regime, fy: currentFY(), updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) { toast.error("Couldn't save"); return }
    toast.success('Tax profile saved'); onChange()
  }
  return (
    <Section title="Tax profile">
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-lg p-4 flex flex-wrap items-end gap-3">
        <Input label="PAN" value={pan} onChange={e => setPan(e.target.value.toUpperCase())} className="w-40" placeholder="ABCDE1234F" />
        <Select label="Regime" value={regime} onChange={e => setRegime(e.target.value as 'old' | 'new')} options={[{ value: 'new', label: 'New regime' }, { value: 'old', label: 'Old regime' }]} />
        <div className="text-xs text-[#8888aa] pb-2">FY {currentFY()}</div>
        <Button onClick={save} loading={saving}>Save</Button>
      </div>
    </Section>
  )
}

function TaxItemsBlock({ ownerId, items, onChange, toast }: { ownerId: string; items: PersonalTaxItem[]; onChange: () => void; toast: Toast }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalTaxItem | null>(null)
  const [kind, setKind] = useState<PersonalTaxItem['kind']>('advance_tax')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<PersonalTaxItem['status']>('pending')
  const [saving, setSaving] = useState(false)
  const fy = currentFY()

  function openNew() { setEditing(null); setKind('advance_tax'); setLabel(''); setAmount(''); setDueDate(''); setStatus('pending'); setOpen(true) }
  function openEdit(r: PersonalTaxItem) { setEditing(r); setKind(r.kind); setLabel(r.label); setAmount(String(r.amount)); setDueDate(r.due_date ?? ''); setStatus(r.status); setOpen(true) }

  async function save() {
    if (!label) { toast.error('Label required'); return }
    setSaving(true); const supabase = createClient()
    const payload = { kind, label, amount: Number(amount || 0), due_date: dueDate || null, status, fy }
    if (editing) { const { error } = await supabase.from('personal_tax_items').update(payload).eq('id', editing.id); if (error) { toast.error("Couldn't save"); setSaving(false); return } await logAction('update', 'personal_tax_items', editing.id) }
    else { const { data, error } = await supabase.from('personal_tax_items').insert({ ...payload, owner_id: ownerId }).select().single(); if (error) { toast.error("Couldn't save"); setSaving(false); return } if (data) await logAction('create', 'personal_tax_items', data.id) }
    setSaving(false); setOpen(false); toast.success('Saved'); onChange()
  }
  async function remove(r: PersonalTaxItem) { if (!confirm('Delete?')) return; const supabase = createClient(); await supabase.from('personal_tax_items').delete().eq('id', r.id); await logAction('delete', 'personal_tax_items', r.id); toast.success('Deleted'); onChange() }

  async function generateAdvanceSchedule() {
    const [sy] = fy.split('-').map(Number)
    const sched = [
      { label: `Advance tax — 1st installment (15%)`, due: `${sy}-06-15` },
      { label: `Advance tax — 2nd installment (45% cum.)`, due: `${sy}-09-15` },
      { label: `Advance tax — 3rd installment (75% cum.)`, due: `${sy}-12-15` },
      { label: `Advance tax — 4th installment (100%)`, due: `${sy + 1}-03-15` },
    ]
    const supabase = createClient()
    const rows = sched.map(s => ({ owner_id: ownerId, kind: 'advance_tax', label: s.label, due_date: s.due, fy, amount: 0, status: 'pending' }))
    const { error } = await supabase.from('personal_tax_items').insert(rows)
    if (error) { toast.error("Couldn't generate"); return }
    toast.success('Advance-tax schedule added'); onChange()
  }

  return (
    <Section title="Tax calendar" action={
      <div className="flex gap-2">
        <Button variant="ghost" icon={CalendarClock} onClick={generateAdvanceSchedule}>Generate advance-tax</Button>
        <Button icon={Plus} onClick={openNew}>Add</Button>
      </div>
    }>
      {items.length === 0 ? <Empty text="No tax items. Use 'Generate advance-tax' for the standard 4 installment dates." /> : (
        <div className="space-y-2">
          {items.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-3">
              <div><div className="text-sm text-white font-medium">{r.label}</div>
                <div className="text-xs text-[#8888aa] mt-0.5">{TAX_KIND_LABELS[r.kind]}{r.due_date ? ` · due ${formatDate(r.due_date)}` : ''} · {r.status}</div></div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${r.status === 'pending' ? 'text-amber-300' : 'text-[#8888aa]'}`}>{r.amount ? formatCurrency(Number(r.amount)) : '—'}</span>
                <button onClick={() => openEdit(r)} className="text-[#8888aa] hover:text-white"><Pencil size={15} /></button>
                <button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit tax item' : 'Add tax item'}>
        <div className="space-y-3">
          <Select label="Kind" value={kind} onChange={e => setKind(e.target.value as PersonalTaxItem['kind'])} options={Object.entries(TAX_KIND_LABELS).map(([value, label]) => ({ value, label }))} />
          <Input label="Label" value={label} onChange={e => setLabel(e.target.value)} />
          <MoneyInput label="Amount" value={amount} onChange={setAmount} />
          <Input label="Due date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          <Select label="Status" value={status} onChange={e => setStatus(e.target.value as PersonalTaxItem['status'])} options={[{ value: 'pending', label: 'Pending' }, { value: 'paid', label: 'Paid' }, { value: 'filed', label: 'Filed' }]} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </Section>
  )
}

function DeductionsBlock({ ownerId, rows, onChange, toast }: { ownerId: string; rows: PersonalDeduction[]; onChange: () => void; toast: Toast }) {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState('80C')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const total = rows.reduce((s, r) => s + Number(r.amount), 0)
  async function save() {
    if (!label) { toast.error('Label required'); return }
    setSaving(true); const supabase = createClient()
    const { data, error } = await supabase.from('personal_deductions').insert({ owner_id: ownerId, section, label, amount: Number(amount || 0), fy: currentFY() }).select().single()
    setSaving(false); if (error) { toast.error("Couldn't save"); return }
    if (data) await logAction('create', 'personal_deductions', data.id)
    setOpen(false); setLabel(''); setAmount(''); toast.success('Added'); onChange()
  }
  async function remove(r: PersonalDeduction) { const supabase = createClient(); await supabase.from('personal_deductions').delete().eq('id', r.id); await logAction('delete', 'personal_deductions', r.id); onChange() }
  return (
    <Section title={`Deductions (₹${total.toLocaleString('en-IN')})`} action={<Button icon={Plus} onClick={() => setOpen(true)}>Add</Button>}>
      {rows.length === 0 ? <Empty text="Track 80C / 80D / home-loan interest etc. so nothing's left unclaimed." /> : (
        <div className="space-y-2">{rows.map(r => (
          <div key={r.id} className="flex items-center justify-between bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-2.5">
            <div className="text-sm text-white">{r.label} <span className="text-[#8888aa]">· {r.section}</span></div>
            <div className="flex items-center gap-3"><span className="text-sm font-semibold text-white">{formatCurrency(Number(r.amount))}</span><button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button></div>
          </div>))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add deduction">
        <div className="space-y-3">
          <Select label="Section" value={section} onChange={e => setSection(e.target.value)} options={['80C', '80D', '80CCD(1B)', 'Home-loan interest', '80G', 'Other'].map(v => ({ value: v, label: v }))} />
          <Input label="Label" value={label} onChange={e => setLabel(e.target.value)} placeholder="LIC premium / ELSS / etc." />
          <MoneyInput label="Amount" value={amount} onChange={setAmount} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </Section>
  )
}

function GainsBlock({ ownerId, rows, onChange, toast }: { ownerId: string; rows: PersonalCapitalGain[]; onChange: () => void; toast: Toast }) {
  const [open, setOpen] = useState(false)
  const [asset, setAsset] = useState('')
  const [buyAmount, setBuyAmount] = useState('')
  const [sellAmount, setSellAmount] = useState('')
  const [buyDate, setBuyDate] = useState('')
  const [sellDate, setSellDate] = useState('')
  const [gainType, setGainType] = useState<'LTCG' | 'STCG'>('LTCG')
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!asset) { toast.error('Asset required'); return }
    setSaving(true); const supabase = createClient()
    const { data, error } = await supabase.from('personal_capital_gains').insert({ owner_id: ownerId, asset, buy_amount: Number(buyAmount || 0), sell_amount: Number(sellAmount || 0), buy_date: buyDate || null, sell_date: sellDate || null, gain_type: gainType }).select().single()
    setSaving(false); if (error) { toast.error("Couldn't save"); return }
    if (data) await logAction('create', 'personal_capital_gains', data.id)
    setOpen(false); setAsset(''); setBuyAmount(''); setSellAmount(''); toast.success('Added'); onChange()
  }
  async function remove(r: PersonalCapitalGain) { const supabase = createClient(); await supabase.from('personal_capital_gains').delete().eq('id', r.id); await logAction('delete', 'personal_capital_gains', r.id); onChange() }
  return (
    <Section title="Capital gains" action={<Button icon={Plus} onClick={() => setOpen(true)}>Add</Button>}>
      {rows.length === 0 ? <Empty text="Log property / equity sales to track LTCG vs STCG." /> : (
        <div className="space-y-2">{rows.map(r => { const gain = Number(r.sell_amount) - Number(r.buy_amount); return (
          <div key={r.id} className="flex items-center justify-between bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-2.5">
            <div className="text-sm text-white">{r.asset} <span className="text-[#8888aa]">· {r.gain_type}</span></div>
            <div className="flex items-center gap-3"><span className={`text-sm font-semibold ${gain >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{gain >= 0 ? '+' : ''}{formatCurrency(gain)}</span><button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button></div>
          </div>) })}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add capital gain">
        <div className="space-y-3">
          <Input label="Asset" value={asset} onChange={e => setAsset(e.target.value)} placeholder="Property / shares / MF" />
          <MoneyInput label="Buy amount" value={buyAmount} onChange={setBuyAmount} />
          <Input label="Buy date" type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} />
          <MoneyInput label="Sell amount" value={sellAmount} onChange={setSellAmount} />
          <Input label="Sell date" type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} />
          <Select label="Gain type" value={gainType} onChange={e => setGainType(e.target.value as 'LTCG' | 'STCG')} options={[{ value: 'LTCG', label: 'Long-term (LTCG)' }, { value: 'STCG', label: 'Short-term (STCG)' }]} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </Section>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="text-center text-sm text-[#8888aa] bg-[#13131a] border border-dashed border-[#2a2a3a] rounded-xl py-6 px-6">{text}</div>
}
