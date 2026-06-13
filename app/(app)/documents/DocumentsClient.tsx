'use client'

import { useState } from 'react'
import { Plus, FileText, AlertTriangle, Clock, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge, getDocumentStatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { formatDate, formatCurrency, DOCUMENT_TYPE_LABELS, isExpiringSoon, isExpired, getExpiryStatus } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { compressImage } from '@/lib/compressImage'
import { useToast } from '@/components/ui/Toast'
import { FilePicker } from '@/components/ui/FilePicker'
import type { Document, DocumentAnalysisData } from '@/lib/types'
import { useRouter } from 'next/navigation'

const SEVERITY_CLS: Record<string, string> = {
  high: 'bg-red-500/15 border-red-500/30 text-red-300',
  medium: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
  low: 'bg-[#1a1a24] border-[#2a2a3a] text-[#c8c8da]',
}

function DocInsights({ a }: { a: DocumentAnalysisData }) {
  return (
    <div className="mt-3 bg-[#0f0f16] border border-[#2a2a3a] rounded-xl p-4 space-y-3 text-left">
      <p className="text-xs text-[#c8c8da] leading-relaxed">{a.summary}</p>
      {a.parties?.length > 0 && (
        <div className="text-[11px] text-[#8888aa]">Parties: <span className="text-[#c8c8da]">{a.parties.join(', ')}</span></div>
      )}
      {a.key_dates?.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#8888aa] mb-1">Key dates</div>
          <div className="space-y-1">
            {a.key_dates.map((kd, i) => {
              const days = Math.ceil((new Date(kd.date + 'T00:00:00').getTime() - Date.now()) / 86400000)
              const cls = isNaN(days) ? 'text-[#c8c8da]' : days < 0 ? 'text-red-400' : days <= 30 ? 'text-amber-400' : 'text-[#c8c8da]'
              const tag = isNaN(days) ? '' : days < 0 ? 'passed' : days === 0 ? 'today' : days <= 60 ? `in ${days}d` : ''
              return (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#8888aa] truncate">{kd.label}</span>
                  <span className={`tabular-nums shrink-0 ${cls}`}>{formatDate(kd.date)}{tag && <span className="text-[10px] ml-1">· {tag}</span>}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {a.financial_terms?.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#8888aa] mb-1">Financial terms</div>
          <div className="space-y-0.5">
            {a.financial_terms.map((ft, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[#8888aa] truncate">{ft.label}{ft.note ? <span className="text-[#5a5a7a]"> · {ft.note}</span> : ''}</span>
                {ft.amount != null && <span className="text-emerald-400 tabular-nums shrink-0">{formatCurrency(ft.amount)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {a.obligations?.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#8888aa] mb-1">Obligations</div>
          <ul className="list-disc list-inside space-y-0.5 text-xs text-[#c8c8da]">
            {a.obligations.map((o, i) => <li key={i}>{o}</li>)}
          </ul>
        </div>
      )}
      {a.flags?.length > 0 && (
        <div className="space-y-1">
          {a.flags.map((f, i) => (
            <div key={i} className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${SEVERITY_CLS[f.severity] ?? SEVERITY_CLS.low}`}>
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{f.note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)
  const [file, setFile] = useState<File | null>(null)
  const [filter, setFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  async function analyze(documentId: string) {
    setAnalyzingId(documentId)
    try {
      const res = await fetch('/api/analyze-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(
          data.error === 'not_configured' ? 'AI isn’t configured (ANTHROPIC_API_KEY).'
            : data.detail ? `Analysis failed: ${String(data.detail).slice(0, 80)}`
            : (data.error ?? 'Analysis failed')
        )
      } else {
        toast.success('Document analyzed by AI')
        setExpandedId(documentId)
        router.refresh()
      }
    } catch {
      toast.error('Network error during analysis')
    } finally {
      setAnalyzingId(null)
    }
  }

  const canUpload = ['founder', 'accountant', 'general_manager', 'executive_producer'].includes(role)

  // Which access levels the uploader's own role can read back (mirrors the RLS read policy)
  const ALL_LEVELS = ['founder_only', 'finance_team', 'project_team', 'all_staff']
  const VISIBLE_LEVELS: Record<string, string[]> = {
    founder: ALL_LEVELS,
    accountant: ALL_LEVELS,
    general_manager: ALL_LEVELS,
    executive_producer: ALL_LEVELS,
    legal_viewer: ['project_team', 'all_staff'],
  }
  const willBeHidden = !(VISIBLE_LEVELS[role] ?? ['project_team', 'all_staff']).includes(form.access_level)

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

    // Generate the id client-side so we never read the row back: a "Founder
    // Only" (or finance) document uploaded by a non-founder can't be SELECTed
    // under the read policy, which would make a successful insert look failed.
    const docId = crypto.randomUUID()
    const payload = {
      id: docId,
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
    }
    const { error } = await supabase.from('documents').insert(payload)

    if (error) {
      toast.error("Couldn't save document — please try again")
      setSaving(false)
      return
    }

    if (file) {
      const upload = await compressImage(file)
      const path = `documents/${docId}/${upload.name}`
      const { data: up, error: upErr } = await supabase.storage.from('documents').upload(path, upload)
      if (upErr) { toast.error('File upload failed — check storage bucket'); setSaving(false); return }
      if (up) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
        await supabase.from('document_files').insert({
          document_id: docId,
          file_name: upload.name,
          file_url: urlData.publicUrl,
          file_size: upload.size,
          uploaded_by: userId,
        })
      }
    }

    await logAction('create', 'documents', docId, undefined, payload as unknown as Record<string, unknown>)
    toast.success(file ? 'Document saved — AI is analyzing it' : 'Document saved')
    setSaving(false)
    setOpen(false)
    setForm(INITIAL_FORM)
    setFile(null)
    router.refresh()
    // Kick off AI analysis in the background for the just-uploaded file
    if (file) void analyze(docId)
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
          className="flex-1 min-w-48 bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-2 text-sm text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-white/40"
        />
        <select
          value={projectFilter}
          onChange={e => setProjectFilter(e.target.value)}
          className="bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/40"
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
                  <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                    <FileText size={16} className="text-white/70" />
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

                {(() => {
                  const hasFile = (doc.files?.length ?? 0) > 0
                  const a = doc.ai_analysis
                  const flagCount = a?.flags?.length ?? 0
                  if (!a && !(hasFile && canUpload)) return null
                  return (
                    <div className="mt-3 pt-3 border-t border-[#2a2a3a]">
                      {a ? (
                        <button onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                          className="w-full flex items-center justify-between text-xs text-white/80 hover:text-white">
                          <span className="inline-flex items-center gap-1.5">
                            <Sparkles size={12} className="text-indigo-300" /> AI insights
                            {flagCount > 0 && <span className="text-amber-300">· {flagCount} flag{flagCount > 1 ? 's' : ''}</span>}
                          </span>
                          {expandedId === doc.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      ) : (
                        <button onClick={() => analyze(doc.id)} disabled={analyzingId === doc.id}
                          className="inline-flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 disabled:opacity-50">
                          <Sparkles size={12} className={analyzingId === doc.id ? 'animate-pulse' : ''} />
                          {analyzingId === doc.id ? 'Analyzing…' : 'Analyze with AI'}
                        </button>
                      )}
                      {a && expandedId === doc.id && (
                        <>
                          <DocInsights a={a} />
                          {canUpload && (
                            <button onClick={() => analyze(doc.id)} disabled={analyzingId === doc.id}
                              className="mt-2 text-[11px] text-[#8888aa] hover:text-white inline-flex items-center gap-1 disabled:opacity-50">
                              <Sparkles size={10} className={analyzingId === doc.id ? 'animate-pulse' : ''} /> {analyzingId === doc.id ? 'Re-analyzing…' : 'Re-analyze'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )
                })()}
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
          {willBeHidden && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 text-xs text-amber-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>With this access level, you won&apos;t be able to see this document after uploading — only {form.access_level === 'founder_only' ? 'founders' : 'founders and the finance team'} can. It still saves correctly.</span>
            </div>
          )}
          <FilePicker label="File Upload" file={file} onChange={setFile} accept=".pdf,.doc,.docx,image/*" />
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
