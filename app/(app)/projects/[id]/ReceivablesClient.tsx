'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, ShieldAlert, Plus, Pencil, Trash2, Link2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'

export interface Deal {
  id: string; kind: string; counterparty: string; territory: string | null
  mg_amount: number | null; total_value: number | null; received_amount: number | null
  received_date: string | null; expected_date: string | null; status: string
}
export interface Encumbrance {
  id: string; deal_id: string | null; creditor: string; kind: string
  claimed_amount: number; reason: string | null; reference: string | null; status: string; notes: string | null
}

const KIND_LABEL: Record<string, string> = { theatrical: 'Theatrical', satellite: 'Satellite', ott: 'OTT', music: 'Music', audio: 'Audio', overseas: 'Overseas', dubbing_rights: 'Dubbing', other: 'Other' }
const ENC_KIND = ['garnishee', 'assignment', 'loan_repayment', 'lien', 'other']
const ENC_KIND_LABEL: Record<string, string> = { garnishee: 'Garnishee order', assignment: 'Assignment', loan_repayment: 'Loan repayment', lien: 'Lien', other: 'Other' }
const dealValue = (d: Deal) => Number(d.total_value || d.mg_amount || 0)

interface Props { projectId: string; deals: Deal[]; encumbrances: Encumbrance[]; userId: string; isFinance: boolean; isFounder: boolean }

export function ReceivablesClient({ projectId, deals, encumbrances, userId, isFinance, isFounder }: Props) {
  const router = useRouter(); const toast = useToast()
  const [encOpen, setEncOpen] = useState(false); const [encSaving, setEncSaving] = useState(false)
  const [encEditing, setEncEditing] = useState<Encumbrance | null>(null)
  const [encForm, setEncForm] = useState({ deal_id: '', creditor: '', kind: 'garnishee', claimed_amount: '', reason: '', reference: '', status: 'active', notes: '' })
  const [savingDeal, setSavingDeal] = useState<string | null>(null)

  const totals = useMemo(() => {
    const contracted = deals.reduce((s, d) => s + dealValue(d), 0)
    const received = deals.reduce((s, d) => s + Number(d.received_amount || 0), 0)
    const outstanding = Math.max(contracted - received, 0)
    const encumbered = encumbrances.filter(e => e.status === 'active').reduce((s, e) => s + Number(e.claimed_amount || 0), 0)
    return { contracted, received, outstanding, encumbered, free: outstanding - encumbered }
  }, [deals, encumbrances])

  const dealLabel = (id: string | null) => { const d = deals.find(x => x.id === id); return d ? `${KIND_LABEL[d.kind] ?? d.kind} · ${d.counterparty}` : 'General' }
  const encByDeal = (id: string) => encumbrances.filter(e => e.deal_id === id)

  // Inline deal updates (expected date / received) — finance only
  async function patchDeal(d: Deal, patch: Record<string, unknown>) {
    setSavingDeal(d.id)
    const supabase = createClient()
    const { error } = await supabase.from('project_deals').update(patch).eq('id', d.id)
    if (error) { toast.error("Couldn't update deal"); setSavingDeal(null); return }
    await logAction('update', 'project_deals', d.id, undefined, patch); setSavingDeal(null); router.refresh()
  }

  function openEncNew(dealId?: string) { setEncEditing(null); setEncForm({ deal_id: dealId ?? '', creditor: '', kind: 'garnishee', claimed_amount: '', reason: '', reference: '', status: 'active', notes: '' }); setEncOpen(true) }
  function openEncEdit(e: Encumbrance) { setEncEditing(e); setEncForm({ deal_id: e.deal_id ?? '', creditor: e.creditor, kind: e.kind, claimed_amount: e.claimed_amount?.toString() ?? '', reason: e.reason ?? '', reference: e.reference ?? '', status: e.status, notes: e.notes ?? '' }); setEncOpen(true) }

  async function saveEnc(ev: React.FormEvent) {
    ev.preventDefault()
    if (!encForm.creditor.trim()) return toast.error('Creditor is required')
    setEncSaving(true)
    const supabase = createClient()
    const payload = { project_id: projectId, deal_id: encForm.deal_id || null, creditor: encForm.creditor.trim(), kind: encForm.kind, claimed_amount: encForm.claimed_amount ? Number(encForm.claimed_amount) : 0, reason: encForm.reason || null, reference: encForm.reference || null, status: encForm.status, notes: encForm.notes || null }
    if (encEditing) {
      const { error } = await supabase.from('receivable_encumbrances').update(payload).eq('id', encEditing.id)
      if (error) { toast.error("Couldn't update"); setEncSaving(false); return }
      await logAction('update', 'receivable_encumbrances', encEditing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('receivable_encumbrances').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setEncSaving(false); return }
      await logAction('create', 'receivable_encumbrances', data.id, undefined, payload)
    }
    toast.success(encEditing ? 'Updated' : 'Encumbrance added'); setEncSaving(false); setEncOpen(false); router.refresh()
  }
  async function removeEnc(e: Encumbrance) {
    if (!window.confirm(`Delete the ${e.creditor} claim?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('receivable_encumbrances').delete().eq('id', e.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'receivable_encumbrances', e.id); toast.success('Deleted'); router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Contracted" value={formatCurrency(totals.contracted)} />
        <Stat label="Received" value={formatCurrency(totals.received)} tone="green" />
        <Stat label="Outstanding" value={formatCurrency(totals.outstanding)} />
        <Stat label="Encumbered" value={formatCurrency(totals.encumbered)} tone={totals.encumbered ? 'amber' : 'default'} />
        <Stat label="Free receivable" value={formatCurrency(totals.free)} tone={totals.free < 0 ? 'red' : 'green'} />
      </div>
      {totals.free < 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-2 text-sm text-red-400">
          <ShieldAlert size={16} /> Creditor claims ({formatCurrency(totals.encumbered)}) exceed outstanding receivable ({formatCurrency(totals.outstanding)}). Free cash from receivables is negative.
        </div>
      )}

      {/* Deals / receivables */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center gap-2"><TrendingUp size={15} className="text-white/70" /><h3 className="text-sm font-semibold text-white">Deals &amp; receivables</h3><span className="text-[11px] text-[#8888aa]">add deals in the Release module</span></div>
        {deals.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#8888aa]">No deals yet. Create them in the Release module; they appear here as receivables.</div>
        ) : (
          <div className="divide-y divide-[#2a2a3a]">
            {deals.map(d => {
              const outstanding = Math.max(dealValue(d) - Number(d.received_amount || 0), 0)
              const enc = encByDeal(d.id).filter(e => e.status === 'active').reduce((s, e) => s + Number(e.claimed_amount || 0), 0)
              return (
                <div key={d.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{KIND_LABEL[d.kind] ?? d.kind}</span>
                        <span className="text-xs text-[#8888aa]">{d.counterparty}{d.territory ? ` · ${d.territory}` : ''}</span>
                        <span className="text-[10px] uppercase tracking-wide text-[#8888aa]">{d.status}</span>
                        {enc > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">encumbered {formatCurrency(enc)}</span>}
                      </div>
                      <div className="text-[11px] text-[#8888aa] mt-0.5">value {formatCurrency(dealValue(d))} · received {formatCurrency(Number(d.received_amount || 0))} · outstanding {formatCurrency(outstanding)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-white tabular-nums">{formatCurrency(outstanding)}</div>
                      <div className="text-[10px] text-[#5a5a7a]">outstanding</div>
                    </div>
                  </div>
                  {isFinance && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
                      <label className="text-[#8888aa]">Expected:
                        <input type="date" defaultValue={d.expected_date ?? ''} disabled={savingDeal === d.id}
                          onBlur={e => { if (e.target.value !== (d.expected_date ?? '')) patchDeal(d, { expected_date: e.target.value || null }) }}
                          className="ml-1 bg-[#1a1a24] border border-[#2a2a3a] rounded text-white px-1.5 py-0.5" />
                      </label>
                      <button onClick={() => openEncNew(d.id)} className="inline-flex items-center gap-1 text-amber-400/90 hover:text-amber-300"><Link2 size={11} /> Add encumbrance</button>
                    </div>
                  )}
                  {encByDeal(d.id).length > 0 && (
                    <div className="mt-2 ml-2 space-y-1">
                      {encByDeal(d.id).map(e => (
                        <div key={e.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className={e.status === 'active' ? 'text-amber-400' : 'text-[#5a5a7a] line-through'}>{e.creditor} · {ENC_KIND_LABEL[e.kind]} · {formatCurrency(Number(e.claimed_amount || 0))}{e.reference ? ` · ${e.reference}` : ''} ({e.status})</span>
                          {isFinance && <span className="flex items-center gap-1 shrink-0"><button onClick={() => openEncEdit(e)} className="text-[#8888aa] hover:text-white"><Pencil size={12} /></button>{isFounder && <button onClick={() => removeEnc(e)} className="text-red-400/70 hover:text-red-400"><Trash2 size={12} /></button>}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* General (deal-less) encumbrances */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Creditor claims (encumbrances)</h3>
          {isFinance && <Button size="sm" icon={Plus} onClick={() => openEncNew()}>Add claim</Button>}
        </div>
        {encumbrances.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#8888aa]">No encumbrances recorded. Add garnishee orders, assignments or release-linked repayments here.</div>
        ) : (
          <div className="divide-y divide-[#2a2a3a]">
            {encumbrances.map(e => (
              <div key={e.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{e.creditor}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#8888aa] border border-[#2a2a3a]">{ENC_KIND_LABEL[e.kind]}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${e.status === 'active' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-white/5 text-[#8888aa] border-[#2a2a3a]'}`}>{e.status}</span>
                  </div>
                  <div className="text-[11px] text-[#8888aa] mt-0.5">{dealLabel(e.deal_id)}{e.reference ? ` · ${e.reference}` : ''}{e.reason ? ` · ${e.reason}` : ''}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-amber-300 tabular-nums">{formatCurrency(Number(e.claimed_amount || 0))}</span>
                  {isFinance && <button onClick={() => openEncEdit(e)} className="p-1.5 text-[#8888aa] hover:text-white"><Pencil size={14} /></button>}
                  {isFounder && <button onClick={() => removeEnc(e)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={encOpen} onClose={() => setEncOpen(false)} title={encEditing ? 'Edit Encumbrance' : 'Add Encumbrance'} size="sm">
        <form onSubmit={saveEnc} className="space-y-4">
          <Input label="Creditor" value={encForm.creditor} onChange={e => setEncForm({ ...encForm, creditor: e.target.value })} placeholder="BetterInvest / JM Infotainment" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Kind" value={encForm.kind} onChange={e => setEncForm({ ...encForm, kind: e.target.value })} options={ENC_KIND.map(k => ({ value: k, label: ENC_KIND_LABEL[k] }))} />
            <MoneyInput label="Claimed amount (₹)" value={encForm.claimed_amount} onChange={v => setEncForm({ ...encForm, claimed_amount: v })} />
          </div>
          <Select label="Against receivable" value={encForm.deal_id} onChange={e => setEncForm({ ...encForm, deal_id: e.target.value })}
            options={[{ value: '', label: 'General (no specific deal)' }, ...deals.map(d => ({ value: d.id, label: `${KIND_LABEL[d.kind] ?? d.kind} · ${d.counterparty}` }))]} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Reference" value={encForm.reference} onChange={e => setEncForm({ ...encForm, reference: e.target.value })} placeholder="Order / agreement no." />
            <Select label="Status" value={encForm.status} onChange={e => setEncForm({ ...encForm, status: e.target.value })} options={['active', 'released', 'settled'].map(s => ({ value: s, label: s }))} />
          </div>
          <Textarea label="Reason" value={encForm.reason} onChange={e => setEncForm({ ...encForm, reason: e.target.value })} rows={2} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEncOpen(false)}>Cancel</Button>
            <Button type="submit" loading={encSaving}>{encEditing ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'green' | 'amber' | 'red' }) {
  const c = tone === 'green' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : tone === 'red' ? 'text-red-300' : 'text-white'
  return (
    <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wide text-[#8888aa]">{label}</div>
      <div className={`text-base font-bold tabular-nums mt-0.5 ${c}`}>{value}</div>
    </div>
  )
}
