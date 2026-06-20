'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, Camera, Eye, Download, Trash2, Loader2, Sparkles, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import { VEHICLE_DOC_LABELS } from '@/lib/types'
import type { VehicleDocument, VehicleDocType } from '@/lib/types'

// Tab order per spec
const TABS: VehicleDocType[] = ['rc', 'insurance', 'puc', 'fitness', 'road_tax', 'permit', 'permit_all_india', 'driver_licence', 'other']

const TODAY = new Date().toISOString().slice(0, 10)
const IN30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
function expiryBadge(expiry?: string | null): { cls: string; label: string } | null {
  if (!expiry) return null
  if (expiry < TODAY) return { cls: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Expired' }
  if (expiry <= IN30) return { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: 'Expiring Soon' }
  return { cls: 'bg-green-500/15 text-green-400 border-green-500/30', label: 'Valid' }
}

// Humanise an extracted_data key
const labelKey = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

interface Props {
  vehicleId: string
  vehicleName: string
  canDelete: boolean
  onChange?: () => void
}

export function VehicleDocumentVault({ vehicleId, vehicleName, canDelete, onChange }: Props) {
  const toast = useToast()
  const [docs, setDocs] = useState<VehicleDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<VehicleDocType>('rc')
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/vehicles/documents?vehicle_id=${vehicleId}`)
      const b = await r.json()
      if (r.ok) setDocs(b.documents ?? [])
      else toast.error(b.error || 'Could not load documents')
    } catch { toast.error('Could not load documents') }
    setLoading(false)
  }, [vehicleId, toast])

  useEffect(() => { load() }, [load])

  async function upload(file: File) {
    if (file.size > 25_000_000) { toast.error('File too large (max 25MB)'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('vehicle_id', vehicleId); fd.append('doc_type', tab)
      const r = await fetch('/api/vehicles/documents', { method: 'POST', body: fd })
      const b = await r.json()
      if (!r.ok) { toast.error(b.error || 'Upload failed'); return }
      toast.success(b.ai_extracted ? 'Uploaded — fields read by AI ✓' : 'Uploaded ✓')
      await load(); onChange?.()
    } catch { toast.error('Upload failed') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; if (cameraRef.current) cameraRef.current.value = '' }
  }

  async function openOriginal(id: string, download = false) {
    setBusyId(id)
    try {
      const r = await fetch(`/api/vehicles/documents/${id}`)
      const b = await r.json()
      if (!r.ok || !b.signedUrl) { toast.error(b.error || 'No file attached'); return }
      const url = download ? `${b.signedUrl}${b.signedUrl.includes('?') ? '&' : '?'}download` : b.signedUrl
      window.open(url, '_blank', 'noopener')
    } catch { toast.error('Could not open file') }
    finally { setBusyId(null) }
  }

  async function remove(id: string) {
    if (!confirm('Delete this document and its file? This cannot be undone.')) return
    setBusyId(id)
    try {
      const r = await fetch(`/api/vehicles/documents/${id}`, { method: 'DELETE' })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(b.error || 'Delete failed'); return }
      toast.success('Deleted')
      setDocs(d => d.filter(x => x.id !== id)); onChange?.()
    } catch { toast.error('Delete failed') }
    finally { setBusyId(null) }
  }

  const tabDocs = docs.filter(d => d.doc_type === tab)
  const accept = 'image/*,application/pdf'

  return (
    <div>
      <input ref={fileRef} type="file" accept={accept} hidden onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
      <input ref={cameraRef} type="file" accept={accept} capture="environment" hidden onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#2a2a3a] pb-3">
        {TABS.map(t => {
          const n = docs.filter(d => d.doc_type === t).length
          const hasIssue = docs.some(d => d.doc_type === t && d.expiry_date && d.expiry_date <= IN30)
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t ? 'bg-white text-black' : 'bg-[#1a1a24] text-[#8888aa] hover:text-white border border-[#2a2a3a]'}`}>
              {VEHICLE_DOC_LABELS[t]}
              {n > 0 && <span className={`ml-1.5 ${tab === t ? 'text-black/60' : hasIssue ? 'text-amber-400' : 'text-[#8888aa]'}`}>{n}</span>}
            </button>
          )
        })}
      </div>

      {/* Upload bar */}
      <div className="flex items-center gap-2 mt-4">
        <Button size="sm" icon={Upload} onClick={() => fileRef.current?.click()} loading={uploading} disabled={uploading}>Upload</Button>
        <Button size="sm" variant="secondary" icon={Camera} onClick={() => cameraRef.current?.click()} disabled={uploading}>Take Photo</Button>
        <span className="text-xs text-[#8888aa] flex items-center gap-1"><Sparkles className="w-3 h-3" /> fields auto-read on upload</span>
      </div>

      {/* List */}
      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[#8888aa] py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : uploading ? (
          <div className="flex items-center gap-2 text-sm text-[#8888aa] py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Uploading & reading {VEHICLE_DOC_LABELS[tab]}…</div>
        ) : tabDocs.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-[#2a2a3a] rounded-xl">
            <FileText className="w-8 h-8 text-[#3a3a4a] mx-auto mb-2" />
            <p className="text-sm text-[#8888aa]">No {VEHICLE_DOC_LABELS[tab]} uploaded</p>
            <p className="text-xs text-[#666688] mt-1">Upload or Take Photo above</p>
          </div>
        ) : tabDocs.map(d => {
          const badge = expiryBadge(d.expiry_date)
          const fields = d.extracted_data && typeof d.extracted_data === 'object' ? Object.entries(d.extracted_data).filter(([, v]) => v != null && v !== '') : []
          return (
            <div key={d.id} className="rounded-xl border border-[#2a2a3a] bg-[#13131a] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white truncate">{d.doc_number || d.file_name || VEHICLE_DOC_LABELS[d.doc_type]}</span>
                    {d.ai_extracted && <span className="inline-flex items-center gap-1 text-[10px] text-[#8888aa]"><Sparkles className="w-3 h-3" /> AI</span>}
                    {badge && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>}
                  </div>
                  {d.expiry_date && <p className="text-xs text-[#8888aa] mt-1 tabular-nums">Expires {formatDate(d.expiry_date)}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button title="View original" onClick={() => openOriginal(d.id)} disabled={busyId === d.id} className="p-1.5 rounded-lg text-[#8888aa] hover:text-white hover:bg-[#1a1a24] disabled:opacity-40">
                    {busyId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button title="Download" onClick={() => openOriginal(d.id, true)} disabled={busyId === d.id} className="p-1.5 rounded-lg text-[#8888aa] hover:text-white hover:bg-[#1a1a24] disabled:opacity-40"><Download className="w-4 h-4" /></button>
                  {canDelete && <button title="Delete" onClick={() => remove(d.id)} disabled={busyId === d.id} className="p-1.5 rounded-lg text-red-400/70 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
              {fields.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 border-t border-[#2a2a3a] pt-3">
                  {fields.map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-[#666688]">{labelKey(k)}</p>
                      <p className="text-xs text-[#c8c8da] truncate">{String(v)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="sr-only">{vehicleName}</p>
    </div>
  )
}
