'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Clapperboard } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { ROYALTY_SOURCE_LABELS, type PersonalFilmStake, type PersonalRoyalty } from '@/lib/types'

type Toast = ReturnType<typeof useToast>

export function FilmTab({ ownerId, stakes, royalties, onChange }: { ownerId: string; stakes: PersonalFilmStake[]; royalties: PersonalRoyalty[]; onChange: () => void }) {
  const toast = useToast()
  return (
    <div className="space-y-6">
      <StakesBlock ownerId={ownerId} rows={stakes} onChange={onChange} toast={toast} />
      <RoyaltiesBlock ownerId={ownerId} rows={royalties} onChange={onChange} toast={toast} />
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div><div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold text-white">{title}</h3>{action}</div>{children}</div>
}
function Empty({ text }: { text: string }) {
  return <div className="text-center text-sm text-[#8888aa] bg-[#13131a] border border-dashed border-[#2a2a3a] rounded-xl py-6 px-6">{text}</div>
}

function StakesBlock({ ownerId, rows, onChange, toast }: { ownerId: string; rows: PersonalFilmStake[]; onChange: () => void; toast: Toast }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalFilmStake | null>(null)
  const [film, setFilm] = useState('')
  const [entity, setEntity] = useState('')
  const [pct, setPct] = useState('')
  const [investment, setInvestment] = useState('')
  const [terms, setTerms] = useState('')
  const [status, setStatus] = useState<'active' | 'closed'>('active')
  const [saving, setSaving] = useState(false)
  const invested = rows.reduce((s, r) => s + Number(r.investment), 0)

  function openNew() { setEditing(null); setFilm(''); setEntity(''); setPct(''); setInvestment(''); setTerms(''); setStatus('active'); setOpen(true) }
  function openEdit(r: PersonalFilmStake) { setEditing(r); setFilm(r.film); setEntity(r.entity ?? ''); setPct(String(r.ownership_pct)); setInvestment(String(r.investment)); setTerms(r.profit_share_terms ?? ''); setStatus(r.status); setOpen(true) }

  async function save() {
    if (!film) { toast.error('Film required'); return }
    setSaving(true); const supabase = createClient()
    const payload = { film, entity: entity || null, ownership_pct: Number(pct || 0), investment: Number(investment || 0), profit_share_terms: terms || null, status }
    if (editing) { const { error } = await supabase.from('personal_film_stakes').update(payload).eq('id', editing.id); if (error) { toast.error("Couldn't save"); setSaving(false); return } await logAction('update', 'personal_film_stakes', editing.id) }
    else { const { data, error } = await supabase.from('personal_film_stakes').insert({ ...payload, owner_id: ownerId }).select().single(); if (error) { toast.error("Couldn't save"); setSaving(false); return } if (data) await logAction('create', 'personal_film_stakes', data.id) }
    setSaving(false); setOpen(false); toast.success('Saved'); onChange()
  }
  async function remove(r: PersonalFilmStake) { if (!confirm('Delete?')) return; const supabase = createClient(); await supabase.from('personal_film_stakes').delete().eq('id', r.id); await logAction('delete', 'personal_film_stakes', r.id); toast.success('Deleted'); onChange() }

  return (
    <Section title={`Film stakes (${formatCurrency(invested)} invested)`} action={<Button icon={Plus} onClick={openNew}>Add stake</Button>}>
      {rows.length === 0 ? <Empty text="Track your ownership % and investment across each film/SPV." /> : (
        <div className="space-y-2">{rows.map(r => (
          <div key={r.id} className="flex items-center justify-between bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-3">
            <div className="min-w-0"><div className="text-sm text-white font-medium">{r.film} <span className="text-[#8888aa] font-normal">· {r.ownership_pct}%{r.entity ? ` · ${r.entity}` : ''}</span></div>
              <div className="text-xs text-[#8888aa] mt-0.5">{r.status}{r.profit_share_terms ? ` · ${r.profit_share_terms}` : ''}</div></div>
            <div className="flex items-center gap-3 shrink-0"><span className="text-sm font-semibold text-white">{formatCurrency(Number(r.investment))}</span>
              <button onClick={() => openEdit(r)} className="text-[#8888aa] hover:text-white"><Pencil size={15} /></button>
              <button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button></div>
          </div>))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit stake' : 'Add film stake'}>
        <div className="space-y-3">
          <Input label="Film" value={film} onChange={e => setFilm(e.target.value)} />
          <Input label="Entity / SPV" value={entity} onChange={e => setEntity(e.target.value)} />
          <Input label="Ownership %" type="number" value={pct} onChange={e => setPct(e.target.value)} />
          <MoneyInput label="Your investment" value={investment} onChange={setInvestment} />
          <Textarea label="Profit-share terms" value={terms} onChange={e => setTerms(e.target.value)} />
          <Select label="Status" value={status} onChange={e => setStatus(e.target.value as 'active' | 'closed')} options={[{ value: 'active', label: 'Active' }, { value: 'closed', label: 'Closed' }]} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </Section>
  )
}

function RoyaltiesBlock({ ownerId, rows, onChange, toast }: { ownerId: string; rows: PersonalRoyalty[]; onChange: () => void; toast: Toast }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalRoyalty | null>(null)
  const [film, setFilm] = useState('')
  const [source, setSource] = useState<PersonalRoyalty['source']>('satellite')
  const [amount, setAmount] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [receivedDate, setReceivedDate] = useState('')
  const [status, setStatus] = useState<PersonalRoyalty['status']>('expected')
  const [saving, setSaving] = useState(false)
  const pending = rows.filter(r => r.status !== 'received').reduce((s, r) => s + Number(r.amount), 0)

  function openNew() { setEditing(null); setFilm(''); setSource('satellite'); setAmount(''); setExpectedDate(''); setReceivedDate(''); setStatus('expected'); setOpen(true) }
  function openEdit(r: PersonalRoyalty) { setEditing(r); setFilm(r.film); setSource(r.source); setAmount(String(r.amount)); setExpectedDate(r.expected_date ?? ''); setReceivedDate(r.received_date ?? ''); setStatus(r.status); setOpen(true) }

  async function save() {
    if (!film) { toast.error('Film required'); return }
    setSaving(true); const supabase = createClient()
    const payload = { film, source, amount: Number(amount || 0), expected_date: expectedDate || null, received_date: receivedDate || null, status }
    if (editing) { const { error } = await supabase.from('personal_royalties').update(payload).eq('id', editing.id); if (error) { toast.error("Couldn't save"); setSaving(false); return } await logAction('update', 'personal_royalties', editing.id) }
    else { const { data, error } = await supabase.from('personal_royalties').insert({ ...payload, owner_id: ownerId }).select().single(); if (error) { toast.error("Couldn't save"); setSaving(false); return } if (data) await logAction('create', 'personal_royalties', data.id) }
    setSaving(false); setOpen(false); toast.success('Saved'); onChange()
  }
  async function remove(r: PersonalRoyalty) { if (!confirm('Delete?')) return; const supabase = createClient(); await supabase.from('personal_royalties').delete().eq('id', r.id); await logAction('delete', 'personal_royalties', r.id); toast.success('Deleted'); onChange() }

  return (
    <Section title={`Royalties (${formatCurrency(pending)} pending)`} action={<Button icon={Plus} onClick={openNew}>Add royalty</Button>}>
      {rows.length === 0 ? <Empty text="Satellite / OTT / music shares dribble in for years — track what's due and what's landed." /> : (
        <div className="space-y-2">{rows.map(r => (
          <div key={r.id} className="flex items-center justify-between bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-3">
            <div className="min-w-0"><div className="text-sm text-white font-medium">{r.film} <span className="text-[#8888aa] font-normal">· {ROYALTY_SOURCE_LABELS[r.source]}</span></div>
              <div className="text-xs text-[#8888aa] mt-0.5">{r.status === 'received' ? `received ${r.received_date ? formatDate(r.received_date) : ''}` : r.expected_date ? `expected ${formatDate(r.expected_date)}` : 'no date'} · {r.status}</div></div>
            <div className="flex items-center gap-3 shrink-0"><span className={`text-sm font-semibold ${r.status === 'received' ? 'text-emerald-300' : r.status === 'overdue' ? 'text-red-300' : 'text-amber-300'}`}>{formatCurrency(Number(r.amount))}</span>
              <button onClick={() => openEdit(r)} className="text-[#8888aa] hover:text-white"><Pencil size={15} /></button>
              <button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button></div>
          </div>))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit royalty' : 'Add royalty'}>
        <div className="space-y-3">
          <Input label="Film" value={film} onChange={e => setFilm(e.target.value)} />
          <Select label="Source" value={source} onChange={e => setSource(e.target.value as PersonalRoyalty['source'])} options={Object.entries(ROYALTY_SOURCE_LABELS).map(([value, label]) => ({ value, label }))} />
          <MoneyInput label="Amount" value={amount} onChange={setAmount} />
          <Input label="Expected date" type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
          <Input label="Received date" type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
          <Select label="Status" value={status} onChange={e => setStatus(e.target.value as PersonalRoyalty['status'])} options={[{ value: 'expected', label: 'Expected' }, { value: 'received', label: 'Received' }, { value: 'overdue', label: 'Overdue' }]} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </Section>
  )
}
