'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox as InboxIcon, Trash2, Mail, Phone } from 'lucide-react'
import { Select } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'

export interface Inquiry {
  id: string; kind: string; name: string; email: string | null; phone: string | null
  company: string | null; subject: string | null; message: string | null
  project_ref: string | null; source: string | null; status: string; created_at: string
}

const KIND_LABEL: Record<string, string> = { line_production: 'Line Production', contact: 'Contact', casting: 'Casting', general: 'General' }
const STATUSES = ['new', 'triaged', 'in_progress', 'closed']
const statusCls: Record<string, string> = {
  new: 'bg-sky-500/15 text-sky-400 border-sky-500/30', triaged: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  in_progress: 'bg-amber-500/15 text-amber-400 border-amber-500/30', closed: 'bg-white/5 text-[#8888aa] border-[#2a2a3a]',
}

export function InboxClient({ rows, isFounder }: { rows: Inquiry[]; isFounder: boolean }) {
  const router = useRouter(); const toast = useToast()
  const [kindFilter, setKindFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const newCount = useMemo(() => rows.filter(r => r.status === 'new').length, [rows])
  const shown = rows.filter(r => (!kindFilter || r.kind === kindFilter) && (!statusFilter || r.status === statusFilter))

  async function setStatus(r: Inquiry, status: string) {
    const supabase = createClient()
    const { error } = await supabase.from('public_inquiries').update({ status }).eq('id', r.id)
    if (error) { toast.error("Couldn't update"); return }
    await logAction('update', 'public_inquiries', r.id, undefined, { status }); router.refresh()
  }
  async function remove(r: Inquiry) {
    if (!window.confirm(`Delete the enquiry from ${r.name}?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('public_inquiries').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'public_inquiries', r.id); toast.success('Deleted'); router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 mr-auto"><InboxIcon size={16} className="text-white/70" /><h3 className="text-sm font-semibold text-white">Enquiries</h3>{newCount > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">{newCount} new</span>}</div>
        <Select label="" value={kindFilter} onChange={e => setKindFilter(e.target.value)} options={[{ value: '', label: 'All kinds' }, ...Object.entries(KIND_LABEL).map(([v, l]) => ({ value: v, label: l }))]} />
        <Select label="" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} options={[{ value: '', label: 'All statuses' }, ...STATUSES.map(s => ({ value: s, label: s.replace('_', ' ') }))]} />
      </div>
      {shown.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No enquiries.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {shown.map(r => (
            <div key={r.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{r.name}</span>
                    <span className="text-[10px] uppercase tracking-wide text-[#8888aa]">{KIND_LABEL[r.kind] ?? r.kind}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusCls[r.status]}`}>{r.status.replace('_', ' ')}</span>
                    <span className="text-[11px] text-[#5a5a7a]">{formatDate(r.created_at)}</span>
                  </div>
                  <div className="text-[11px] text-[#8888aa] mt-0.5 flex items-center gap-3 flex-wrap">
                    {r.company && <span>{r.company}</span>}
                    {r.email && <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 hover:text-white"><Mail size={11} /> {r.email}</a>}
                    {r.phone && <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 hover:text-white"><Phone size={11} /> {r.phone}</a>}
                  </div>
                  {r.subject && <div className="text-xs text-[#c8c8da] mt-1 font-medium">{r.subject}</div>}
                  {r.message && <p className="text-xs text-[#8888aa] mt-1 whitespace-pre-wrap">{r.message}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select value={r.status} onChange={e => setStatus(r, e.target.value)} className="bg-[#1a1a24] border border-[#2a2a3a] rounded text-xs text-white px-1.5 py-1">
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                  {isFounder && <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
