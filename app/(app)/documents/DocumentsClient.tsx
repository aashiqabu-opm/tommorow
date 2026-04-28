'use client'

import { useState } from 'react'
import { Plus, FileText, AlertTriangle, Clock } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge, getDocumentStatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { formatDate, formatCurrency, DOCUMENT_TYPE_LABELS, isExpiringSoon, isExpired, getExpiryStatus } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { Document } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  documents: Document[]
  projects: { id: string; name: string }[]
  userId: string
  role: string
}

const DOCUMENT_TYPE_OPTIONS = Object.entries(DOCUMENT_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))

const INITIAL_FORM = {
  title: '',
  document_type: 'other',
  project_id: '',
  party_name: '',
  document_date: '',
  expiry_date: '',
  renewal_date: '',
  amount_linked: '',
  status: 'draft',
  access_level: 'project_team',
  notes: '',
}

export function DocumentsClient({ documents, projects, userId, role }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [file, setFile] = useState<File | null>(null)
  const [filter, setFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')

  const canUpload = ['founder', 'accountant', 'production_manager'].includes(role)

  const expiring = documents.filter(d => d.expiry_date && isExpiringSoon(d.expiry_date, 30))
  const expired = documents.filter(d => d.expiry_date && isExpired(d.expiry_date))
  const signed = documents.filter(d => d.status === 'signed' || d.status === 'active')

  const filtered = documents.filter(d => {
    if (projectFilter && d.project_id !== projectFilter) return false
    if (filter && !d.title.toLowerCase().includes(filter.toLowerCase()) && !d.party_name?.toLowerCase().includes(filter.toLowerCase())) return false
    return true
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()

    const { data: doc, error } = await supabase.from('documents').insert({
      title: form.title,
      document_type: form.document_type,
      project_id: form.project_id || null,
      party_name: form.party_name || null,
      document_date: form.document_date || null,
      expiry_date: form.expiry_date || null,
      renewal_date: form.renewal_date || null,
      amount_linked: parseFloat(form.amount_linked) || null,
      status: form.status,
      access_level: form.access_level,
      notes: form.notes || null,
      uploaded_by: userId,
    }).select().single()

    if (!error && doc && file) {
      const path = `documents/${doc.id}/${file.name}`
      const { data: up } = await supabase.storage.from('documents').upload(path, file)
      if (up) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
        await supabase.from('document_files').insert({
          document_id: doc.id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          uploaded_by: userId,
        })
      }
    }

    if (!error && doc) await logAction('create', 'documents', doc.id, undefined, doc)
    setSaving(false)
    setOpen(false)
    setForm(INITIAL_FORM)
    setFile(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Vault"
        subtitle="Organize and manage all company documents"
        action={canUpload ? <Button icon={Plus} onClick={() => setOpen(true)}>Upload Document</Button> : undefined}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Documents" value={documents.length} icon={FileText} status="default" />
        <StatCard title="Signed / Active" value={signed.length} status="green" />
        <StatCard title="Expiring Soon" value={expiring.length} icon={Clock} status={expiring.length > 0 ? 'yellow' : 'green'} subtitle="Within 30 days" />
        <StatCard title="Expired" value={expired.length} icon={AlertTriangle} status={expired.length > 0 ? 'red' : 'green'} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          placeholder="Search documents..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="flex-1 min-w-48 bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-2 text-sm text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-violet-500/60"
        />
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/60"
        >
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Documents grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-[#8888aa] text-sm">No documents found</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(doc => {
            const statusB = getDocumentStatusBadge(doc.status)
            const expiryS = getExpiryStatus(doc.expiry_date)
            return (
              <div key={doc.id} className={`bg-[#13131a] border rounded-2xl p-5 transition-colors ${expiryS === 'expired' ? 'border-red-500/30' : expiryS === 'warning' ? 'border-amber-500/30' : 'border-[#2a2a3a]'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center">
                    <FileText size={16} className="text-violet-400" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge label={statusB.label} variant={statusB.variant} />
                    {expiryS === 'expired' && <StatusBadge label="Expired" variant="red" />}
                    {expiryS === 'warning' && <StatusBadge label="Expiring" variant="yellow" />}
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1 line-clamp-1">{doc.title}</h3>
                <div className="text-xs text-[#8888aa] space-y-0.5">
                  <div>{DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type}</div>
                  {doc.party_name && <div>{doc.party_name}</div>}
                  {(doc.project as { name?: string } | null)?.name && <div>📁 {(doc.project as { name?: string }).name}</div>}
                  {doc.expiry_date && <div className={expiryS === 'expired' ? 'text-red-400' : expiryS === 'warning' ? 'text-amber-400' : ''}>Expires: {formatDate(doc.expiry_date)}</div>}
                  {doc.amount_linked && <div>{formatCurrency(doc.amount_linked)}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Upload Document" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Document Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Document Type" value={form.document_type} onChange={e => setForm({ ...form, document_type: e.target.value })} options={DOCUMENT_TYPE_OPTIONS} />
            <Select label="Project" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}
              options={projects.map(p => ({ value: p.id, label: p.name }))} placeholder="— No project —" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Party / Person / Company" value={form.party_name} onChange={e => setForm({ ...form, party_name: e.target.value })} />
            <Input label="Amount Linked" type="number" value={form.amount_linked} onChange={e => setForm({ ...form, amount_linked: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Document Date" type="date" value={form.document_date} onChange={e => setForm({ ...form, document_date: e.target.value })} />
            <Input label="Expiry Date" type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
            <Input label="Renewal Date" type="date" value={form.renewal_date} onChange={e => setForm({ ...form, renewal_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              options={[{ value: 'draft', label: 'Draft' }, { value: 'signed', label: 'Signed' }, { value: 'active', label: 'Active' }, { value: 'expired', label: 'Expired' }, { value: 'disputed', label: 'Disputed' }]} />
            <Select label="Access Level" value={form.access_level} onChange={e => setForm({ ...form, access_level: e.target.value })}
              options={[
                { value: 'founder_only', label: 'Founder Only' },
                { value: 'finance_team', label: 'Finance Team' },
                { value: 'project_team', label: 'Project Team' },
                { value: 'all_staff', label: 'All Staff' },
              ]} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#8888aa]">File Upload</label>
            <input type="file" accept=".pdf,.doc,.docx,image/*" onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-[#8888aa] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#2a2a3a] file:text-white file:text-xs" />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Upload Document</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
