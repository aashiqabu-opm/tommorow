'use client'

import { useState } from 'react'
import { UserPlus, Plus, Pencil, Trash2, ShieldCheck, ChevronDown, ChevronRight, Check, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface Consent { id: string; consent_type: string; granted: boolean; granted_at: string; method: string | null }
export interface Onboarding {
  id: string; full_name: string; role: string | null; department: string | null
  phone: string | null; email: string | null; emergency_contact: string | null
  status: string; consent_at: string | null; checked_in_at: string | null; notes: string | null
  consents?: Consent[]
}

const STATUS = ['invited', 'link_sent', 'consent_given', 'profile_complete', 'checked_in', 'active', 'declined']
const statusCls: Record<string, string> = {
  invited: 'bg-white/5 text-[#8888aa] border-[#2a2a3a]', link_sent: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  consent_given: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30', profile_complete: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  checked_in: 'bg-green-500/15 text-green-400 border-green-500/30', active: 'bg-green-500/15 text-green-400 border-green-500/30',
  declined: 'bg-red-500/15 text-red-400 border-red-500/30',
}
const CONSENT_TYPES = ['location_tracking', 'data_usage', 'photo_media', 'terms']
const CONSENT_LABEL: Record<string, string> = { location_tracking: 'Location tracking', data_usage: 'Data usage', photo_media: 'Photo / media', terms: 'Terms' }

const EMPTY = { full_name: '', role: '', department: '', phone: '', email: '', emergency_contact: '', status: 'invited', notes: '' }

interface Props { projectId: string; rows: Onboarding[]; userId: string; canManage: boolean; canDelete: boolean }

export function CrewOnboardingClient({ projectId, rows, userId, canManage, canDelete }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Onboarding | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [consentFor, setConsentFor] = useState<Onboarding | null>(null)
  const [consentForm, setConsentForm] = useState({ consent_type: 'location_tracking', granted: true, method: 'in_person' })
  const [savingConsent, setSavingConsent] = useState(false)

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(r: Onboarding) {
    setEditing(r)
    setForm({ full_name: r.full_name, role: r.role ?? '', department: r.department ?? '', phone: r.phone ?? '', email: r.email ?? '', emergency_contact: r.emergency_contact ?? '', status: r.status, notes: r.notes ?? '' })
    setOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) return toast.error('Name is required')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, full_name: form.full_name.trim(), role: form.role || null, department: form.department || null,
      phone: form.phone || null, email: form.email || null, emergency_contact: form.emergency_contact || null,
      status: form.status, notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('crew_onboarding').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'crew_onboarding', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('crew_onboarding').insert({ ...payload, invited_at: new Date().toISOString(), created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'crew_onboarding', data.id, undefined, payload)
    }
    toast.success(editing ? 'Updated' : 'Crew added'); setSaving(false); setOpen(false); router.refresh()
  }
  async function remove(r: Onboarding) {
    if (!window.confirm(`Remove ${r.full_name} from onboarding? (Consent log is deleted too.)`)) return
    const supabase = createClient()
    const { error } = await supabase.from('crew_onboarding').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'crew_onboarding', r.id); toast.success('Removed'); router.refresh()
  }

  function openConsent(r: Onboarding) { setConsentFor(r); setConsentForm({ consent_type: 'location_tracking', granted: true, method: 'in_person' }) }
  async function recordConsent(e: React.FormEvent) {
    e.preventDefault()
    if (!consentFor) return
    setSavingConsent(true)
    const supabase = createClient()
    const { error } = await supabase.from('crew_consents').insert({
      onboarding_id: consentFor.id, project_id: projectId, consent_type: consentForm.consent_type,
      granted: consentForm.granted, method: consentForm.method,
    })
    if (error) { toast.error("Couldn't record consent"); setSavingConsent(false); return }
    // advance onboarding state when consent captured
    await supabase.from('crew_onboarding').update({ consent_at: new Date().toISOString(), status: consentFor.status === 'invited' || consentFor.status === 'link_sent' ? 'consent_given' : consentFor.status }).eq('id', consentFor.id)
    await logAction('create', 'crew_consents', consentFor.id, undefined, { consent_type: consentForm.consent_type, granted: consentForm.granted })
    toast.success('Consent recorded'); setSavingConsent(false); setConsentFor(null); router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2"><UserPlus size={16} className="text-white/70" /><h3 className="text-sm font-semibold text-white">Crew Onboarding &amp; Consent</h3></div>
        {canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add crew</Button>}
      </div>
      <div className="px-5 py-2.5 border-b border-[#2a2a3a] text-[11px] text-[#8888aa] flex items-center gap-1.5">
        <ShieldCheck size={12} /> Consent is an immutable, timestamped log. Location/data tracking applies only with recorded consent.
      </div>

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No crew onboarded yet. Add a crew member to start the sign → consent → check-in flow.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {rows.map(r => {
            const isOpen = expanded === r.id
            const granted = (r.consents ?? []).filter(c => c.granted).map(c => c.consent_type)
            return (
              <div key={r.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <button onClick={() => setExpanded(isOpen ? null : r.id)} className="flex items-center gap-2 min-w-0 text-left">
                    {isOpen ? <ChevronDown size={14} className="text-[#8888aa] shrink-0" /> : <ChevronRight size={14} className="text-[#8888aa] shrink-0" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white truncate">{r.full_name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusCls[r.status]}`}>{r.status.replace(/_/g, ' ')}</span>
                        {CONSENT_TYPES.map(ct => (
                          <span key={ct} className={`text-[9px] px-1.5 py-0.5 rounded inline-flex items-center gap-0.5 ${granted.includes(ct) ? 'text-emerald-400' : 'text-[#5a5a7a]'}`}>
                            {granted.includes(ct) ? <Check size={9} /> : <X size={9} />} {CONSENT_LABEL[ct]}
                          </span>
                        ))}
                      </div>
                      <div className="text-[11px] text-[#8888aa] mt-0.5">{[r.role, r.department, r.phone].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                  </button>
                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="secondary" icon={ShieldCheck} onClick={() => openConsent(r)}>Consent</Button>
                      <button onClick={() => openEdit(r)} className="p-1.5 text-[#8888aa] hover:text-white"><Pencil size={14} /></button>
                      {canDelete && <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>}
                    </div>
                  )}
                </div>
                {isOpen && (
                  <div className="mt-3 ml-6 space-y-2">
                    {r.email && <div className="text-[11px] text-[#8888aa]">Email: {r.email}</div>}
                    {r.emergency_contact && <div className="text-[11px] text-[#8888aa]">Emergency: {r.emergency_contact}</div>}
                    <div className="text-[10px] uppercase tracking-wide text-[#666688] mt-2">Consent log</div>
                    {(r.consents ?? []).length === 0 ? (
                      <div className="text-[11px] text-[#5a5a7a]">No consent recorded yet.</div>
                    ) : (
                      <ul className="space-y-1">
                        {[...(r.consents ?? [])].sort((a, b) => b.granted_at.localeCompare(a.granted_at)).map(c => (
                          <li key={c.id} className="text-[11px] flex items-center gap-2">
                            {c.granted ? <Check size={11} className="text-emerald-400" /> : <X size={11} className="text-red-400" />}
                            <span className="text-[#c8c8da]">{CONSENT_LABEL[c.consent_type]}</span>
                            <span className="text-[#5a5a7a]">{c.granted ? 'granted' : 'declined'} · {formatDate(c.granted_at)}{c.method ? ` · ${c.method}` : ''}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add / edit crew */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Crew' : 'Add Crew Member'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <Input label="Full name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
            <Input label="Department" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <Input label="Emergency contact" value={form.emergency_contact} onChange={e => setForm({ ...form, emergency_contact: e.target.value })} />
          <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STATUS.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>

      {/* Record consent */}
      <Modal open={!!consentFor} onClose={() => setConsentFor(null)} title={`Record consent — ${consentFor?.full_name ?? ''}`} size="sm">
        <form onSubmit={recordConsent} className="space-y-4">
          <p className="text-[11px] text-[#8888aa]">This appends an immutable, timestamped consent record.</p>
          <Select label="Consent type" value={consentForm.consent_type} onChange={e => setConsentForm({ ...consentForm, consent_type: e.target.value })} options={CONSENT_TYPES.map(c => ({ value: c, label: CONSENT_LABEL[c] }))} />
          <Select label="Decision" value={consentForm.granted ? 'yes' : 'no'} onChange={e => setConsentForm({ ...consentForm, granted: e.target.value === 'yes' })} options={[{ value: 'yes', label: 'Granted' }, { value: 'no', label: 'Declined' }]} />
          <Select label="Captured via" value={consentForm.method} onChange={e => setConsentForm({ ...consentForm, method: e.target.value })} options={[{ value: 'in_person', label: 'In person' }, { value: 'phone', label: 'Phone' }, { value: 'signed_form', label: 'Signed form' }]} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setConsentFor(null)}>Cancel</Button>
            <Button type="submit" loading={savingConsent}>Record consent</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
