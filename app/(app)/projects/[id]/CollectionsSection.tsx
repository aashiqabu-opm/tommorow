'use client'

import { useState } from 'react'
import { TrendingUp, Plus, Sparkles, Download, Check, Trash2, Clock } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { BarChart } from '@/components/ui/BarChart'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatCurrency, formatDate } from '@/lib/utils'
import { WEB_SEARCH_ENABLED } from '@/lib/flags'
import type { BoxOfficeCollection } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  released: boolean
  rows: BoxOfficeCollection[]
  userId: string
  canManage: boolean
}

const crore = (n: number | null) => n == null ? '—' : `₹${(n / 10000000).toFixed(2)} Cr`

export function CollectionsSection({ projectId, released, rows, userId, canManage }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [trend, setTrend] = useState<{ headline: string; commentary: string } | null>(null)
  const [form, setForm] = useState({ day_number: '', collection_date: new Date().toISOString().split('T')[0], india_net: '', worldwide_gross: '', occupancy: '', source: '' })

  const sorted = [...rows].sort((a, b) => a.collection_date.localeCompare(b.collection_date))
  const totalIndia = rows.reduce((s, r) => s + (r.india_net ?? 0), 0)
  const latestWW = sorted.filter(r => r.worldwide_gross != null).slice(-1)[0]?.worldwide_gross ?? null
  const chartData = sorted.map(r => ({ label: r.day_number ? `D${r.day_number}` : formatDate(r.collection_date).slice(0, 6), value: r.india_net ?? 0 }))

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('box_office_collections').upsert({
      project_id: projectId, collection_date: form.collection_date,
      day_number: form.day_number ? parseInt(form.day_number) : null,
      india_net: form.india_net ? parseFloat(form.india_net) : null,
      worldwide_gross: form.worldwide_gross ? parseFloat(form.worldwide_gross) : null,
      occupancy: form.occupancy ? parseFloat(form.occupancy) : null,
      source: form.source || 'Manual entry', confirmed: true, recorded_by: userId,
    }, { onConflict: 'project_id,collection_date' })
    if (error) {
      const hint = /relation .*box_office.* does not exist/i.test(error.message) ? 'run migration-tracking.sql first' : error.message
      toast.error(`Couldn't save — ${String(hint).slice(0, 80)}`); setSaving(false); return
    }
    await logAction('create', 'box_office_collections', projectId, undefined, { date: form.collection_date })
    toast.success('Collection saved')
    setSaving(false); setOpen(false)
    setForm({ day_number: '', collection_date: new Date().toISOString().split('T')[0], india_net: '', worldwide_gross: '', occupancy: '', source: '' })
    router.refresh()
  }

  async function confirmRow(r: BoxOfficeCollection) {
    const supabase = createClient()
    await supabase.from('box_office_collections').update({ confirmed: true }).eq('id', r.id)
    router.refresh()
  }
  async function removeRow(r: BoxOfficeCollection) {
    if (!window.confirm('Delete this day?')) return
    const supabase = createClient()
    await supabase.from('box_office_collections').delete().eq('id', r.id)
    router.refresh()
  }

  async function aiFetch() {
    setFetching(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/intel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'fetch' }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Fetch failed'); setFetching(false); return }
      toast.success('Fetched a figure — review & confirm it below')
      router.refresh()
    } catch { toast.error('Fetch failed') }
    setFetching(false)
  }

  async function aiTrend() {
    setAnalyzing(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/intel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'trend' }) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Could not analyze'); setAnalyzing(false); return }
      setTrend(data.analysis)
    } catch { toast.error('Could not analyze') }
    setAnalyzing(false)
  }

  function exportCsv() {
    const head = ['Date', 'Day', 'India Net', 'Worldwide Gross', 'Occupancy %', 'Source', 'Confirmed']
    const lines = sorted.map(r => [r.collection_date, r.day_number ?? '', r.india_net ?? '', r.worldwide_gross ?? '', r.occupancy ?? '', r.source ?? '', r.confirmed ? 'yes' : 'no'].join(','))
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'collections.csv'; a.click()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-white/70" />
          <h3 className="text-sm font-semibold text-white">Box-Office Collections</h3>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 flex-wrap">
            {WEB_SEARCH_ENABLED && released && <Button size="sm" variant="secondary" icon={Sparkles} loading={fetching} onClick={aiFetch}>AI fetch</Button>}
            <Button size="sm" variant="secondary" icon={Sparkles} loading={analyzing} onClick={aiTrend} disabled={rows.length === 0}>AI trend</Button>
            {rows.length > 0 && <Button size="sm" variant="secondary" icon={Download} onClick={exportCsv}>CSV</Button>}
            <Button size="sm" icon={Plus} onClick={() => setOpen(true)}>Add day</Button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-[#8888aa]">
          No collection data yet.{!released && ' Numbers come in once the film releases.'}
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#1a1a24] rounded-xl p-3"><div className="text-[10px] text-[#8888aa] uppercase tracking-wide">India Net (cum.)</div><div className="text-base font-bold text-white tabular-nums">{crore(totalIndia)}</div></div>
            <div className="bg-[#1a1a24] rounded-xl p-3"><div className="text-[10px] text-[#8888aa] uppercase tracking-wide">Worldwide</div><div className="text-base font-bold text-white tabular-nums">{crore(latestWW)}</div></div>
            <div className="bg-[#1a1a24] rounded-xl p-3"><div className="text-[10px] text-[#8888aa] uppercase tracking-wide">Days tracked</div><div className="text-base font-bold text-white tabular-nums">{rows.length}</div></div>
          </div>

          {/* AI trend */}
          {trend && (
            <div className="bg-[#0e1726] border border-indigo-500/20 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1"><Sparkles size={13} className="text-indigo-300" /><span className="text-xs font-semibold text-indigo-200">{trend.headline}</span></div>
              <p className="text-xs text-[#c8c8da] leading-relaxed">{trend.commentary}</p>
            </div>
          )}

          {/* Chart */}
          {chartData.length > 1 && <BarChart data={chartData} formatValue={v => crore(v)} height={110} />}

          {/* Day list */}
          <div className="divide-y divide-[#2a2a3a] -mx-5">
            {sorted.slice().reverse().map(r => (
              <div key={r.id} className="px-5 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white">{r.day_number ? `Day ${r.day_number}` : formatDate(r.collection_date)}</span>
                    {!r.confirmed && <span className="text-[9px] uppercase tracking-wide text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1 py-0.5 flex items-center gap-1"><Clock size={9} /> AI · unconfirmed</span>}
                  </div>
                  <div className="text-[11px] text-[#8888aa]">{formatDate(r.collection_date)}{r.source ? ` · ${r.source}` : ''}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white tabular-nums">{crore(r.india_net)}</div>
                    {r.worldwide_gross != null && <div className="text-[10px] text-[#5a5a7a]">WW {crore(r.worldwide_gross)}</div>}
                  </div>
                  {canManage && !r.confirmed && <button onClick={() => confirmRow(r)} title="Confirm" className="text-emerald-400 hover:text-emerald-300"><Check size={15} /></button>}
                  {canManage && <button onClick={() => removeRow(r)} className="text-[#3a3a4a] hover:text-red-400"><Trash2 size={13} /></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add Collection Day" size="sm">
        <form onSubmit={add} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Day #" type="number" value={form.day_number} onChange={e => setForm({ ...form, day_number: e.target.value })} placeholder="1" />
            <Input label="Date" type="date" value={form.collection_date} onChange={e => setForm({ ...form, collection_date: e.target.value })} />
          </div>
          <MoneyInput label="India Net (₹)" value={form.india_net} onChange={v => setForm({ ...form, india_net: v })} />
          <MoneyInput label="Worldwide Gross (₹)" value={form.worldwide_gross} onChange={v => setForm({ ...form, worldwide_gross: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Occupancy %" type="number" value={form.occupancy} onChange={e => setForm({ ...form, occupancy: e.target.value })} />
            <Input label="Source" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="Sacnilk / distributor" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
