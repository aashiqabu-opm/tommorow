'use client'

import { useState } from 'react'
import { Wallet, Plus, TrendingUp, TrendingDown, Paperclip, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { FilePicker } from '@/components/ui/FilePicker'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { compressImage } from '@/lib/compressImage'
import type { CashEntry } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  entries: CashEntry[]
  userId: string
  role: string
}

export function CashClientPage({ entries, userId, role }: Props) {
  const canDelete = role === 'founder' || role === 'accountant'
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dupAck, setDupAck] = useState(false)
  const [editing, setEditing] = useState<CashEntry | null>(null)
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

  const cutoff30d = Date.now() - 30 * 86400000
  const recent = entries.filter(e => new Date(e.entry_date).getTime() >= cutoff30d)

  // Live guards on the form
  const oVal = parseFloat(form.opening_cash) || 0
  const iVal = parseFloat(form.cash_in) || 0
  const otVal = parseFloat(form.cash_out) || 0
  const hasMovement = form.cash_in !== '' || form.cash_out !== '' || form.opening_cash !== ''
  const dupExists = hasMovement && entries.some(e =>
    e.id !== editing?.id && e.entry_date === form.entry_date && e.opening_cash === oVal && e.cash_in === iVal && e.cash_out === otVal)
  const openingMismatch = !editing && latest != null && form.opening_cash !== '' && oVal !== latest.closing_cash

  function openAddEntry() {
    // Carry forward the latest closing balance so cash isn't double-counted
    setEditing(null)
    setForm({
      entry_date: new Date().toISOString().split('T')[0],
      opening_cash: latest ? String(latest.closing_cash) : '',
      cash_in: '',
      cash_out: '',
      notes: '',
    })
    setFile(null)
    setDupAck(false)
    setOpen(true)
  }

  function openEdit(entry: CashEntry) {
    setEditing(entry)
    setForm({
      entry_date: entry.entry_date,
      opening_cash: String(entry.opening_cash),
      cash_in: String(entry.cash_in),
      cash_out: String(entry.cash_out),
      notes: entry.notes ?? '',
    })
    setFile(null)
    setDupAck(false)
    setOpen(true)
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm(`Delete the cash entry for ${formatDate(editing.entry_date)} (closing ${formatCurrency(editing.closing_cash)})? This cannot be undone.`)) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('cash_entries').delete().eq('id', editing.id)
    if (error) { toast.error("Couldn't delete entry — please try again"); setDeleting(false); return }
    await logAction('delete', 'cash_entries', editing.id, editing as unknown as Record<string, unknown>, undefined)
    toast.success('Cash entry deleted')
    setDeleting(false)
    setOpen(false)
    setEditing(null)
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Block an exact duplicate (same date + opening + in + out) unless confirmed
    if (dupExists && !dupAck) {
      setDupAck(true)
      toast.error('An identical entry already exists for this date — tap Save once more to confirm')
      return
    }

    setSaving(true)
    const supabase = createClient()

    const opening = parseFloat(form.opening_cash) || 0
    const cashIn = parseFloat(form.cash_in) || 0
    const cashOut = parseFloat(form.cash_out) || 0
    const closing = opening + cashIn - cashOut

    // Keep the existing proof on edit unless a new file is chosen
    let proofUrl: string | undefined = editing?.proof_file_url
    let proofName: string | undefined = editing?.proof_file_name

    if (file) {
      const upload = await compressImage(file)
      const ext = upload.name.split('.').pop()
      const path = `cash/${userId}/${Date.now()}.${ext}`
      const { data: uploadData, error: upErr } = await supabase.storage.from('documents').upload(path, upload)
      if (upErr) { toast.error('File upload failed — check storage bucket'); setSaving(false); return }
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
        proofUrl = urlData.publicUrl
        proofName = upload.name
      }
    }

    const payload = {
      entry_date: form.entry_date,
      opening_cash: opening,
      cash_in: cashIn,
      cash_out: cashOut,
      closing_cash: closing,
      notes: form.notes || null,
      proof_file_url: proofUrl,
      proof_file_name: proofName,
    }

    if (editing) {
      const { data, error } = await supabase.from('cash_entries').update(payload).eq('id', editing.id).select().single()
      if (error) { toast.error("Couldn't update entry — please try again"); setSaving(false); return }
      if (data) await logAction('update', 'cash_entries', editing.id, editing as unknown as Record<string, unknown>, data)
      toast.success('Cash entry updated')
    } else {
      const { data, error } = await supabase.from('cash_entries').insert({ ...payload, entered_by: userId }).select().single()
      if (error) { toast.error("Couldn't save entry — please try again"); setSaving(false); return }
      if (data) await logAction('create', 'cash_entries', data.id, undefined, data)
      toast.success('Cash entry saved')
    }

    setSaving(false)
    setOpen(false)
    setEditing(null)
    setForm({ entry_date: new Date().toISOString().split('T')[0], opening_cash: '', cash_in: '', cash_out: '', notes: '' })
    setFile(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cash in Hand"
        subtitle="Daily cash movement tracker"
        action={<Button icon={Plus} onClick={openAddEntry}>Add Entry</Button>}
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
            value={formatCurrency(recent.reduce((s, e) => s + e.cash_in, 0))}
            icon={TrendingUp}
            status="green"
          />
          <StatCard
            title="Total Cash Out (30d)"
            value={formatCurrency(recent.reduce((s, e) => s + e.cash_out, 0))}
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
          <EmptyState
            icon={Wallet}
            title="No cash entries yet"
            description="Start by recording how much cash the company holds today. From tomorrow, the opening balance carries forward automatically."
            action={<Button icon={Plus} size="sm" onClick={openAddEntry}>Add First Entry</Button>}
          />
        ) : (
          <>
          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-[#2a2a3a]">
            {entries.map((entry) => (
              <button key={entry.id} onClick={() => openEdit(entry)} className="w-full text-left px-4 py-3.5 active:bg-[#1a1a24]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-white">{formatDate(entry.entry_date)}</span>
                  <span className="text-sm font-bold text-white tabular-nums">{formatCurrency(entry.closing_cash)}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] tabular-nums">
                  <span className="text-emerald-400">+{formatCurrency(entry.cash_in)}</span>
                  <span className="text-red-400">-{formatCurrency(entry.cash_out)}</span>
                  <span className="text-[#5a5a7a] ml-auto">
                    {(entry.profile as { full_name?: string } | null)?.full_name ?? ''}
                  </span>
                  {entry.proof_file_url && (
                    <a href={entry.proof_file_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-white/70">
                      <Paperclip size={12} />
                    </a>
                  )}
                  <Pencil size={12} className="text-[#5a5a7a]" />
                </div>
              </button>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2a3a]">
                  {['Date', 'Opening', 'Cash In', 'Cash Out', 'Closing', 'By', 'Proof', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-left text-[11px] font-medium text-[#8888aa] uppercase tracking-wider">{h}</th>
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
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => openEdit(entry)} className="text-[#8888aa] hover:text-white" title="Edit / correct">
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* Add Entry Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Cash Entry' : 'Add Cash Entry'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Date"
            type="date"
            value={form.entry_date}
            onChange={e => setForm({ ...form, entry_date: e.target.value })}
            required
          />
          <div className="grid grid-cols-3 gap-3">
            <MoneyInput
              label="Opening Cash"
              value={form.opening_cash}
              onChange={v => setForm({ ...form, opening_cash: v })}
            />
            <MoneyInput
              label="Cash In"
              value={form.cash_in}
              onChange={v => setForm({ ...form, cash_in: v })}
            />
            <MoneyInput
              label="Cash Out"
              value={form.cash_out}
              onChange={v => setForm({ ...form, cash_out: v })}
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

          {openingMismatch && !dupExists && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2.5 text-xs text-amber-300">
              Opening doesn&apos;t match the last closing balance ({formatCurrency(latest!.closing_cash)}). If this isn&apos;t a correction, cash may be double-counted.
            </div>
          )}

          {dupExists && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2.5 text-xs text-red-300">
              An identical entry already exists for {formatDate(form.entry_date)} (same opening, in, and out). {dupAck ? 'Tap Save again to add it anyway.' : 'Check the table before saving.'}
            </div>
          )}

          <Textarea
            label="Notes"
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional notes..."
          />

          <FilePicker label="Proof Attachment" file={file} onChange={setFile} />

          <div className="flex items-center justify-between gap-2 pt-2">
            {editing && canDelete ? (
              <Button variant="ghost" type="button" icon={Trash2} loading={deleting} onClick={handleDelete} className="text-red-400 hover:text-red-300">
                Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saving} variant={dupExists && dupAck ? 'danger' : 'primary'}>
                {dupExists && dupAck ? 'Save Anyway' : editing ? 'Save Changes' : 'Save Entry'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
