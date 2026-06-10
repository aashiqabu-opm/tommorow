'use client'

import { useState } from 'react'
import { Wallet, Plus, TrendingUp, TrendingDown, Paperclip } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { CashEntry } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  entries: CashEntry[]
  userId: string
}

export function CashClientPage({ entries, userId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    opening_cash: '',
    cash_in: '',
    cash_out: '',
    notes: '',
  })
  const [file, setFile] = useState<File | null>(null)

  const latest = entries[0]
  const cashInHand = latest?.closing_cash ?? 0
  const safetyStatus = cashInHand > 500000 ? 'green' : cashInHand > 100000 ? 'yellow' : 'red'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()

    const opening = parseFloat(form.opening_cash) || 0
    const cashIn = parseFloat(form.cash_in) || 0
    const cashOut = parseFloat(form.cash_out) || 0
    const closing = opening + cashIn - cashOut

    let proofUrl: string | undefined
    let proofName: string | undefined

    if (file) {
      const ext = file.name.split('.').pop()
      const path = `cash/${userId}/${Date.now()}.${ext}`
      const { data: uploadData } = await supabase.storage.from('documents').upload(path, file)
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
        proofUrl = urlData.publicUrl
        proofName = file.name
      }
    }

    const { data, error } = await supabase.from('cash_entries').insert({
      entry_date: form.entry_date,
      opening_cash: opening,
      cash_in: cashIn,
      cash_out: cashOut,
      closing_cash: closing,
      entered_by: userId,
      notes: form.notes || null,
      proof_file_url: proofUrl,
      proof_file_name: proofName,
    }).select().single()

    if (!error && data) {
      await logAction('create', 'cash_entries', data.id, undefined, data)
    }

    setSaving(false)
    setOpen(false)
    setForm({ entry_date: new Date().toISOString().split('T')[0], opening_cash: '', cash_in: '', cash_out: '', notes: '' })
    setFile(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash in Hand"
        subtitle="Daily cash movement tracker"
        action={<Button icon={Plus} onClick={() => setOpen(true)}>Add Entry</Button>}
      />

      {/* Hero number */}
      <div className={`rounded-2xl border p-6 ${safetyStatus === 'green' ? 'border-emerald-500/20 bg-emerald-500/5' : safetyStatus === 'yellow' ? 'border-amber-500/20 bg-amber-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
        <div className="text-xs font-medium text-[#8888aa] uppercase tracking-wider mb-2">Current Cash in Hand</div>
        <div className={`text-4xl font-bold tabular-nums ${safetyStatus === 'green' ? 'text-emerald-300' : safetyStatus === 'yellow' ? 'text-amber-300' : 'text-red-300'}`}>
          {formatCurrency(cashInHand)}
        </div>
        <div className="text-xs text-[#8888aa] mt-1">
          {latest ? `Last updated: ${formatDate(latest.entry_date)}` : 'No entries yet'}
        </div>
      </div>

      {/* Stats row */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Total Cash In (30d)"
            value={formatCurrency(entries.reduce((s, e) => s + e.cash_in, 0))}
            icon={TrendingUp}
            status="green"
          />
          <StatCard
            title="Total Cash Out (30d)"
            value={formatCurrency(entries.reduce((s, e) => s + e.cash_out, 0))}
            icon={TrendingDown}
            status="red"
          />
        </div>
      )}

      {/* Entries table */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2a3a]">
          <h3 className="text-sm font-semibold text-white">Cash Entries</h3>
        </div>
        {entries.length === 0 ? (
          <div className="py-12 text-center text-[#8888aa] text-sm">No entries yet. Add your first cash entry.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a3a]">
                  {['Date', 'Opening', 'Cash In', 'Cash Out', 'Closing', 'By', 'Proof'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-medium text-[#8888aa] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2a3a]">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#1a1a24] transition-colors">
                    <td className="px-5 py-3 text-white font-medium">{formatDate(entry.entry_date)}</td>
                    <td className="px-5 py-3 text-[#8888aa] tabular-nums">{formatCurrency(entry.opening_cash)}</td>
                    <td className="px-5 py-3 text-emerald-400 tabular-nums">+{formatCurrency(entry.cash_in)}</td>
                    <td className="px-5 py-3 text-red-400 tabular-nums">-{formatCurrency(entry.cash_out)}</td>
                    <td className="px-5 py-3 text-white font-semibold tabular-nums">{formatCurrency(entry.closing_cash)}</td>
                    <td className="px-5 py-3 text-[#8888aa]">{(entry.profile as { full_name?: string } | null)?.full_name ?? '—'}</td>
                    <td className="px-5 py-3">
                      {entry.proof_file_url ? (
                        <a href={entry.proof_file_url} target="_blank" rel="noreferrer" className="text-white/70 hover:text-white">
                          <Paperclip size={14} />
                        </a>
                      ) : <span className="text-[#5a5a7a]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Entry Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Add Cash Entry">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Date"
            type="date"
            value={form.entry_date}
            onChange={e => setForm({ ...form, entry_date: e.target.value })}
            required
          />
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Opening Cash"
              type="number"
              min="0"
              value={form.opening_cash}
              onChange={e => setForm({ ...form, opening_cash: e.target.value })}
              placeholder="0"
            />
            <Input
              label="Cash In"
              type="number"
              min="0"
              value={form.cash_in}
              onChange={e => setForm({ ...form, cash_in: e.target.value })}
              placeholder="0"
            />
            <Input
              label="Cash Out"
              type="number"
              min="0"
              value={form.cash_out}
              onChange={e => setForm({ ...form, cash_out: e.target.value })}
              placeholder="0"
            />
          </div>

          {(form.opening_cash || form.cash_in || form.cash_out) && (
            <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3 text-sm">
              <span className="text-[#8888aa]">Closing Cash: </span>
              <span className="text-white font-semibold tabular-nums">
                {formatCurrency((parseFloat(form.opening_cash) || 0) + (parseFloat(form.cash_in) || 0) - (parseFloat(form.cash_out) || 0))}
              </span>
            </div>
          )}

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional notes..."
          />

          <div className="space-y-1">
            <label className="text-xs font-medium text-[#8888aa]">Proof Attachment</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-[#8888aa] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#2a2a3a] file:text-white file:text-xs file:cursor-pointer"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save Entry</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
