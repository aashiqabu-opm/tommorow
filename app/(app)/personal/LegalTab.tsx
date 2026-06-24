'use client'

import { useState } from 'react'
import { Plus, Trash2, FileText, Upload, ExternalLink, CalendarClock, Sparkles, Loader2, Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { PersonalDocument } from '@/lib/types'

const DOC_TYPES = ['ID proof', 'Property deed', 'Agreement', 'Insurance', 'Will / nominee', 'Certificate', 'Other']

export function LegalTab({ ownerId, rows, onChange }: { ownerId: string; rows: PersonalDocument[]; onChange: () => void }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('Agreement')
  const [expiry, setExpiry] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  // AI auto-fill state
  const [analyzing, setAnalyzing] = useState(false)
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [keyDates, setKeyDates] = useState<{ label: string; date: string }[]>([])
  const [aiFilled, setAiFilled] = useState(false)
  const [editing, setEditing] = useState<PersonalDocument | null>(null)

  function reset() { setTitle(''); setDocType('Agreement'); setExpiry(''); setNotes(''); setFile(null); setAiSummary(null); setKeyDates([]); setAiFilled(false); setEditing(null) }
  function openNew() { reset(); setOpen(true) }
  function openEdit(r: PersonalDocument) { reset(); setEditing(r); setTitle(r.title); setDocType(r.doc_type); setExpiry(r.expiry_date ?? ''); setNotes(r.notes ?? ''); setAiSummary(r.ai_summary ?? null); setKeyDates(r.key_dates ?? []); setOpen(true) }

  function fileToBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
      r.onerror = reject
      r.readAsDataURL(f)
    })
  }

  // On file select: keep the file for upload AND let AI read it to pre-fill the form.
  async function onFile(f: File | null) {
    setFile(f)
    if (!f) return
    const okTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
    if (!okTypes.includes(f.type)) return
    if (f.size > 6_500_000) { toast.error('File too big for AI read (~6MB) — it will still upload.'); return }
    setAnalyzing(true)
    try {
      const base64 = await fileToBase64(f)
      const res = await fetch('/api/personal/analyze-doc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType: f.type }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "AI couldn't read it — fill manually"); return }
      const x = data.extracted as { title: string | null; doc_type: string | null; summary: string | null; expiry_date: string | null; key_dates: { label: string; date: string }[]; identifiers: { label: string; value: string }[]; amount: number | null }
      if (x.title && !title) setTitle(x.title)
      if (x.doc_type && DOC_TYPES.includes(x.doc_type)) setDocType(x.doc_type)
      if (x.expiry_date) setExpiry(x.expiry_date)
      setKeyDates(x.key_dates ?? [])
      setAiSummary(x.summary ?? null)
      const idLines = (x.identifiers ?? []).map(i => `${i.label}: ${i.value}`).join('\n')
      const amtLine = x.amount ? `Amount: ₹${Number(x.amount).toLocaleString('en-IN')}` : ''
      const extra = [idLines, amtLine].filter(Boolean).join('\n')
      if (extra) setNotes(prev => prev ? prev : extra)
      setAiFilled(true)
      toast.success('AI filled the form — review and save')
    } catch {
      toast.error("AI couldn't read it — fill manually")
    } finally {
      setAnalyzing(false)
    }
  }

  async function save() {
    if (!title) { toast.error('Title required'); return }
    setSaving(true)
    const supabase = createClient()
    if (editing) {
      const patch: Record<string, unknown> = { title, doc_type: docType, expiry_date: expiry || null, notes: notes || null }
      if (file) {
        const ext2 = file.name.split('.').pop()
        const path2 = `${ownerId}/${Date.now()}.${ext2}`
        const { error: e2 } = await supabase.storage.from('personal').upload(path2, file, { upsert: false })
        if (e2) { toast.error("Couldn't upload file"); setSaving(false); return }
        patch.file_path = path2; patch.file_name = file.name
      }
      const { error } = await supabase.from('personal_documents').update(patch).eq('id', editing.id)
      setSaving(false)
      if (error) { toast.error("Couldn't save"); return }
      await logAction('update', 'personal_documents', editing.id)
      setOpen(false); reset(); toast.success('Document updated'); onChange()
      return
    }
    let filePath: string | null = null
    let fileName: string | null = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `${ownerId}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('personal').upload(path, file, { upsert: false })
      if (upErr) { toast.error("Couldn't upload file"); setSaving(false); return }
      filePath = path; fileName = file.name
    }
    const { data, error } = await supabase.from('personal_documents').insert({
      owner_id: ownerId, title, doc_type: docType, expiry_date: expiry || null, notes: notes || null, file_path: filePath, file_name: fileName,
      ai_summary: aiSummary, key_dates: keyDates.length ? keyDates : null,
    }).select().single()
    setSaving(false)
    if (error) { toast.error("Couldn't save"); return }
    if (data) await logAction('create', 'personal_documents', data.id)
    setOpen(false); reset(); toast.success('Document saved'); onChange()
  }

  async function view(r: PersonalDocument) {
    if (!r.file_path) { toast.error('No file attached'); return }
    const supabase = createClient()
    const { data, error } = await supabase.storage.from('personal').createSignedUrl(r.file_path, 120)
    if (error || !data) { toast.error("Couldn't open file"); return }
    window.open(data.signedUrl, '_blank')
  }

  async function remove(r: PersonalDocument) {
    if (!confirm('Delete this document?')) return
    const supabase = createClient()
    if (r.file_path) await supabase.storage.from('personal').remove([r.file_path])
    await supabase.from('personal_documents').delete().eq('id', r.id)
    await logAction('delete', 'personal_documents', r.id)
    toast.success('Deleted'); onChange()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-[#8888aa]">Private, encrypted vault — files are owner-only with signed links. AI summaries arrive in Phase 3.</p>
        <Button icon={Plus} onClick={openNew}>Add document</Button>
      </div>
      {rows.length === 0 ? (
        <div className="text-center text-sm text-[#8888aa] bg-[#13131a] border border-dashed border-[#2a2a3a] rounded-xl py-10 px-6">
          No documents yet. Store deeds, agreements, IDs, insurance, will/nominee info — with key-date alerts.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-3">
              <div className="min-w-0 flex items-center gap-3">
                <FileText size={18} className="text-[#8888aa] shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm text-white font-medium truncate">{r.title} <span className="text-[#8888aa] font-normal">· {r.doc_type}</span></div>
                  <div className="text-xs text-[#8888aa] mt-0.5 flex items-center gap-2">
                    {r.expiry_date && <span className="flex items-center gap-1"><CalendarClock size={12} /> expires {formatDate(r.expiry_date)}</span>}
                    {r.file_name && <span className="truncate">{r.file_name}</span>}
                    {!r.expiry_date && !r.file_name && <span>{r.notes ?? '—'}</span>}
                  </div>
                  {r.ai_summary && <div className="text-xs text-[#aaaacc] mt-1 line-clamp-2">{r.ai_summary}</div>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {r.file_path && <button onClick={() => view(r)} className="text-[#8888aa] hover:text-white" title="Open"><ExternalLink size={15} /></button>}
                <button onClick={() => openEdit(r)} className="text-[#8888aa] hover:text-white" title="Edit"><Pencil size={15} /></button>
                <button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit document' : 'Add document'}>
        <div className="space-y-3">
          {/* Upload first — AI reads it and fills the rest */}
          <div>
            <label className="block text-xs font-medium text-[#8888aa] mb-1">File — AI reads it and fills the form</label>
            <label className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 cursor-pointer border ${analyzing ? 'border-[#D6B16F]/50 text-[#D6B16F]' : 'text-white bg-[#1a1a24] border-[#2a2a3a] hover:border-white/30'}`}>
              {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {analyzing ? 'AI reading the document…' : file ? file.name : 'Choose a file (photo / PDF)'}
              <input type="file" className="hidden" disabled={analyzing} onChange={e => onFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          {aiFilled && (
            <div className="text-[11px] text-[#D6B16F] flex items-center gap-1"><Sparkles size={12} /> AI-filled below — please review before saving.</div>
          )}
          <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Flat sale deed — Kochi" />
          <Select label="Type" value={docType} onChange={e => setDocType(e.target.value)} options={DOC_TYPES.map(v => ({ value: v, label: v }))} />
          <Input label="Expiry / renewal date" type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
          {aiSummary && <div className="text-xs text-[#aaaacc] bg-[#1a1a24] border border-[#2a2a3a] rounded-lg p-2"><span className="text-[#8888aa]">AI summary:</span> {aiSummary}</div>}
          {keyDates.length > 0 && (
            <div className="text-xs text-[#aaaacc] bg-[#1a1a24] border border-[#2a2a3a] rounded-lg p-2">
              <div className="text-[#8888aa] mb-1">Key dates found:</div>
              {keyDates.map((k, i) => <div key={i}>• {k.label}: {k.date}</div>)}
            </div>
          )}
          <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}
