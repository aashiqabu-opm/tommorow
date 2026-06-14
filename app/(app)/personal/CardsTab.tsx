'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, CreditCard, Mail, RefreshCw, Loader2, Receipt, Send } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { PersonalCard, PersonalTransaction } from '@/lib/types'

type Toast = ReturnType<typeof useToast>
const thisMonth = () => new Date().toISOString().slice(0, 7)

export function CardsTab({ ownerId, cards, txns, onChange }: { ownerId: string; cards: PersonalCard[]; txns: PersonalTransaction[]; onChange: () => void }) {
  const toast = useToast()
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  async function syncNow() {
    setSyncing(true)
    try {
      const res = await fetch('/api/cron/gmail-sync', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || 'Sync failed'); return }
      toast.success(`Synced: ${d.alerts ?? 0} alerts, ${d.receipts ?? 0} receipts, ${d.stmtLines ?? 0} statement lines`)
      router.refresh()
    } catch { toast.error('Sync failed — try again') }
    finally { setSyncing(false) }
  }

  const month = thisMonth()
  // Exclude reconciled duplicates so spend isn't double-counted.
  const debits = txns.filter(t => t.direction === 'debit' && !t.dup_of)
  const monthSpend = debits.filter(t => t.txn_date.startsWith(month)).reduce((s, t) => s + Number(t.amount), 0)
  const dupCount = txns.filter(t => t.dup_of).length
  // This week (last 7 days)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const weekSpend = debits.filter(t => t.txn_date >= weekAgo).reduce((s, t) => s + Number(t.amount), 0)
  // Last 6 months, split
  const monthlySplit: { label: string; key: string; total: number }[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
    const key = d.toISOString().slice(0, 7)
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    monthlySplit.push({ label, key, total: debits.filter(t => t.txn_date.startsWith(key)).reduce((s, t) => s + Number(t.amount), 0) })
  }
  const fmtBig = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

  return (
    <div className="space-y-6">
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-lg p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-[#8888aa]">
          <Mail size={14} className="text-[#f5b301]" /> Auto-imported from Gmail monthly — bank/card alerts, statements (incl. password-protected PDFs) & merchant receipts. Duplicates auto-reconciled{dupCount ? ` (${dupCount} matched)` : ''}.
        </div>
        <Button variant="ghost" icon={syncing ? undefined : RefreshCw} onClick={syncNow} disabled={syncing}>
          {syncing ? <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Syncing…</span> : 'Sync now'}
        </Button>
      </div>

      {/* Prominent expense totals */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-1 bg-gradient-to-br from-[#1a1a24] to-[#13131a] border border-[#f5b301]/30 rounded-2xl p-6 flex flex-col justify-center">
          <div className="text-[11px] uppercase tracking-[0.15em] text-[#8888aa]">Spent this month</div>
          <div className="text-4xl lg:text-5xl font-bold text-white mt-2">{fmtBig(monthSpend)}</div>
          <div className="text-sm text-[#8888aa] mt-2">This week: <span className="text-white font-medium">{fmtBig(weekSpend)}</span></div>
        </div>
        <div className="md:col-span-2 bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
          <div className="text-[11px] uppercase tracking-[0.15em] text-[#8888aa] mb-3">Monthly spend (last 6 months)</div>
          <div className="space-y-2">
            {(() => { const max = Math.max(1, ...monthlySplit.map(m => m.total)); return monthlySplit.map(m => (
              <div key={m.key} className="flex items-center gap-3">
                <div className="w-10 text-xs text-[#8888aa] shrink-0">{m.label}</div>
                <div className="flex-1 h-5 bg-[#1a1a24] rounded overflow-hidden"><div className="h-full bg-[#f5b301]/70 rounded" style={{ width: `${(m.total / max) * 100}%` }} /></div>
                <div className="w-24 text-right text-sm text-white shrink-0">{fmtBig(m.total)}</div>
              </div>
            )) })()}
          </div>
        </div>
      </div>
      <GstBlock ownerId={ownerId} rows={txns} onChange={onChange} toast={toast} />
      <CardsBlock ownerId={ownerId} rows={cards} onChange={onChange} toast={toast} />
      <TxnsBlock ownerId={ownerId} rows={txns} cards={cards} monthSpend={monthSpend} onChange={onChange} toast={toast} />
    </div>
  )
}

// GST input credits found in receipts — review and push to the accounts dept.
function GstBlock({ ownerId, rows, onChange, toast }: { ownerId: string; rows: PersonalTransaction[]; onChange: () => void; toast: Toast }) {
  const [busy, setBusy] = useState<string | null>(null)
  const eligible = rows.filter(r => r.gst_eligible && !r.sent_to_accounts)
  const sent = rows.filter(r => r.gst_eligible && r.sent_to_accounts).length
  const inputTotal = eligible.reduce((s, r) => s + Number(r.gst_amount ?? 0), 0)
  if (!eligible.length && !sent) return null

  async function send(r: PersonalTransaction) {
    setBusy(r.id)
    const supabase = createClient()
    const { error: e1 } = await supabase.from('gst_inputs').insert({
      source_owner: ownerId, vendor: r.merchant, gstin: r.gstin, invoice_no: r.invoice_no, invoice_date: r.txn_date,
      taxable_value: r.taxable_value, gst_amount: r.gst_amount, total: r.amount, snapshot_url: r.snapshot_url, category: r.category,
    })
    if (e1) { toast.error("Couldn't send to accounts"); setBusy(null); return }
    await supabase.from('personal_transactions').update({ sent_to_accounts: true }).eq('id', r.id)
    toast.success('Sent to accounts'); setBusy(null); onChange()
  }
  async function sendAll() { for (const r of eligible) await send(r) }

  return (
    <div className="bg-[#13131a] border border-[#f5b301]/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Receipt size={15} className="text-[#f5b301]" /> GST inputs for filing {eligible.length ? `· ${formatCurrency(inputTotal)} credit` : ''}</h3>
        {eligible.length > 1 && <Button onClick={sendAll}>Send all to accounts</Button>}
      </div>
      {eligible.length === 0 ? (
        <p className="text-xs text-[#8888aa]">All GST receipts sent to accounts{sent ? ` (${sent})` : ''}. New ones from vendor tax-invoices will appear here.</p>
      ) : (
        <div className="space-y-2">
          {eligible.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-sm text-white truncate">{r.merchant ?? 'Vendor'} <span className="text-[#8888aa]">· GSTIN {r.gstin}</span></div>
                <div className="text-xs text-[#8888aa] mt-0.5">{formatDate(r.txn_date)}{r.invoice_no ? ` · inv ${r.invoice_no}` : ''} · taxable {formatCurrency(Number(r.taxable_value ?? 0))} · GST {formatCurrency(Number(r.gst_amount ?? 0))}{r.snapshot_url ? ' · 📎 snapshot' : ''}</div>
              </div>
              <Button onClick={() => send(r)} loading={busy === r.id} icon={Send}>Send</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <div><div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold text-white">{title}</h3>{action}</div>{children}</div>
}
function Empty({ text }: { text: string }) {
  return <div className="text-center text-sm text-[#8888aa] bg-[#13131a] border border-dashed border-[#2a2a3a] rounded-xl py-6 px-6">{text}</div>
}

function CardsBlock({ ownerId, rows, onChange, toast }: { ownerId: string; rows: PersonalCard[]; onChange: () => void; toast: Toast }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalCard | null>(null)
  const [issuer, setIssuer] = useState('')
  const [last4, setLast4] = useState('')
  const [limit, setLimit] = useState('')
  const [stmtDay, setStmtDay] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [saving, setSaving] = useState(false)

  function openNew() { setEditing(null); setIssuer(''); setLast4(''); setLimit(''); setStmtDay(''); setDueDay(''); setOpen(true) }
  function openEdit(r: PersonalCard) { setEditing(r); setIssuer(r.issuer); setLast4(r.last4 ?? ''); setLimit(r.card_limit ? String(r.card_limit) : ''); setStmtDay(r.statement_day ? String(r.statement_day) : ''); setDueDay(r.due_day ? String(r.due_day) : ''); setOpen(true) }

  async function save() {
    if (!issuer) { toast.error('Issuer required'); return }
    setSaving(true); const supabase = createClient()
    const payload = { issuer, last4: last4 || null, card_limit: limit ? Number(limit) : null, statement_day: stmtDay ? Number(stmtDay) : null, due_day: dueDay ? Number(dueDay) : null }
    if (editing) { const { error } = await supabase.from('personal_cards').update(payload).eq('id', editing.id); if (error) { toast.error("Couldn't save"); setSaving(false); return } await logAction('update', 'personal_cards', editing.id) }
    else { const { data, error } = await supabase.from('personal_cards').insert({ ...payload, owner_id: ownerId }).select().single(); if (error) { toast.error("Couldn't save"); setSaving(false); return } if (data) await logAction('create', 'personal_cards', data.id) }
    setSaving(false); setOpen(false); toast.success('Saved'); onChange()
  }
  async function remove(r: PersonalCard) { if (!confirm('Delete?')) return; const supabase = createClient(); await supabase.from('personal_cards').delete().eq('id', r.id); await logAction('delete', 'personal_cards', r.id); toast.success('Deleted'); onChange() }

  return (
    <Section title="Cards" action={<Button icon={Plus} onClick={openNew}>Add card</Button>}>
      {rows.length === 0 ? <Empty text="Add your credit cards — issuer, limit, statement & due days." /> : (
        <div className="space-y-2">{rows.map(r => (
          <div key={r.id} className="flex items-center justify-between bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-3">
            <div className="flex items-center gap-3"><CreditCard size={18} className="text-[#8888aa]" />
              <div><div className="text-sm text-white font-medium">{r.issuer}{r.last4 ? ` ••${r.last4}` : ''}</div>
                <div className="text-xs text-[#8888aa] mt-0.5">{r.card_limit ? `Limit ${formatCurrency(Number(r.card_limit))}` : ''}{r.due_day ? ` · due day ${r.due_day}` : ''}</div></div></div>
            <div className="flex items-center gap-3"><button onClick={() => openEdit(r)} className="text-[#8888aa] hover:text-white"><Pencil size={15} /></button><button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button></div>
          </div>))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit card' : 'Add card'}>
        <div className="space-y-3">
          <Input label="Issuer / name" value={issuer} onChange={e => setIssuer(e.target.value)} placeholder="HDFC Regalia / SBI Card" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Last 4 digits" value={last4} onChange={e => setLast4(e.target.value)} maxLength={4} />
            <MoneyInput label="Credit limit" value={limit} onChange={setLimit} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Statement day" type="number" value={stmtDay} onChange={e => setStmtDay(e.target.value)} />
            <Input label="Due day" type="number" value={dueDay} onChange={e => setDueDay(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </Section>
  )
}

function TxnsBlock({ ownerId, rows, cards, monthSpend, onChange, toast }: { ownerId: string; rows: PersonalTransaction[]; cards: PersonalCard[]; monthSpend: number; onChange: () => void; toast: Toast }) {
  const [open, setOpen] = useState(false)
  const [source, setSource] = useState<'card' | 'bank'>('card')
  const [account, setAccount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [merchant, setMerchant] = useState('')
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState<'debit' | 'credit'>('debit')
  const [category, setCategory] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!amount) { toast.error('Amount required'); return }
    setSaving(true); const supabase = createClient()
    const { data, error } = await supabase.from('personal_transactions').insert({ owner_id: ownerId, source, account_label: account || null, txn_date: date, merchant: merchant || null, amount: Number(amount), direction, category: category || null }).select().single()
    setSaving(false); if (error) { toast.error("Couldn't save"); return }
    if (data) await logAction('create', 'personal_transactions', data.id)
    setOpen(false); setMerchant(''); setAmount(''); setCategory(''); toast.success('Added'); onChange()
  }
  async function remove(r: PersonalTransaction) { const supabase = createClient(); await supabase.from('personal_transactions').delete().eq('id', r.id); await logAction('delete', 'personal_transactions', r.id); onChange() }

  return (
    <Section title={`Transactions · ${formatCurrency(monthSpend)} spent this month`} action={<Button icon={Plus} onClick={() => setOpen(true)}>Add</Button>}>
      {rows.length === 0 ? <Empty text="No transactions yet. These will auto-import from your bank/card emails once Gmail is connected." /> : (
        <div className="space-y-2">{rows.slice(0, 80).map(r => {
          const isDup = !!r.dup_of
          return (
          <div key={r.id} className={`flex items-center justify-between border rounded-lg px-4 py-2.5 ${isDup ? 'bg-[#0f0f15] border-[#1f1f2a] opacity-60' : 'bg-[#13131a] border-[#2a2a3a]'}`}>
            <div className="min-w-0">
              <div className="text-sm text-white truncate flex items-center gap-2">
                {r.merchant ?? r.account_label ?? r.source}
                {r.category ? <span className="text-[#8888aa] font-normal">· {r.category}</span> : ''}
                {r.origin && r.origin !== 'manual' && <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/5 text-[#8888aa]">{r.origin}</span>}
                {isDup && <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">duplicate</span>}
              </div>
              <div className="text-xs text-[#8888aa] mt-0.5">{formatDate(r.txn_date)} · {r.source}{r.account_label ? ` · ${r.account_label}` : ''}</div>
            </div>
            <div className="flex items-center gap-3 shrink-0"><span className={`text-sm font-semibold ${isDup ? 'text-[#8888aa] line-through' : r.direction === 'credit' ? 'text-emerald-300' : 'text-white'}`}>{r.direction === 'credit' ? '+' : '−'}{formatCurrency(Number(r.amount))}</span>
              <button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button></div>
          </div>)
        })}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add transaction">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Source" value={source} onChange={e => setSource(e.target.value as 'card' | 'bank')} options={[{ value: 'card', label: 'Card' }, { value: 'bank', label: 'Bank' }]} />
            <Select label="Direction" value={direction} onChange={e => setDirection(e.target.value as 'debit' | 'credit')} options={[{ value: 'debit', label: 'Debit (spent)' }, { value: 'credit', label: 'Credit (received)' }]} />
          </div>
          <Input label="Account / card" value={account} onChange={e => setAccount(e.target.value)} placeholder="HDFC ••1234" list="cards-list" />
          <datalist id="cards-list">{cards.map(c => <option key={c.id} value={`${c.issuer}${c.last4 ? ' ••' + c.last4 : ''}`} />)}</datalist>
          <Input label="Merchant / description" value={merchant} onChange={e => setMerchant(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Amount" value={amount} onChange={setAmount} />
            <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <Input label="Category" value={category} onChange={e => setCategory(e.target.value)} placeholder="Fuel / dining / shopping" />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </Section>
  )
}
