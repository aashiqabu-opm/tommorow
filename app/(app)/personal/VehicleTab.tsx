'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Upload, Loader2, Sparkles, Car, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { analyzeDoc, findId } from './aiFill'
import type { PersonalVehicle } from '@/lib/types'

const DATE_FIELDS: { key: keyof PersonalVehicle; label: string; match: string[] }[] = [
  { key: 'insurance_expiry', label: 'Insurance expiry', match: ['insurance', 'policy', 'valid'] },
  { key: 'road_tax_expiry', label: 'Road tax expiry', match: ['tax'] },
  { key: 'puc_expiry', label: 'PUC expiry', match: ['puc', 'pollution', 'emission'] },
  { key: 'fitness_expiry', label: 'Fitness expiry', match: ['fitness'] },
  { key: 'registration_expiry', label: 'Registration expiry', match: ['registration', 'rc', 'regn'] },
]

function soonest(v: PersonalVehicle): { label: string; date: string } | null {
  const today = new Date().toISOString().slice(0, 10)
  const items = DATE_FIELDS.map(f => ({ label: f.label, date: v[f.key] as string | null })).filter(x => x.date) as { label: string; date: string }[]
  const upcoming = items.filter(x => x.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  return upcoming[0] ?? items.sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
}

export function VehicleTab({ ownerId, rows, onChange }: { ownerId: string; rows: PersonalVehicle[]; onChange: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PersonalVehicle | null>(null)
  const [name, setName] = useState('')
  const [reg, setReg] = useState('')
  const [vtype, setVtype] = useState<PersonalVehicle['vtype']>('car')
  const [dates, setDates] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiFilled, setAiFilled] = useState(false)

  function openNew() { setEditing(null); setName(''); setReg(''); setVtype('car'); setDates({}); setNotes(''); setAiFilled(false); setOpen(true) }
  function openEdit(r: PersonalVehicle) {
    setEditing(r); setName(r.name); setReg(r.reg_number ?? ''); setVtype(r.vtype)
    setDates(Object.fromEntries(DATE_FIELDS.map(f => [f.key, (r[f.key] as string) ?? '']))); setNotes(r.notes ?? ''); setAiFilled(false); setOpen(true)
  }
  const setDate = (k: string, v: string) => setDates(d => ({ ...d, [k]: v }))

  async function onFile(f: File | null) {
    if (!f) return
    setAnalyzing(true)
    try {
      const x = await analyzeDoc(f)
      if (!reg) { const r = findId(x.identifiers ?? [], 'registration', 'reg', 'vehicle'); if (r) setReg(r) }
      // map the main expiry + key_dates onto the right date fields by keyword
      const allDates = [...(x.key_dates ?? []), ...(x.expiry_date ? [{ label: x.doc_type ?? 'expiry', date: x.expiry_date }] : [])]
      const next: Record<string, string> = { ...dates }
      for (const f2 of DATE_FIELDS) {
        const hit = allDates.find(d => f2.match.some(m => d.label.toLowerCase().includes(m)))
        if (hit) next[f2.key as string] = hit.date
      }
      // if nothing matched but there's a single expiry, drop it into insurance by default
      if (x.expiry_date && !DATE_FIELDS.some(f2 => next[f2.key as string])) next['insurance_expiry'] = x.expiry_date
      setDates(next); setAiFilled(true)
      toast.success('AI filled what it could read — review and save')
    } catch (e) { toast.error((e as Error).message || "AI couldn't read it") }
    finally { setAnalyzing(false) }
  }

  async function save() {
    if (!name) { toast.error('Name required'); return }
    setSaving(true); const supabase = createClient()
    const payload = {
      name, reg_number: reg || null, vtype, notes: notes || null,
      ...Object.fromEntries(DATE_FIELDS.map(f => [f.key, dates[f.key as string] || null])),
    }
    if (editing) { const { error } = await supabase.from('personal_vehicles').update(payload).eq('id', editing.id); if (error) { toast.error("Couldn't save"); setSaving(false); return } await logAction('update', 'personal_vehicles', editing.id) }
    else { const { data, error } = await supabase.from('personal_vehicles').insert({ ...payload, owner_id: ownerId }).select().single(); if (error) { toast.error("Couldn't save"); setSaving(false); return } if (data) await logAction('create', 'personal_vehicles', data.id) }
    setSaving(false); setOpen(false); toast.success('Saved'); onChange()
  }
  async function remove(r: PersonalVehicle) { if (!confirm('Delete?')) return; const supabase = createClient(); await supabase.from('personal_vehicles').delete().eq('id', r.id); await logAction('delete', 'personal_vehicles', r.id); toast.success('Deleted'); onChange() }

  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-[#8888aa]">Upload a doc and AI fills the renewal dates.</p>
        <Button icon={Plus} onClick={openNew}>Add vehicle</Button>
      </div>
      {rows.length === 0 ? (
        <div className="text-center text-sm text-[#8888aa] bg-[#13131a] border border-dashed border-[#2a2a3a] rounded-xl py-10 px-6">Add your vehicles to track insurance, road tax, PUC, fitness & registration renewals.</div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const next = soonest(r)
            const due = next && next.date >= today && next.date <= in30
            const overdue = next && next.date < today
            return (
              <div key={r.id} className="flex items-center justify-between bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Car size={18} className="text-[#8888aa] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-white font-medium truncate">{r.name} <span className="text-[#8888aa] font-normal">{r.reg_number ? `· ${r.reg_number}` : ''}</span></div>
                    <div className={`text-xs mt-0.5 flex items-center gap-1 ${overdue ? 'text-red-300' : due ? 'text-amber-300' : 'text-[#8888aa]'}`}>
                      {(overdue || due) && <AlertTriangle size={12} />}
                      {next ? `${next.label}: ${formatDate(next.date)}${overdue ? ' (overdue)' : due ? ' (soon)' : ''}` : 'No dates set'}
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
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit vehicle' : 'Add vehicle'}>
        <div className="space-y-3">
          <label className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 cursor-pointer border ${analyzing ? 'border-[#f5b301]/50 text-[#f5b301]' : 'text-white bg-[#1a1a24] border-[#2a2a3a] hover:border-white/30'}`}>
            {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {analyzing ? 'AI reading the document…' : 'Upload RC / insurance / PUC — AI fills dates'}
            <input type="file" className="hidden" disabled={analyzing} onChange={e => onFile(e.target.files?.[0] ?? null)} />
          </label>
          {aiFilled && <div className="text-[11px] text-[#f5b301] flex items-center gap-1"><Sparkles size={12} /> AI-filled — review before saving.</div>}
          <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Fortuner" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Reg number" value={reg} onChange={e => setReg(e.target.value.toUpperCase())} />
            <Select label="Type" value={vtype} onChange={e => setVtype(e.target.value as PersonalVehicle['vtype'])} options={[['car', 'Car'], ['bike', 'Bike'], ['suv', 'SUV'], ['van', 'Van'], ['other', 'Other']].map(([value, label]) => ({ value, label }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {DATE_FIELDS.map(f => <Input key={f.key as string} label={f.label} type="date" value={dates[f.key as string] ?? ''} onChange={e => setDate(f.key as string, e.target.value)} />)}
          </div>
          <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}
