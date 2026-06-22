'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Receipt, Upload, Loader2, Sparkles, Eye } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { PersonalTransaction } from '@/lib/types'

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']

export function ExpensesTab({ ownerId, rows, onChange }: { ownerId: string; rows: PersonalTransaction[]; onChange: () => void }) {
  const router = useRouter()
  const toast = useToast()
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const review = useMemo(() => rows.filter(r => r.needs_review).sort((a, b) => (b.txn_date || '').localeCompare(a.txn_date || '')), [rows])
  const ledger = useMemo(() => [...rows].sort((a, b) => (b.txn_date || '').localeCompare(a.txn_date || '')), [rows])

  // Toggle business/personal; toggling counts as reviewed → clears needs_review.
  async function toggleBusiness(r: PersonalTransaction) {
    setBusyId(r.id)
    const supabase = createClient()
    const next = !r.is_business_expense
    const { error } = await supabase.from('personal_transactions')
      .update({ is_business_expense: next, needs_review: false }).eq('id', r.id)
    if (error) { toast.error("Couldn't update"); setBusyId(null); return }
    await logAction('update', 'personal_transactions', r.id, undefined, { is_business_expense: next, needs_review: false })
    setBusyId(null); onChange()
  }

  async function uploadReceipt(file: File) {
    if (!ALLOWED.includes(file.type)) { toast.error('Image or PDF only'); return }
    if (file.size > 25_000_000) { toast.error('File too large (max 25MB)'); return }
    setUploading(true)
    try {
      const supabase = createClient()
      const safe = file.name.replace(/[^a-z0-9._-]+/gi, '_')
      const path = `receipts/${ownerId}/${Date.now()}_${safe}`
      const { error: upErr } = await supabase.storage.from('personal').upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) { toast.error('Upload failed: ' + upErr.message.slice(0, 80)); setUploading(false); return }
      const { data: rec, error: insErr } = await supabase.from('personal_transactions').insert({
        owner_id: ownerId, origin: 'receipt', source: 'card', snapshot_url: path,
        needs_review: true, direction: 'debit', amount: 0,
      }).select().single()
      if (insErr) { await supabase.storage.from('personal').remove([path]); toast.error(insErr.message.slice(0, 80)); setUploading(false); return }
      await logAction('create', 'personal_transactions', rec.id, undefined, { origin: 'receipt' })
      toast.success('Receipt uploaded — add the merchant & amount below')
      onChange()
    } catch { toast.error('Upload failed') }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function viewReceipt(path: string) {
    const supabase = createClient()
    const { data } = await supabase.storage.from('personal').createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
    else toast.error('Could not open receipt')
  }

  function Row({ r, compact }: { r: PersonalTransaction; compact?: boolean }) {
    return (
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-t border-[#2a2a3a] first:border-t-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-white truncate">{r.merchant || <span className="text-[#5a5a7a] italic">— add merchant —</span>}</span>
            {r.ai_category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 inline-flex items-center gap-0.5"><Sparkles size={9} /> {r.ai_category}</span>}
            {r.snapshot_url && <button onClick={() => viewReceipt(r.snapshot_url!)} title="View receipt" className="text-[#8888aa] hover:text-white"><Eye size={12} /></button>}
          </div>
          <div className="text-[11px] text-[#8888aa] mt-0.5">{formatDate(r.txn_date)}{r.account_label ? ` · ${r.account_label}` : ''}{compact ? '' : (r.notes ? ` · ${r.notes}` : '')}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold text-white tabular-nums">{formatCurrency(Number(r.amount || 0))}</span>
          <button onClick={() => toggleBusiness(r)} disabled={busyId === r.id}
            className={`text-[10px] px-2 py-1 rounded-lg border ${r.is_business_expense ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-[#8888aa] border-[#2a2a3a]'} disabled:opacity-40`}>
            {busyId === r.id ? <Loader2 size={11} className="animate-spin" /> : (r.is_business_expense ? 'Business' : 'Personal')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={e => e.target.files?.[0] && uploadReceipt(e.target.files[0])} />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2"><Receipt size={16} className="text-white/70" /><h3 className="text-sm font-semibold text-white">Expenses</h3></div>
        <Button size="sm" icon={Upload} loading={uploading} onClick={() => fileRef.current?.click()}>Snap Receipt</Button>
      </div>
      <p className="text-[11px] text-[#8888aa] flex items-center gap-1.5"><Sparkles size={12} /> AI suggests a category; nothing is auto-approved — every row stays in review until you confirm Business/Personal.</p>

      {/* Needs review */}
      <div className="bg-[#13131a] border border-amber-500/20 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center justify-between">
          <h4 className="text-xs font-semibold text-amber-300">Needs review</h4>
          <span className="text-[11px] text-[#8888aa]">{review.length}</span>
        </div>
        {review.length === 0 ? <div className="py-6 text-center text-sm text-[#8888aa]">Nothing awaiting review.</div> : review.map(r => <Row key={r.id} r={r} compact />)}
      </div>

      {/* Full ledger */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center justify-between">
          <h4 className="text-xs font-semibold text-white">Transaction ledger</h4>
          <span className="text-[11px] text-[#8888aa]">{ledger.length}</span>
        </div>
        {ledger.length === 0 ? <div className="py-6 text-center text-sm text-[#8888aa]">No transactions yet.</div> : ledger.map(r => <Row key={r.id} r={r} />)}
      </div>
    </div>
  )
}
