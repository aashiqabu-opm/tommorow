'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Receipt, ExternalLink, Download, Check, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

export interface GstInput {
  id: string
  source_owner?: string | null
  vendor?: string | null
  gstin?: string | null
  invoice_no?: string | null
  invoice_date?: string | null
  taxable_value?: number | null
  gst_amount?: number | null
  total?: number | null
  snapshot_url?: string | null
  category?: string | null
  filed: boolean
  created_at: string
}

export function GstInputsClient({ rows }: { rows: GstInput[] }) {
  const toast = useToast()
  const router = useRouter()
  const [filter, setFilter] = useState<'unfiled' | 'all'>('unfiled')

  const unfiled = rows.filter(r => !r.filed)
  const creditUnfiled = unfiled.reduce((s, r) => s + Number(r.gst_amount ?? 0), 0)
  const creditAll = rows.reduce((s, r) => s + Number(r.gst_amount ?? 0), 0)
  const shown = filter === 'unfiled' ? unfiled : rows
  const [ingesting, setIngesting] = useState(false)

  async function ingestFromEmail() {
    setIngesting(true)
    try {
      const res = await fetch('/api/tax/ingest-shiny-reply', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'Could not read the reply')
      else { toast.success(`Filed ${data.tdsSectionsFiled} TDS sections + ${data.gstInputsAdded} GST inputs from Shiny's reply`); router.refresh() }
    } catch { toast.error('Ingest failed') }
    setIngesting(false)
  }

  async function toggleFiled(r: GstInput) {
    const supabase = createClient()
    const { error } = await supabase.from('gst_inputs').update({ filed: !r.filed }).eq('id', r.id)
    if (error) { toast.error("Couldn't update"); return }
    router.refresh()
  }

  function exportCsv() {
    const head = ['Invoice date', 'Vendor', 'GSTIN', 'Invoice no', 'Taxable', 'GST', 'Total', 'Category', 'Filed']
    const lines = shown.map(r => [r.invoice_date ?? '', r.vendor ?? '', r.gstin ?? '', r.invoice_no ?? '', r.taxable_value ?? '', r.gst_amount ?? '', r.total ?? '', r.category ?? '', r.filed ? 'yes' : 'no'].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const csv = [head.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gst-inputs-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  }

  return (
    <div>
      <PageHeader title="GST Inputs" subtitle="Input-credit register — pushed from the founder's receipts, ready for filing."
        action={<div className="flex gap-2">
          <Button icon={RefreshCw} variant="secondary" loading={ingesting} onClick={ingestFromEmail}>Import from Shiny&apos;s reply</Button>
          <Button icon={Download} variant="ghost" onClick={exportCsv}>Export CSV</Button>
        </div>} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatCard title="Unfiled credit" value={formatCurrency(creditUnfiled)} icon={Receipt} status={creditUnfiled > 0 ? 'green' : 'default'} subtitle={`${unfiled.length} invoice(s)`} />
        <StatCard title="Total credit (all)" value={formatCurrency(creditAll)} icon={Receipt} subtitle={`${rows.length} invoice(s)`} />
      </div>

      <div className="flex gap-1 mb-4">
        {(['unfiled', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-sm rounded-lg ${filter === f ? 'bg-white/10 text-white' : 'text-[#8888aa] hover:text-white'}`}>{f === 'unfiled' ? 'Unfiled' : 'All'}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="text-center text-sm text-[#8888aa] bg-[#13131a] border border-dashed border-[#2a2a3a] rounded-xl py-10 px-6">
          No GST inputs {filter === 'unfiled' ? 'pending' : 'yet'}. The founder pushes vendor tax-invoices here from their receipts.
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-[#13131a] border border-[#2a2a3a] rounded-lg px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm text-white font-medium truncate">{r.vendor ?? 'Vendor'} <span className="text-[#8888aa] font-normal">· GSTIN {r.gstin ?? '—'}</span></div>
                <div className="text-xs text-[#8888aa] mt-0.5">{r.invoice_date ? formatDate(r.invoice_date) : ''}{r.invoice_no ? ` · inv ${r.invoice_no}` : ''} · taxable {formatCurrency(Number(r.taxable_value ?? 0))} · GST {formatCurrency(Number(r.gst_amount ?? 0))}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {r.snapshot_url && <a href={r.snapshot_url} target="_blank" rel="noreferrer" className="text-[#8888aa] hover:text-white" title="Snapshot"><ExternalLink size={15} /></a>}
                <button onClick={() => toggleFiled(r)} title={r.filed ? 'Filed' : 'Mark filed'}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${r.filed ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'border-[#3a3a4a] text-[#8888aa] hover:text-white'}`}>
                  <Check size={12} /> {r.filed ? 'Filed' : 'File'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
