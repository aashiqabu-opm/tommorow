'use client'

import { useState } from 'react'
import { Plus, Trash2, FileText, Upload, ExternalLink, CalendarClock } from 'lucide-react'
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

  function reset() { setTitle(''); setDocType('Agreement'); setExpiry(''); setNotes(''); setFile(null) }

  async function save() {
    if (!title) { toast.error('Title required'); return }
    setSaving(true)
    const supabase = createClient()
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
        <Button icon={Plus} onClick={() => setOpen(true)}>Add document</Button>
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
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {r.file_path && <button onClick={() => view(r)} className="text-[#8888aa] hover:text-white" title="Open"><ExternalLink size={15} /></button>}
                <button onClick={() => remove(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add document">
        <div className="space-y-3">
          <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Flat sale deed — Kochi" />
          <Select label="Type" value={docType} onChange={e => setDocType(e.target.value)} options={DOC_TYPES.map(v => ({ value: v, label: v }))} />
          <Input label="Expiry / renewal date" type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
          <div>
            <label className="block text-xs font-medium text-[#8888aa] mb-1">File (optional)</label>
            <label className="flex items-center gap-2 text-sm text-white bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2 cursor-pointer hover:border-white/30">
              <Upload size={15} /> {file ? file.name : 'Choose a file'}
              <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}
