'use client'

import { useState } from 'react'
import { Plus, Printer, Download, FileText, Trash2, Upload, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { FilePicker } from '@/components/ui/FilePicker'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import { BUILTIN_TEMPLATES } from '@/lib/templates'
import { createClient } from '@/lib/supabase/client'
import { openDoc } from '@/lib/storage'
import { logAction } from '@/lib/audit'
import { useRouter } from 'next/navigation'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

interface Props { templates: Row[]; userId: string; canManage: boolean; role: string }

const CAT_LABELS: Record<string, string> = { voucher: 'Voucher', agreement: 'Agreement', form: 'Form', hr: 'HR', other: 'Other' }

export function TemplatesClient({ templates, userId, canManage, role }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'agreement', description: '' })
  const [file, setFile] = useState<File | null>(null)
  const [editing, setEditing] = useState<Row | null>(null)

  function openNew() { setEditing(null); setForm({ name: '', category: 'agreement', description: '' }); setFile(null); setOpen(true) }
  function openEdit(t: Row) { setEditing(t); setForm({ name: t.name, category: t.category, description: t.description ?? '' }); setFile(null); setOpen(true) }

  function printTemplate(html: string) {
    const w = window.open('', '_blank')
    if (!w) return toast.error('Allow pop-ups to open the template')
    w.document.write(html); w.document.close(); w.focus()
    setTimeout(() => w.print(), 350)
  }
  function downloadHtml(name: string, html: string) {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${name.replace(/[^a-z0-9]+/gi, '_')}.html`; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Enter a name')
    const supabase = createClient()
    // Edit: update metadata (and file only if a new one was chosen).
    if (editing) {
      setSaving(true)
      const patch: Row = { name: form.name.trim(), category: form.category, description: form.description || null }
      if (file) {
        const ext2 = file.name.split('.').pop()
        const path2 = `templates/${Date.now()}.${ext2}`
        const { data: up2, error: e2 } = await supabase.storage.from('documents').upload(path2, file)
        if (e2) { toast.error('Upload failed'); setSaving(false); return }
        if (up2) { patch.file_url = supabase.storage.from('documents').getPublicUrl(path2).data.publicUrl; patch.file_name = file.name; patch.file_size = file.size }
      }
      const { error } = await supabase.from('templates').update(patch).eq('id', editing.id)
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('update', 'templates', editing.id, undefined, patch)
      toast.success('Template updated'); setSaving(false); setOpen(false); setEditing(null); router.refresh()
      return
    }
    if (!file) return toast.error('Choose a file to upload')
    setSaving(true)
    const ext = file.name.split('.').pop()
    const path = `templates/${Date.now()}.${ext}`
    const { data: up, error: upErr } = await supabase.storage.from('documents').upload(path, file)
    if (upErr) { toast.error('Upload failed — check storage bucket'); setSaving(false); return }
    const fileUrl = up ? supabase.storage.from('documents').getPublicUrl(path).data.publicUrl : null
    const { data, error } = await supabase.from('templates').insert({
      name: form.name.trim(), category: form.category, description: form.description || null,
      file_url: fileUrl, file_name: file.name, file_size: file.size, created_by: userId,
    }).select().single()
    if (error) {
      const hint = /relation .*templates.* does not exist/i.test(error.message) ? 'run migration-templates.sql first' : error.message
      toast.error(`Couldn't save — ${String(hint).slice(0, 80)}`); setSaving(false); return
    }
    if (data) await logAction('create', 'templates', data.id, undefined, data)
    toast.success('Template uploaded')
    setSaving(false); setOpen(false); setForm({ name: '', category: 'agreement', description: '' }); setFile(null)
    router.refresh()
  }

  async function remove(t: Row) {
    if (!window.confirm(`Delete template "${t.name}"?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('templates').delete().eq('id', t.id)
    if (error) { toast.error("Couldn't delete — you may not have permission"); return }
    await logAction('delete', 'templates', t.id, undefined, undefined)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Templates & Forms" subtitle="Standard formats to print or download, and your own uploaded templates"
        action={canManage ? <Button icon={Upload} onClick={openNew}>Upload Template</Button> : undefined} />

      {/* Built-in printable formats */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Standard Formats</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BUILTIN_TEMPLATES.map(t => (
            <div key={t.id} className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 flex flex-col">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-white/70" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{t.name}</div>
                  <div className="text-[11px] text-[#8888aa] uppercase tracking-wide">{CAT_LABELS[t.category]}</div>
                </div>
              </div>
              <p className="text-xs text-[#8888aa] flex-1">{t.description}</p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" icon={Printer} onClick={() => printTemplate(t.build())}>Print / PDF</Button>
                <Button size="sm" variant="secondary" icon={Download} onClick={() => downloadHtml(t.name, t.build())}>Download</Button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[#5a5a7a] mt-2">Agreement formats are starting drafts — have them reviewed by legal counsel before use. Upload your own vetted versions below.</p>
      </div>

      {/* Uploaded templates */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Uploaded Templates</h3>
        {templates.length === 0 ? (
          <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl py-10 text-center text-sm text-[#8888aa]">
            No uploaded templates yet.{canManage ? ' Upload your firm’s vetted agreement & form formats for the team.' : ''}
          </div>
        ) : (
          <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl divide-y divide-[#2a2a3a]">
            {templates.map(t => (
              <div key={t.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-white truncate">{t.name}</span>
                    <span className="text-[10px] text-[#8888aa] uppercase tracking-wide bg-[#1a1a24] border border-[#2a2a3a] rounded px-1.5 py-0.5">{CAT_LABELS[t.category] ?? t.category}</span>
                  </div>
                  <div className="text-xs text-[#8888aa] truncate">{t.description ? `${t.description} · ` : ''}{(t.uploader as { full_name?: string } | null)?.full_name ?? ''} · {formatDate(t.created_at)}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button type="button" onClick={() => openDoc(t.file_url)} className="text-xs text-white/80 hover:text-white inline-flex items-center gap-1"><Download size={14} /> Download</button>
                  {(role === 'founder' || t.created_by === userId) && (
                    <>
                      <button onClick={() => openEdit(t)} className="text-[#5a5a7a] hover:text-white"><Pencil size={14} /></button>
                      <button onClick={() => remove(t)} className="text-[#5a5a7a] hover:text-red-400"><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Template' : 'Upload Template'}>
        <form onSubmit={handleUpload} className="space-y-4">
          <Input label="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Artist Agreement (final)" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              options={[{ value: 'agreement', label: 'Agreement' }, { value: 'voucher', label: 'Voucher' }, { value: 'form', label: 'Form' }, { value: 'hr', label: 'HR' }, { value: 'other', label: 'Other' }]} />
          </div>
          <Textarea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
          <FilePicker label={editing ? 'Replace file (optional)' : 'File *'} file={file} onChange={setFile} accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving} icon={editing ? Pencil : Plus}>{editing ? 'Save' : 'Upload'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
