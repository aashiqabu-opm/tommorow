'use client'

import { useState } from 'react'
import { Plus, Trash2, Pencil, Upload, Loader2, Sparkles, ExternalLink, Scale, CalendarClock, AlertTriangle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate, formatCurrency } from '@/lib/utils'
import { fileToBase64 } from './aiFill'
import { LEGAL_CASE_TYPE_LABELS, LEGAL_ROLE_LABELS, LEGAL_STATUS_LABELS, type LegalCase } from '@/lib/types'

const TYPE_OPTS = Object.entries(LEGAL_CASE_TYPE_LABELS).map(([value, label]) => ({ value, label }))
const ROLE_OPTS = Object.entries(LEGAL_ROLE_LABELS).map(([value, label]) => ({ value, label }))
const STATUS_OPTS = Object.entries(LEGAL_STATUS_LABELS).map(([value, label]) => ({ value, label }))

const STATUS_CLS: Record<string, string> = {
  active: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
  on_hold: 'text-[#8888aa] bg-white/5 border-[#2a2a3a]',
  won: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  settled: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  lost: 'text-red-400 bg-red-500/10 border-red-500/25',
  closed: 'text-[#8888aa] bg-white/5 border-[#2a2a3a]',
}

const OK = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
const EMPTY = {
  title: '', case_type: 'civil', our_role: 'respondent', opposing_party: '', related_entity: '',
  court: '', case_number: '', jurisdiction: '', amount_involved: '', status: 'active',
  filing_date: '', next_hearing_date: '', lawyer_name: '', lawyer_contact: '', notes: '',
}

export function LegalCasesTab({ ownerId, rows, onChange }: { ownerId: string; rows: LegalCase[]; onChange: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [editing, setEditing] = useState<LegalCase | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [file, setFile] = useState<File | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [keyDates, setKeyDates] = useState<{ label: string; date: string }[]>([])
  const [obligations, setObligations] = useState<string[]>([])
  const [risk, setRisk] = useState<string | null>(null)

  function reset() {
    setForm(EMPTY); setFile(null); setEditing(null); setAiSummary(null); setKeyDates([]); setObligations([]); setRisk(null)
  }
  function openNew() { reset(); setOpen(true) }
  function openEdit(c: LegalCase) {
    reset(); setEditing(c)
    setForm({
      title: c.title, case_type: c.case_type, our_role: c.our_role, opposing_party: c.opposing_party ?? '',
      related_entity: c.related_entity ?? '', court: c.court ?? '', case_number: c.case_number ?? '',
      jurisdiction: c.jurisdiction ?? '', amount_involved: c.amount_involved != null ? String(c.amount_involved) : '',
      status: c.status, filing_date: c.filing_date ?? '', next_hearing_date: c.next_hearing_date ?? '',
      lawyer_name: c.lawyer_name ?? '', lawyer_contact: c.lawyer_contact ?? '', notes: c.notes ?? '',
    })
    setAiSummary(c.ai_summary ?? null); setKeyDates(c.ai_key_dates ?? [])
    setOpen(true)
  }

  async function onFile(f: File | null) {
    setFile(f)
    if (!f) return
    if (!OK.includes(f.type)) { toast.error('Upload a PDF or image'); return }
    if (f.size > 6_500_000) { toast.error('File too big for AI (~6MB)'); return }
    setAnalyzing(true)
    try {
      const base64 = await fileToBase64(f)
      const res = await fetch('/api/personal/analyze-legal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType: f.type }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "AI couldn't read it"); setAnalyzing(false); return }
      const e = data.extracted
      setForm(prev => ({
        ...prev,
        title: e.title || prev.title,
        case_type: e.case_type || prev.case_type,
        our_role: e.our_role || prev.our_role,
        opposing_party: e.opposing_party || prev.opposing_party,
        court: e.court || prev.court,
        case_number: e.case_number || prev.case_number,
        jurisdiction: e.jurisdiction || prev.jurisdiction,
        amount_involved: e.amount_involved != null ? String(e.amount_involved) : prev.amount_involved,
        filing_date: e.filing_date || prev.filing_date,
        next_hearing_date: e.next_hearing_date || prev.next_hearing_date,
      }))
      setAiSummary(e.summary ?? null)
      setKeyDates(Array.isArray(e.key_dates) ? e.key_dates : [])
      setObligations(Array.isArray(e.obligations) ? e.obligations : [])
      setRisk(e.risk_notes ?? null)
      toast.success('AI read the document — review and save')
    } catch { toast.error('Could not analyze') }
    setAnalyzing(false)
  }

  async function save() {
    if (!form.title.trim()) { toast.error('Title required'); return }
    setSaving(true)
    const supabase = createClient()
    const payload: Record<string, unknown> = {
      title: form.title.trim(), case_type: form.case_type, our_role: form.our_role,
      opposing_party: form.opposing_party || null, related_entity: form.related_entity || null,
      court: form.court || null, case_number: form.case_number || null, jurisdiction: form.jurisdiction || null,
      amount_involved: parseFloat(form.amount_involved) || null, status: form.status,
      filing_date: form.filing_date || null, next_hearing_date: form.next_hearing_date || null,
      lawyer_name: form.lawyer_name || null, lawyer_contact: form.lawyer_contact || null,
      notes: form.notes || null, ai_summary: aiSummary, ai_key_dates: keyDates.length ? keyDates : null,
    }
    // Upload the document if a new one was chosen
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${ownerId}/legal/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('personal').upload(path, file, { upsert: false })
      if (upErr) { toast.error("Couldn't upload file"); setSaving(false); return }
      payload.file_path = path; payload.file_name = file.name
    }
    if (editing) {
      const { error } = await supabase.from('personal_legal_cases').update(payload).eq('id', editing.id)
      setSaving(false)
      if (error) { toast.error("Couldn't save"); return }
      await logAction('update', 'personal_legal_cases', editing.id)
      setOpen(false); reset(); toast.success('Case updated'); onChange()
      return
    }
    const { data, error } = await supabase.from('personal_legal_cases').insert({ owner_id: ownerId, ...payload }).select().single()
    setSaving(false)
    if (error) { toast.error("Couldn't save — " + error.message.slice(0, 80)); return }
    if (data) await logAction('create', 'personal_legal_cases', data.id)
    setOpen(false); reset(); toast.success('Case added'); onChange()
  }

  async function view(c: LegalCase) {
    if (!c.file_path) { toast.error('No document attached'); return }
    const supabase = createClient()
    const { data, error } = await supabase.storage.from('personal').createSignedUrl(c.file_path, 120)
    if (error || !data) { toast.error("Couldn't open file"); return }
    window.open(data.signedUrl, '_blank')
  }

  async function remove(c: LegalCase) {
    if (!confirm(`Delete the case "${c.title}"?`)) return
    const supabase = createClient()
    if (c.file_path) await supabase.storage.from('personal').remove([c.file_path])
    await supabase.from('personal_legal_cases').delete().eq('id', c.id)
    await logAction('delete', 'personal_legal_cases', c.id)
    toast.success('Deleted'); onChange()
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-[#8888aa]">Court cases, disputes & legal obligations — private to you. Upload a notice/order and AI reads parties, next hearing, obligations & risk. Not legal advice.</p>
        <Button icon={Plus} onClick={openNew}>Add case</Button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center text-sm text-[#8888aa] bg-[#13131a] border border-dashed border-[#2a2a3a] rounded-xl py-10 px-6">
          No cases tracked yet. Add a court case or dispute — with hearing-date alerts and AI document analysis.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(c => (
            <div key={c.id} className="bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-3">
                  <Scale size={18} className="text-[#8888aa] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm text-white font-medium flex items-center gap-2 flex-wrap">
                      {c.title}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${STATUS_CLS[c.status] ?? STATUS_CLS.on_hold}`}>{LEGAL_STATUS_LABELS[c.status]}</span>
                    </div>
                    <div className="text-xs text-[#8888aa] mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{LEGAL_CASE_TYPE_LABELS[c.case_type]} · {LEGAL_ROLE_LABELS[c.our_role]}</span>
                      {c.opposing_party && <span>vs {c.opposing_party}</span>}
                      {c.related_entity && <span>· {c.related_entity}</span>}
                    </div>
                    <div className="text-xs text-[#8888aa] mt-0.5 flex items-center gap-3 flex-wrap">
                      {c.case_number && <span>{c.court ? `${c.court} · ` : ''}{c.case_number}</span>}
                      {c.amount_involved ? <span className="text-[#c8c8da]">{formatCurrency(c.amount_involved)}</span> : null}
                      {c.next_hearing_date && (
                        <span className={`flex items-center gap-1 ${c.next_hearing_date <= today ? 'text-amber-400' : ''}`}>
                          <CalendarClock size={12} /> hearing {formatDate(c.next_hearing_date)}
                        </span>
                      )}
                    </div>
                    {c.ai_summary && <div className="text-xs text-[#aaaacc] mt-1.5 leading-relaxed">{c.ai_summary}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {c.file_path && <button onClick={() => view(c)} className="text-[#8888aa] hover:text-white" title="Open document"><ExternalLink size={15} /></button>}
                  <button onClick={() => openEdit(c)} className="text-[#8888aa] hover:text-white" title="Edit"><Pencil size={15} /></button>
                  <button onClick={() => remove(c)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit case' : 'Add legal case'} size="lg">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#8888aa] mb-1">Court / legal document — AI reads it and fills the form</label>
            <label className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 cursor-pointer border ${analyzing ? 'border-[#f5b301]/50 text-[#f5b301]' : 'text-white bg-[#1a1a24] border-[#2a2a3a] hover:border-white/30'}`}>
              {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {analyzing ? 'AI reading the document…' : file ? file.name : 'Choose a file (notice / order / petition — PDF or photo)'}
              <input type="file" className="hidden" disabled={analyzing} onChange={e => onFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          <Input label="Case title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. OPM vs Santhosh Kuruvila" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={form.case_type} onChange={e => setForm({ ...form, case_type: e.target.value })} options={TYPE_OPTS} />
            <Select label="Our role" value={form.our_role} onChange={e => setForm({ ...form, our_role: e.target.value })} options={ROLE_OPTS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Opposing party" value={form.opposing_party} onChange={e => setForm({ ...form, opposing_party: e.target.value })} />
            <Input label="Related entity / company" value={form.related_entity} onChange={e => setForm({ ...form, related_entity: e.target.value })} placeholder="OPM Dream Mill Cinemas Pvt Ltd" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Court" value={form.court} onChange={e => setForm({ ...form, court: e.target.value })} />
            <Input label="Case number" value={form.case_number} onChange={e => setForm({ ...form, case_number: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Jurisdiction" value={form.jurisdiction} onChange={e => setForm({ ...form, jurisdiction: e.target.value })} placeholder="e.g. Ernakulam" />
            <MoneyInput label="Amount involved (₹)" value={form.amount_involved} onChange={v => setForm({ ...form, amount_involved: v })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STATUS_OPTS} />
            <Input label="Filing date" type="date" value={form.filing_date} onChange={e => setForm({ ...form, filing_date: e.target.value })} />
            <Input label="Next hearing" type="date" value={form.next_hearing_date} onChange={e => setForm({ ...form, next_hearing_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Lawyer" value={form.lawyer_name} onChange={e => setForm({ ...form, lawyer_name: e.target.value })} />
            <Input label="Lawyer contact" value={form.lawyer_contact} onChange={e => setForm({ ...form, lawyer_contact: e.target.value })} />
          </div>

          {aiSummary && <div className="text-xs text-[#aaaacc] bg-[#1a1a24] border border-[#2a2a3a] rounded-lg p-2"><span className="text-[#8888aa]">AI summary:</span> {aiSummary}</div>}
          {keyDates.length > 0 && (
            <div className="text-xs text-[#aaaacc] bg-[#1a1a24] border border-[#2a2a3a] rounded-lg p-2">
              <div className="text-[#8888aa] mb-1">Key dates:</div>
              {keyDates.map((k, i) => <div key={i}>• {k.label}: {k.date}</div>)}
            </div>
          )}
          {obligations.length > 0 && (
            <div className="text-xs text-[#aaaacc] bg-[#1a1a24] border border-[#2a2a3a] rounded-lg p-2">
              <div className="text-[#8888aa] mb-1 flex items-center gap-1"><Sparkles size={11} /> Obligations / next steps:</div>
              {obligations.map((o, i) => <div key={i}>• {o}</div>)}
            </div>
          )}
          {risk && (
            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2 flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> <span>{risk}</span>
            </div>
          )}

          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing ? 'Save changes' : 'Add case'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
