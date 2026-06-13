'use client'

import { useMemo, useState } from 'react'
import { Receipt, Landmark, Users, Download, CalendarClock } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { formatCurrency, formatDate } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

interface Props {
  payments: Row[]
  crew: Row[]
}

// Indian financial year helpers
function fyOptions(): { value: string; label: string }[] {
  const now = new Date()
  const curStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return [0, 1, 2].map(i => {
    const y = curStart - i
    return { value: String(y), label: `FY ${y}-${String(y + 1).slice(2)}` }
  })
}

const QUARTERS = [
  { value: 'all', label: 'Full year' },
  { value: 'Q1', label: 'Q1 (Apr–Jun)' },
  { value: 'Q2', label: 'Q2 (Jul–Sep)' },
  { value: 'Q3', label: 'Q3 (Oct–Dec)' },
  { value: 'Q4', label: 'Q4 (Jan–Mar)' },
]

// 26Q return due dates per quarter (deductor)
const RETURN_DUE: Record<string, (fy: number) => string> = {
  Q1: fy => `31 Jul ${fy}`,
  Q2: fy => `31 Oct ${fy}`,
  Q3: fy => `31 Jan ${fy + 1}`,
  Q4: fy => `31 May ${fy + 1}`,
}

function rangeFor(fy: number, q: string): { from: string; to: string } {
  if (q === 'Q1') return { from: `${fy}-04-01`, to: `${fy}-06-30` }
  if (q === 'Q2') return { from: `${fy}-07-01`, to: `${fy}-09-30` }
  if (q === 'Q3') return { from: `${fy}-10-01`, to: `${fy}-12-31` }
  if (q === 'Q4') return { from: `${fy + 1}-01-01`, to: `${fy + 1}-03-31` }
  return { from: `${fy}-04-01`, to: `${fy + 1}-03-31` }
}

function inferSection(category?: string): string {
  const c = (category || '').toLowerCase()
  if (/rent|location|equipment/.test(c)) return '194I'
  if (/artist|technician|post|legal|professional|director|music/.test(c)) return '194J'
  if (/distribut|commission|brokerage/.test(c)) return '194H'
  return '194C'
}

interface TdsLine { date: string; deductee: string; pan: string; section: string; taxable: number; rate: number; tds: number; project: string; source: string }
interface GstLine { date: string; vendor: string; gstin: string; taxable: number; gst: number; project: string }

export function ComplianceClient({ payments, crew }: Props) {
  const fys = fyOptions()
  const [fy, setFy] = useState(fys[0].value)
  const [quarter, setQuarter] = useState('all')

  const { from, to } = rangeFor(Number(fy), quarter)
  const inRange = (d?: string) => !!d && d >= from && d <= to

  // ── TDS register: payments with TDS + crew payments × the person's rate ──
  const tdsLines = useMemo<TdsLine[]>(() => {
    const lines: TdsLine[] = []
    for (const p of payments) {
      const date = (p.paid_at as string)?.slice(0, 10) || (p.created_at as string)?.slice(0, 10)
      const tds = Number(p.tds_amount || 0)
      if (tds <= 0 || !inRange(date)) continue
      lines.push({
        date, deductee: p.vendor?.name ?? p.payee, pan: p.vendor?.pan ?? '—',
        section: inferSection(p.category), taxable: Number(p.amount || 0),
        rate: Number(p.tds_percent || 0), tds, project: p.project?.name ?? '—', source: 'Payment',
      })
    }
    for (const c of crew) {
      const rate = Number(c.tds_percent || 0)
      if (rate <= 0) continue
      for (const pay of (c.payments ?? [])) {
        const date = (pay.payment_date as string)?.slice(0, 10)
        if (!inRange(date)) continue
        const taxable = Number(pay.amount || 0)
        lines.push({ date, deductee: c.name, pan: c.pan ?? '—', section: '194J', taxable, rate, tds: Math.round(taxable * rate / 100 * 100) / 100, project: c.project?.name ?? '—', source: 'Crew' })
      }
    }
    return lines.sort((a, b) => b.date.localeCompare(a.date))
  }, [payments, crew, from, to])

  const gstLines = useMemo<GstLine[]>(() => {
    const lines: GstLine[] = []
    for (const p of payments) {
      const date = (p.paid_at as string)?.slice(0, 10) || (p.created_at as string)?.slice(0, 10)
      const gst = Number(p.gst_amount || 0)
      if (gst <= 0 || !inRange(date)) continue
      lines.push({ date, vendor: p.vendor?.name ?? p.payee, gstin: p.vendor?.gst_number ?? '—', taxable: Number(p.amount || 0), gst, project: p.project?.name ?? '—' })
    }
    return lines.sort((a, b) => b.date.localeCompare(a.date))
  }, [payments, from, to])

  const totalTds = tdsLines.reduce((s, l) => s + l.tds, 0)
  const totalGst = gstLines.reduce((s, l) => s + l.gst, 0)

  // Deductee summary (Form 16A basis)
  const deductees = useMemo(() => {
    const m: Record<string, { name: string; pan: string; section: string; taxable: number; tds: number }> = {}
    for (const l of tdsLines) {
      const key = `${l.deductee}|${l.pan}`
      const e = (m[key] ??= { name: l.deductee, pan: l.pan, section: l.section, taxable: 0, tds: 0 })
      e.taxable += l.taxable; e.tds += l.tds
    }
    return Object.values(m).sort((a, b) => b.tds - a.tds)
  }, [tdsLines])

  function exportCSV(kind: 'tds' | 'gst') {
    const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
    let headers: string[]; let rows: (string | number)[][]; let total: (string | number)[]
    if (kind === 'tds') {
      headers = ['Date', 'Deductee', 'PAN', 'Section', 'Taxable', 'Rate %', 'TDS', 'Project', 'Source']
      rows = tdsLines.map(l => [l.date, l.deductee, l.pan, l.section, l.taxable, l.rate, l.tds, l.project, l.source])
      total = ['TOTAL', '', '', '', '', '', totalTds, '', '']
    } else {
      headers = ['Date', 'Vendor', 'GSTIN', 'Taxable', 'GST (input)', 'Project']
      rows = gstLines.map(l => [l.date, l.vendor, l.gstin, l.taxable, l.gst, l.project])
      total = ['TOTAL', '', '', '', totalGst, '']
    }
    const csv = '﻿' + [headers, ...rows, total].map(r => r.map(esc).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${kind}_register_FY${fy}_${quarter}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const fyNum = Number(fy)

  return (
    <div className="space-y-6">
      <PageHeader title="Tax & Compliance" subtitle="TDS & GST registers from your payments — ready for your CA / 26Q filing" />

      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-2 bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-3">
        <select value={fy} onChange={e => setFy(e.target.value)} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40">
          {fys.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select value={quarter} onChange={e => setQuarter(e.target.value)} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40">
          {QUARTERS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
        </select>
        <span className="text-[11px] text-[#5a5a7a] ml-auto">{formatDate(from)} – {formatDate(to)}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="TDS Deducted" value={formatCurrency(totalTds)} status="default" icon={Receipt} subtitle={`${tdsLines.length} entries`} />
        <StatCard title="GST Input Credit" value={formatCurrency(totalGst)} status="green" icon={Landmark} subtitle={`${gstLines.length} bills`} />
        <StatCard title="Deductees" value={deductees.length} status="default" icon={Users} subtitle="Distinct parties" />
        <StatCard title="26Q Due" value={quarter === 'all' ? '—' : (RETURN_DUE[quarter]?.(fyNum) ?? '—')} status="yellow" icon={CalendarClock} subtitle="Return filing" />
      </div>

      {/* Statutory due dates */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl px-5 py-3 text-xs text-[#c8c8da] flex flex-wrap gap-x-6 gap-y-1">
        <span className="text-amber-300 font-semibold">Statutory dates:</span>
        <span>TDS deposit — <strong>7th</strong> of next month</span>
        <span>26Q return — <strong>{quarter === 'all' ? 'Jul 31 / Oct 31 / Jan 31 / May 31' : RETURN_DUE[quarter]?.(fyNum)}</strong></span>
        <span>GSTR-1 — <strong>11th</strong></span>
        <span>GSTR-3B — <strong>20th</strong></span>
      </div>

      {/* TDS register */}
      <Section title="TDS Register" count={tdsLines.length} onExport={() => exportCSV('tds')}>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#2a2a3a]">
            {['Date', 'Deductee', 'PAN', 'Section', 'Taxable', 'Rate', 'TDS', 'Source'].map((h, i) => (
              <th key={h} className={`px-4 py-2.5 text-[11px] font-medium text-[#8888aa] uppercase tracking-wider whitespace-nowrap ${i >= 4 && i <= 6 ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-[#2a2a3a]">
            {tdsLines.map((l, i) => (
              <tr key={i} className="hover:bg-[#1a1a24]">
                <td className="px-4 py-2.5 text-[#8888aa] whitespace-nowrap">{formatDate(l.date)}</td>
                <td className="px-4 py-2.5 text-white">{l.deductee}</td>
                <td className="px-4 py-2.5 text-[#8888aa] font-mono text-xs">{l.pan}</td>
                <td className="px-4 py-2.5"><span className="text-[11px] bg-[#1a1a24] border border-[#2a2a3a] rounded px-1.5 py-0.5 text-[#c8c8da]">{l.section}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#c8c8da]">{formatCurrency(l.taxable)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#8888aa]">{l.rate}%</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white font-medium">{formatCurrency(l.tds)}</td>
                <td className="px-4 py-2.5 text-[11px] text-[#8888aa]">{l.source}</td>
              </tr>
            ))}
            {tdsLines.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-[#8888aa] text-sm">No TDS deducted in this period.</td></tr>}
          </tbody>
        </table>
      </Section>

      {/* Deductee summary */}
      {deductees.length > 0 && (
        <Section title="By Deductee (Form 16A basis)" count={deductees.length}>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-[#2a2a3a]">
              {['Deductee', 'PAN', 'Section', 'Total Paid', 'Total TDS'].map((h, i) => (
                <th key={h} className={`px-4 py-2.5 text-[11px] font-medium text-[#8888aa] uppercase tracking-wider whitespace-nowrap ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-[#2a2a3a]">
              {deductees.map((d, i) => (
                <tr key={i} className="hover:bg-[#1a1a24]">
                  <td className="px-4 py-2.5 text-white">{d.name}</td>
                  <td className="px-4 py-2.5 text-[#8888aa] font-mono text-xs">{d.pan}</td>
                  <td className="px-4 py-2.5"><span className="text-[11px] bg-[#1a1a24] border border-[#2a2a3a] rounded px-1.5 py-0.5 text-[#c8c8da]">{d.section}</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#c8c8da]">{formatCurrency(d.taxable)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-white font-medium">{formatCurrency(d.tds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* GST input register */}
      <Section title="GST Input Credit Register" count={gstLines.length} onExport={() => exportCSV('gst')}>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#2a2a3a]">
            {['Date', 'Vendor', 'GSTIN', 'Taxable', 'GST (input)', 'Project'].map((h, i) => (
              <th key={h} className={`px-4 py-2.5 text-[11px] font-medium text-[#8888aa] uppercase tracking-wider whitespace-nowrap ${i >= 3 && i <= 4 ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-[#2a2a3a]">
            {gstLines.map((l, i) => (
              <tr key={i} className="hover:bg-[#1a1a24]">
                <td className="px-4 py-2.5 text-[#8888aa] whitespace-nowrap">{formatDate(l.date)}</td>
                <td className="px-4 py-2.5 text-white">{l.vendor}</td>
                <td className="px-4 py-2.5 text-[#8888aa] font-mono text-xs">{l.gstin}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#c8c8da]">{formatCurrency(l.taxable)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400 font-medium">{formatCurrency(l.gst)}</td>
                <td className="px-4 py-2.5 text-[#8888aa]">{l.project}</td>
              </tr>
            ))}
            {gstLines.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#8888aa] text-sm">No GST input recorded in this period.</td></tr>}
          </tbody>
        </table>
      </Section>

      <p className="text-[11px] text-[#5a5a7a]">TDS sections are inferred from the payment category (verify with your CA). Crew TDS is computed on each crew payment at the person&apos;s rate. Figures are a working register, not a substitute for your accountant&apos;s filing.</p>
    </div>
  )
}

function Section({ title, count, onExport, children }: { title: string; count: number; onExport?: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-[#8888aa]">{count}</span>
        {onExport && count > 0 && (
          <button onClick={onExport} className="ml-auto text-xs text-[#8888aa] hover:text-white inline-flex items-center gap-1"><Download size={13} /> Export CSV</button>
        )}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}
