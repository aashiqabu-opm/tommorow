'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Upload, Loader2, Sparkles, HeartPulse, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { analyzeDoc, findId } from './aiFill'
import type { PersonalHealthPolicy } from '@/lib/types'

const KIND_LABELS: Record<PersonalHealthPolicy['kind'], string> = { health: 'Health', life: 'Life', term: 'Term', vehicle: 'Vehicle', other: 'Other' }

export function HealthTab({ ownerId, rows, onChange }: { ownerId: string; rows: PersonalHealthPolicy[]; onChange: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalHealthPolicy | null>(null)
  const [insurer, setInsurer] = useState('')
  const [policyNo, setPolicyNo] = useState('')
  const [kind, setKind] = useState<PersonalHealthPolicy['kind']>('health')
  const [sumInsured, setSumInsured] = useState('')
  const [premium, setPremium] = useState('')
  const [renewal, setRenewal] = useState('')
  const [members, setMembers] = useState('')
  const [nominee, setNominee] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiFilled, setAiFilled] = useState(false)

  function openNew() { setEditing(null); setInsurer(''); setPolicyNo(''); setKind('health'); setSumInsured(''); setPremium(''); setRenewal(''); setMembers(''); setNominee(''); setNotes(''); setAiFilled(false); setOpen(true) }
  function openEdit(r: PersonalHealthPolicy) { setEditing(r); setInsurer(r.insurer); setPolicyNo(r.policy_number ?? ''); setKind(r.kind); setSumInsured(r.sum_insured ? String(r.sum_insured) : ''); setPremium(r.premium ? String(r.premium) : ''); setRenewal(r.renewal_date ?? ''); setMembers(r.members ?? ''); setNominee(r.nominee ?? ''); setNotes(r.notes ?? ''); setAiFilled(false); setOpen(true) }

  async function onFile(f: File | null) {
    if (!f) return
    setAnalyzing(true)
    try {
      const x = await analyzeDoc(f)
      if (!insurer && x.title) setInsurer(x.title)
      const pno = findId(x.identifiers ?? [], 'policy', 'certificate'); if (pno) setPolicyNo(pno)
      if (x.expiry_date) setRenewal(x.expiry_date)
      if (x.amount) setSumInsured(String(x.amount))
      const nom = findId(x.identifiers ?? [], 'nominee'); if (nom) setNominee(nom)
      setAiFilled(true)
      toast.success('AI filled the policy — review and save')
    } catch (e) { toast.error((e as Error).message || "AI couldn't read it") }
    finally { setAnalyzing(false) }
  }

  async function save() {
    if (!insurer) { toast.error('Insurer required'); return }
    setSaving(true); const supabase = createClient()
    const payload = { insurer, policy_number: policyNo || null, kind, sum_insured: sumInsured ? Number(sumInsured) : null, premium: premium ? Number(premium) : null, renewal_date: renewal || null, members: members || null, nominee: nominee || null, notes: notes || null }
    if (editing) { const { error } = await supabase.from('personal_health_policies').update(payload).eq('id', editing.id); if (error) { toast.error("Couldn't save"); setSaving(false); return } await logAction('update', 'personal_health_policies', editing.id) }
    else { const { data, error } = await supabase.from('personal_health_policies').insert({ ...payload, owner_id: ownerId }).select().single(); if (error) { toast.error("Couldn't save"); setSaving(false); return } if (data) await logAction('create', 'personal_health_policies', data.id) }
    setSaving(false); setOpen(false); toast.success('Saved'); onChange()
  }
  async function remove(r: PersonalHealthPolicy) { if (!confirm('Delete?')) return; const supabase = createClient(); await supabase.from('personal_health_policies').delete().eq('id', r.id); await logAction('delete', 'personal_health_policies', r.id); toast.success('Deleted'); onChange() }

  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-[#8888aa]">Upload a policy PDF and AI fills the details.</p>
        <Button icon={Plus} onClick={openNew}>Add policy</Button>
      </div>
      {rows.length === 0 ? (
        <div className="text-center text-sm text-[#8888aa] bg-[#13131a] border border-dashed border-[#2a2a3a] rounded-xl py-10 px-6">Add health, life and term policies — track sum insured, premium and renewals.</div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const due = r.renewal_date && r.renewal_date >= today && r.renewal_date <= in30
            const overdue = r.renewal_date && r.renewal_date < today
            return (
              <div key={r.id} className="flex items-center justify-between bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <HeartPulse size={18} className="text-[#8888aa] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-white font-medium truncate">{r.insurer} <span className="text-[#8888aa] font-normal">· {KIND_LABELS[r.kind]}{r.sum_insured ? ` · ${formatCurrency(Number(r.sum_insured))} cover` : ''}</span></div>
                    <div className={`text-xs mt-0.5 flex items-center gap-1 ${overdue ? 'text-red-300' : due ? 'text-amber-300' : 'text-[#8888aa]'}`}>
                      {(overdue || due) && <AlertTriangle size={12} />}
                      {r.renewal_date ? `Renews ${formatDate(r.renewal_date)}${overdue ? ' (overdue)' : due ? ' (soon)' : ''}` : 'No renewal date'}{r.policy_number ? ` · ${r.policy_number}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => openEdit(r)} className="text-[#8888aa] hover:text-white"><Pencil size={15} /></button>
                  <button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit policy' : 'Add policy'}>
        <div className="space-y-3">
          <label className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 cursor-pointer border ${analyzing ? 'border-[#D6B16F]/50 text-[#D6B16F]' : 'text-white bg-[#1a1a24] border-[#2a2a3a] hover:border-white/30'}`}>
            {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {analyzing ? 'AI reading the policy…' : 'Upload policy PDF — AI fills details'}
            <input type="file" className="hidden" disabled={analyzing} onChange={e => onFile(e.target.files?.[0] ?? null)} />
          </label>
          {aiFilled && <div className="text-[11px] text-[#D6B16F] flex items-center gap-1"><Sparkles size={12} /> AI-filled — review before saving.</div>}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Insurer" value={insurer} onChange={e => setInsurer(e.target.value)} />
            <Select label="Kind" value={kind} onChange={e => setKind(e.target.value as PersonalHealthPolicy['kind'])} options={Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))} />
          </div>
          <Input label="Policy number" value={policyNo} onChange={e => setPolicyNo(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Sum insured" value={sumInsured} onChange={setSumInsured} />
            <MoneyInput label="Premium" value={premium} onChange={setPremium} />
          </div>
          <Input label="Renewal date" type="date" value={renewal} onChange={e => setRenewal(e.target.value)} />
          <Input label="Members covered" value={members} onChange={e => setMembers(e.target.value)} placeholder="Self, spouse, 2 kids" />
          <Input label="Nominee" value={nominee} onChange={e => setNominee(e.target.value)} />
          <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}
