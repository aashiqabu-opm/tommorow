'use client'

import { useState, useEffect, useCallback } from 'react'
import { Handshake, TrendingUp, Plus, Pencil, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

/* eslint-disable @typescript-eslint/no-explicit-any */
type SB = ReturnType<typeof createClient>
type Toast = ReturnType<typeof useToast>

interface Deal { id: string; kind: string; counterparty: string; territory?: string | null; mg_amount?: number | null; total_value?: number | null; status: string; received_amount?: number | null; received_date?: string | null; overflow_terms?: string | null; notes?: string | null }
interface Funding { id: string; kind: string; name: string; amount: number; equity_percent?: number | null; interest_rate?: number | null; status: string }

const KINDS = [['theatrical', 'Theatrical'], ['satellite', 'Satellite'], ['ott', 'OTT'], ['music', 'Music'], ['audio', 'Audio'], ['overseas', 'Overseas'], ['dubbing_rights', 'Dubbing rights'], ['other', 'Other']]
const KIND_LABEL = Object.fromEntries(KINDS)
const badge = (s: string) => <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/5 text-[#8888aa]">{s.replace(/_/g, ' ')}</span>
function Empty({ t }: { t: string }) { return <div className="text-center text-sm text-[#8888aa] bg-[#1a1a24] border border-dashed border-[#2a2a3a] rounded-lg py-8 px-4">{t}</div> }

export function ReleaseModule({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const toast = useToast(); const supabase = createClient()
  const [view, setView] = useState<'deals' | 'recovery'>('deals')
  const [deals, setDeals] = useState<Deal[]>([]); const [funding, setFunding] = useState<Funding[]>([])

  const load = useCallback(async () => {
    const [d, f] = await Promise.all([
      supabase.from('project_deals').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('project_funding').select('id, kind, name, amount, equity_percent, interest_rate, status').eq('project_id', projectId),
    ])
    setDeals((d.data ?? []) as Deal[]); setFunding((f.data ?? []) as Funding[])
  }, [projectId, supabase])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {([['deals', 'Rights & Deals', Handshake], ['recovery', 'Recovery', TrendingUp]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setView(id)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg ${view === id ? 'bg-white/10 text-white' : 'text-[#8888aa] hover:text-white'}`}><Icon size={13} /> {label}</button>
        ))}
      </div>
      {view === 'deals' && <Deals {...{ projectId, canEdit, rows: deals, onChange: load, supabase, toast }} />}
      {view === 'recovery' && <Recovery deals={deals} funding={funding} />}
    </div>
  )
}

function Deals({ projectId, canEdit, rows, onChange, supabase, toast }: any) {
  const [open, setOpen] = useState(false); const [ed, setEd] = useState<Deal | null>(null)
  const [f, setF] = useState<any>({ kind: 'theatrical', counterparty: '', territory: '', mg_amount: '', total_value: '', overflow_terms: '', status: 'negotiating', received_amount: '', received_date: '' })
  const totalExpected = rows.reduce((s: number, r: Deal) => s + Number(r.total_value ?? r.mg_amount ?? 0), 0)
  const totalReceived = rows.reduce((s: number, r: Deal) => s + Number(r.received_amount ?? 0), 0)

  function openNew() { setEd(null); setF({ kind: 'theatrical', counterparty: '', territory: '', mg_amount: '', total_value: '', overflow_terms: '', status: 'negotiating', received_amount: '', received_date: '' }); setOpen(true) }
  function openEd(r: Deal) { setEd(r); setF({ kind: r.kind, counterparty: r.counterparty, territory: r.territory ?? '', mg_amount: r.mg_amount ?? '', total_value: r.total_value ?? '', overflow_terms: r.overflow_terms ?? '', status: r.status, received_amount: r.received_amount ?? '', received_date: r.received_date ?? '' }); setOpen(true) }
  async function save() {
    if (!f.counterparty) { toast.error('Counterparty required'); return }
    const p = { kind: f.kind, counterparty: f.counterparty, territory: f.territory || null, mg_amount: f.mg_amount ? Number(f.mg_amount) : null, total_value: f.total_value ? Number(f.total_value) : null, overflow_terms: f.overflow_terms || null, status: f.status, received_amount: f.received_amount ? Number(f.received_amount) : 0, received_date: f.received_date || null }
    const { error } = ed ? await supabase.from('project_deals').update(p).eq('id', ed.id) : await supabase.from('project_deals').insert({ ...p, project_id: projectId })
    if (error) { toast.error("Couldn't save"); return }
    setOpen(false); toast.success('Saved'); onChange()
  }
  async function del(r: Deal) { if (!confirm('Delete?')) return; await supabase.from('project_deals').delete().eq('id', r.id); onChange() }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg p-3"><div className="text-[10px] uppercase tracking-wide text-[#8888aa]">Total deal value</div><div className="text-xl font-bold text-white mt-1">{formatCurrency(totalExpected)}</div></div>
        <div className="bg-[#1a1a24] border border-emerald-500/20 rounded-lg p-3"><div className="text-[10px] uppercase tracking-wide text-[#8888aa]">Received</div><div className="text-xl font-bold text-emerald-300 mt-1">{formatCurrency(totalReceived)}</div></div>
      </div>
      {canEdit && <div className="flex justify-end mb-3"><Button icon={Plus} onClick={openNew}>Add deal</Button></div>}
      {rows.length === 0 ? <Empty t="No rights deals yet. Track theatrical, satellite, OTT, music & overseas deals — MG, overflow and money received." /> : (
        <div className="space-y-2">{rows.map((r: Deal) => (
          <div key={r.id} className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3">
            <div className="min-w-0"><div className="text-sm text-white font-medium flex items-center gap-2">{badge(KIND_LABEL[r.kind] ?? r.kind)} {r.counterparty} {r.territory && <span className="text-[#8888aa] font-normal">· {r.territory}</span>} {badge(r.status)}</div>
              <div className="text-xs text-[#8888aa] mt-0.5">{r.mg_amount ? `MG ${formatCurrency(Number(r.mg_amount))}` : ''}{r.total_value ? ` · value ${formatCurrency(Number(r.total_value))}` : ''}{Number(r.received_amount) ? ` · received ${formatCurrency(Number(r.received_amount))}${r.received_date ? ` (${formatDate(r.received_date)})` : ''}` : ''}</div></div>
            {canEdit && <div className="flex items-center gap-3 shrink-0"><button onClick={() => openEd(r)} className="text-[#8888aa] hover:text-white"><Pencil size={15} /></button><button onClick={() => del(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button></div>}
          </div>))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={ed ? 'Edit deal' : 'Add rights deal'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><Select label="Rights" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} options={KINDS.map(([v, l]) => ({ value: v, label: l }))} /><Select label="Status" value={f.status} onChange={e => setF({ ...f, status: e.target.value })} options={['negotiating', 'agreed', 'signed', 'received', 'cancelled'].map(v => ({ value: v, label: v }))} /></div>
          <Input label="Counterparty" value={f.counterparty} onChange={e => setF({ ...f, counterparty: e.target.value })} placeholder="Distributor / channel / platform" />
          <Input label="Territory" value={f.territory} onChange={e => setF({ ...f, territory: e.target.value })} placeholder="Kerala / India / Worldwide" />
          <div className="grid grid-cols-2 gap-3"><MoneyInput label="MG / advance" value={String(f.mg_amount)} onChange={(v: string) => setF({ ...f, mg_amount: v })} /><MoneyInput label="Total value" value={String(f.total_value)} onChange={(v: string) => setF({ ...f, total_value: v })} /></div>
          <Textarea label="Overflow / terms" value={f.overflow_terms} onChange={e => setF({ ...f, overflow_terms: e.target.value })} />
          <div className="grid grid-cols-2 gap-3"><MoneyInput label="Received" value={String(f.received_amount)} onChange={(v: string) => setF({ ...f, received_amount: v })} /><Input label="Received date" type="date" value={f.received_date} onChange={e => setF({ ...f, received_date: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}

function Recovery({ deals, funding }: { deals: Deal[]; funding: Funding[] }) {
  const realized = deals.reduce((s, r) => s + Number(r.received_amount ?? 0), 0)
  const capital = funding.reduce((s, f) => s + Number(f.amount ?? 0), 0)
  const loans = funding.filter(f => f.kind === 'loan')
  const investors = funding.filter(f => f.kind === 'investor' || f.kind === 'opm')
  const loanPrincipal = loans.reduce((s, f) => s + Number(f.amount ?? 0), 0)
  // Indicative: after loan principal, distributable goes to equity by % share.
  const distributable = Math.max(0, realized - loanPrincipal)

  if (!funding.length && !deals.length) return <Empty t="Add funding sources (Funding tab) and rights deals to see the recovery waterfall." />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg p-3"><div className="text-[10px] uppercase text-[#8888aa]">Capital deployed</div><div className="text-lg font-bold text-white mt-1">{formatCurrency(capital)}</div></div>
        <div className="bg-[#1a1a24] border border-emerald-500/20 rounded-lg p-3"><div className="text-[10px] uppercase text-[#8888aa]">Realized (deals)</div><div className="text-lg font-bold text-emerald-300 mt-1">{formatCurrency(realized)}</div></div>
        <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg p-3"><div className="text-[10px] uppercase text-[#8888aa]">Net position</div><div className={`text-lg font-bold mt-1 ${realized - capital >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{formatCurrency(realized - capital)}</div></div>
      </div>
      <p className="text-[11px] text-[#8888aa]">Indicative waterfall: realized first repays loan principal ({formatCurrency(loanPrincipal)}), then {formatCurrency(distributable)} is shared among equity holders by their %. Interest, fees and contractual priorities not modelled — for guidance only.</p>
      {loans.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-white mb-1">Loans</div>
          <div className="space-y-1">{loans.map(l => (
            <div key={l.id} className="flex items-center justify-between text-xs bg-[#1a1a24] border border-[#2a2a3a] rounded px-3 py-2"><span className="text-white/90">{l.name}{l.interest_rate ? ` · ${l.interest_rate}%` : ''}</span><span className="text-white">{formatCurrency(Number(l.amount))} principal</span></div>
          ))}</div>
        </div>
      )}
      {investors.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-white mb-1">Equity holders</div>
          <div className="space-y-1">{investors.map(inv => { const pct = Number(inv.equity_percent ?? 0); const ret = distributable * (pct / 100); return (
            <div key={inv.id} className="flex items-center justify-between text-xs bg-[#1a1a24] border border-[#2a2a3a] rounded px-3 py-2">
              <span className="text-white/90">{inv.name} {inv.kind === 'opm' ? '(OPM)' : ''} · {pct}% · invested {formatCurrency(Number(inv.amount))}</span>
              <span className={ret >= Number(inv.amount) ? 'text-emerald-300' : 'text-white'}>~{formatCurrency(ret)} back</span>
            </div>
          ) })}</div>
        </div>
      )}
    </div>
  )
}
