'use client'

import { useMemo, useState } from 'react'
import { Download, BarChart3, AlertTriangle, FileCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatCurrency, formatDate, paidPercent, isExpiringSoon, isExpired, DOCUMENT_TYPE_LABELS } from '@/lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

interface Props {
  cashEntries: Row[]
  liabilities: Row[]
  liabilityPayments: Row[]
  payments: Row[]
  documents: Row[]
  projects: { id: string; name: string }[]
  role: string
}

type ReportType = 'cash' | 'liability' | 'liability_payments' | 'payments' | 'documents' | 'expiring' | 'tds_register'

// ─── CSV helpers (audit-friendly: clean headers, raw numbers, totals row) ───

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadCSV(headers: string[], rows: unknown[][], filename: string) {
  const lines = [headers.map(csvEscape).join(','), ...rows.map(r => r.map(csvEscape).join(','))]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const ddmmyyyy = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN') : '')
const num = (v: unknown) => Number(v ?? 0).toFixed(2)

export function ReportsClient({ cashEntries, liabilities, liabilityPayments, payments, documents, role }: Props) {
  const [active, setActive] = useState<ReportType>('cash')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const isFinance = role === 'founder' || role === 'accountant'

  // ── Date range filter ──
  const inRange = (dateStr?: string | null) => {
    if (!dateStr) return true
    const d = dateStr.split('T')[0]
    if (fromDate && d < fromDate) return false
    if (toDate && d > toDate) return false
    return true
  }

  const cash = useMemo(() => cashEntries.filter(e => inRange(e.entry_date)), [cashEntries, fromDate, toDate]) // eslint-disable-line react-hooks/exhaustive-deps
  const libPayments = useMemo(() => liabilityPayments.filter(p => inRange(p.payment_date)), [liabilityPayments, fromDate, toDate]) // eslint-disable-line react-hooks/exhaustive-deps
  const paymentRegister = useMemo(() => payments.filter(p => inRange(p.created_at)), [payments, fromDate, toDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Integrity checks on the cash book (sequential, ascending order) ──
  const integrityIssues = useMemo(() => {
    const issues: string[] = []
    for (let i = 0; i < cash.length; i++) {
      const e = cash[i]
      const expectedClosing = (e.opening_cash ?? 0) + (e.cash_in ?? 0) - (e.cash_out ?? 0)
      if (Math.abs(expectedClosing - (e.closing_cash ?? 0)) > 0.01) {
        issues.push(`${ddmmyyyy(e.entry_date)}: closing balance ${formatCurrency(e.closing_cash)} doesn't match opening + in − out (${formatCurrency(expectedClosing)})`)
      }
      if (i > 0) {
        const prev = cash[i - 1]
        if (Math.abs((prev.closing_cash ?? 0) - (e.opening_cash ?? 0)) > 0.01) {
          issues.push(`${ddmmyyyy(e.entry_date)}: opening balance ${formatCurrency(e.opening_cash)} doesn't match previous closing ${formatCurrency(prev.closing_cash)} (${ddmmyyyy(prev.entry_date)})`)
        }
      }
    }
    return issues
  }, [cash])

  // ── Period summary figures ──
  const totalCashIn = cash.reduce((s, e) => s + (e.cash_in ?? 0), 0)
  const totalCashOut = cash.reduce((s, e) => s + (e.cash_out ?? 0), 0)
  const openingBalance = cash[0]?.opening_cash ?? 0
  const closingBalance = cash[cash.length - 1]?.closing_cash ?? 0
  const totalOwed = liabilities.reduce((s, l) => s + (l.amount_owed ?? 0), 0)
  const totalLibPaid = liabilities.reduce((s, l) => s + (l.amount_paid ?? 0), 0)
  const outstanding = liabilities.filter(l => l.status !== 'cleared').reduce((s, l) => s + (l.balance_remaining ?? 0), 0)
  const expiring = documents.filter(d => d.expiry_date && isExpiringSoon(d.expiry_date, 30))
  const expired = documents.filter(d => d.expiry_date && isExpired(d.expiry_date))

  const periodLabel = fromDate || toDate
    ? `${fromDate ? ddmmyyyy(fromDate) : 'Beginning'} to ${toDate ? ddmmyyyy(toDate) : 'Today'}`
    : 'All time'

  // ── CA-ready CSV exports ──

  function exportCashBook() {
    downloadCSV(
      ['Date', 'Opening Balance', 'Cash In', 'Cash Out', 'Closing Balance', 'Entered By', 'Notes'],
      [
        ...cash.map(e => [ddmmyyyy(e.entry_date), num(e.opening_cash), num(e.cash_in), num(e.cash_out), num(e.closing_cash), e.entered_by_profile?.full_name ?? '', e.notes ?? '']),
        ['TOTAL', '', num(totalCashIn), num(totalCashOut), num(closingBalance), '', `Period: ${periodLabel}`],
      ],
      'OPM_cash_book'
    )
  }

  function exportLiabilityRegister() {
    downloadCSV(
      ['Party Name', 'Type', 'Project', 'Original Date', 'Due Date', 'Amount Owed', 'Amount Paid', 'Balance Remaining', 'Status', 'Priority', 'Notes'],
      [
        ...liabilities.map(l => [l.party_name, l.type, l.project?.name ?? '', ddmmyyyy(l.original_date), ddmmyyyy(l.due_date), num(l.amount_owed), num(l.amount_paid), num(l.balance_remaining), l.status, l.priority, l.notes ?? '']),
        ['TOTAL', '', '', '', '', num(totalOwed), num(totalLibPaid), num(outstanding), '', '', ''],
      ],
      'OPM_liability_register'
    )
  }

  function exportLiabilityPayments() {
    const total = libPayments.reduce((s, p) => s + (p.amount ?? 0), 0)
    downloadCSV(
      ['Payment Date', 'Paid To (Party)', 'Amount', 'Recorded By', 'Notes'],
      [
        ...libPayments.map(p => [ddmmyyyy(p.payment_date), p.liability?.party_name ?? '', num(p.amount), p.paid_by_profile?.full_name ?? '', p.notes ?? '']),
        ['TOTAL', '', num(total), '', `Period: ${periodLabel}`],
      ],
      'OPM_liability_payments'
    )
  }

  function exportPaymentRegister() {
    const totalPaid = paymentRegister.filter(p => p.payment_status === 'paid').reduce((s, p) => s + (p.amount ?? 0), 0)
    downloadCSV(
      ['Requested Date', 'Project', 'Payee', 'Purpose', 'Category', 'Amount', 'Requested By', 'Verification', 'Approval', 'Approved By', 'Approved Date', 'Payment Status', 'Paid Date'],
      [
        ...paymentRegister.map(p => [
          ddmmyyyy(p.created_at), p.project?.name ?? '', p.payee, p.purpose, p.category ?? '', num(p.amount),
          p.requester?.full_name ?? '', p.verification_status, p.approval_status, p.approver?.full_name ?? '',
          ddmmyyyy(p.approved_at), p.payment_status, ddmmyyyy(p.paid_at),
        ]),
        ['TOTAL PAID', '', '', '', '', num(totalPaid), '', '', '', '', '', '', `Period: ${periodLabel}`],
      ],
      'OPM_payment_register'
    )
  }

  function exportTdsRegister() {
    const tdsPayments = paymentRegister.filter(p => (p.tds_amount ?? 0) > 0)
    const totalTds = tdsPayments.reduce((s, p) => s + (p.tds_amount ?? 0), 0)
    const totalNet = tdsPayments.reduce((s, p) => s + (p.net_payable ?? p.amount ?? 0), 0)
    downloadCSV(
      ['Date', 'Payee', 'PAN', 'Amount', 'TDS %', 'TDS Amount', 'Net Paid'],
      [
        ...tdsPayments.map(p => [
          ddmmyyyy(p.created_at),
          p.payee,
          p.vendor?.pan ?? '',
          num(p.amount),
          num(p.tds_percent),
          num(p.tds_amount),
          num(p.net_payable ?? p.amount),
        ]),
        ['TOTAL', '', '', '', '', num(totalTds), num(totalNet)],
      ],
      'OPM_tds_register'
    )
  }

  function exportAuditPackage() {
    // Summary sheet first, then each register, staggered so the browser allows all downloads
    downloadCSV(
      ['OPM Cinemas — Audit Summary', ''],
      [
        ['Generated on', new Date().toLocaleString('en-IN')],
        ['Period', periodLabel],
        ['', ''],
        ['CASH', ''],
        ['Opening balance (period start)', num(openingBalance)],
        ['Total cash in', num(totalCashIn)],
        ['Total cash out', num(totalCashOut)],
        ['Closing balance (period end)', num(closingBalance)],
        ['Cash book entries', cash.length],
        ['Integrity check', integrityIssues.length === 0 ? 'PASSED — all balances consistent' : `${integrityIssues.length} discrepancies — see notes`],
        ...integrityIssues.map(issue => ['Discrepancy', issue]),
        ['', ''],
        ['LIABILITIES', ''],
        ['Total amount owed', num(totalOwed)],
        ['Total paid against liabilities', num(totalLibPaid)],
        ['Outstanding balance', num(outstanding)],
        ['Liability records', liabilities.length],
        ['', ''],
        ['PAYMENTS', ''],
        ['Payment requests in period', paymentRegister.length],
        ['Total paid out (approved & paid)', num(paymentRegister.filter(p => p.payment_status === 'paid').reduce((s, p) => s + (p.amount ?? 0), 0))],
      ],
      'OPM_audit_summary'
    )
    setTimeout(exportCashBook, 400)
    setTimeout(exportLiabilityRegister, 800)
    setTimeout(exportLiabilityPayments, 1200)
    setTimeout(exportPaymentRegister, 1600)
  }

  const TABS: { key: ReportType; label: string; finance?: boolean }[] = [
    { key: 'cash', label: 'Cash Book', finance: true },
    { key: 'liability', label: 'Liability Register', finance: true },
    { key: 'liability_payments', label: 'Liability Payments', finance: true },
    { key: 'payments', label: 'Payment Register' },
    { key: 'documents', label: 'Documents' },
    { key: 'expiring', label: 'Expiring Agreements' },
    { key: 'tds_register', label: 'TDS Register' },
  ]
  const availableTabs = TABS.filter(t => !t.finance || isFinance)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Financial and operational summaries"
        action={isFinance ? (
          <Button icon={FileCheck} onClick={exportAuditPackage}>Download Audit Package</Button>
        ) : undefined}
      />

      {/* Date range filter */}
      <div className="flex items-center gap-3 flex-wrap bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-3">
        <span className="text-xs font-medium text-[#8888aa]">Period:</span>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
          className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40" />
        <span className="text-xs text-[#5a5a7a]">to</span>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
          className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40" />
        {(fromDate || toDate) && (
          <button onClick={() => { setFromDate(''); setToDate('') }} className="text-xs text-[#8888aa] hover:text-white">Clear</button>
        )}
        <span className="text-xs text-[#5a5a7a] ml-auto">{periodLabel}</span>
      </div>

      {/* Integrity warning */}
      {isFinance && integrityIssues.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-300 mb-2">
            <AlertTriangle size={15} /> Cash book has {integrityIssues.length} discrepanc{integrityIssues.length === 1 ? 'y' : 'ies'}
          </div>
          <ul className="text-xs text-red-300/80 space-y-1 list-disc pl-5">
            {integrityIssues.slice(0, 5).map((issue, i) => <li key={i}>{issue}</li>)}
            {integrityIssues.length > 5 && <li>...and {integrityIssues.length - 5} more</li>}
          </ul>
          <p className="text-xs text-[#8888aa] mt-2">Fix these before sending data for audit. Tell me the dates and I can help correct them.</p>
        </div>
      )}
      {isFinance && integrityIssues.length === 0 && cash.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-2 text-xs text-emerald-300">
          <FileCheck size={14} /> Cash book integrity check passed — every closing balance matches opening + in − out, and balances carry forward correctly.
        </div>
      )}

      {/* Summary cards */}
      {isFinance && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Cash In (period)" value={formatCurrency(totalCashIn)} status="green" icon={BarChart3} />
          <StatCard title="Cash Out (period)" value={formatCurrency(totalCashOut)} status="red" subtitle={`Net: ${formatCurrency(totalCashIn - totalCashOut)}`} />
          <StatCard title="Closing Balance" value={formatCurrency(closingBalance)} status="default" subtitle={`Opening: ${formatCurrency(openingBalance)}`} />
          <StatCard title="Outstanding Liabilities" value={formatCurrency(outstanding)} status={outstanding > 0 ? 'yellow' : 'green'} subtitle={`${paidPercent(totalLibPaid, totalOwed)}% of ${formatCurrency(totalOwed)} cleared`} />
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 bg-[#13131a] border border-[#2a2a3a] rounded-xl p-1 flex-wrap">
        {availableTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${active === tab.key ? 'bg-white text-black' : 'text-[#8888aa] hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report content */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        {active === 'cash' && isFinance && (
          <>
            <ReportHeader title={`Cash Book (${cash.length} entries)`} onExport={exportCashBook} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#2a2a3a]">
                  {['Date', 'Opening', 'Cash In', 'Cash Out', 'Closing', 'Entered By', 'Notes'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-medium text-[#8888aa] uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-[#2a2a3a]">
                  {cash.map((e, i) => (
                    <tr key={i} className="hover:bg-[#1a1a24]">
                      <td className="px-5 py-3 text-white">{formatDate(e.entry_date)}</td>
                      <td className="px-5 py-3 text-[#8888aa] tabular-nums">{formatCurrency(e.opening_cash)}</td>
                      <td className="px-5 py-3 text-emerald-400 tabular-nums">+{formatCurrency(e.cash_in)}</td>
                      <td className="px-5 py-3 text-red-400 tabular-nums">-{formatCurrency(e.cash_out)}</td>
                      <td className="px-5 py-3 text-white font-semibold tabular-nums">{formatCurrency(e.closing_cash)}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{e.entered_by_profile?.full_name ?? '—'}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{e.notes ?? '—'}</td>
                    </tr>
                  ))}
                  {cash.length > 0 && (
                    <tr className="bg-[#1a1a24] font-semibold">
                      <td className="px-5 py-3 text-white">TOTAL</td>
                      <td className="px-5 py-3" />
                      <td className="px-5 py-3 text-emerald-400 tabular-nums">+{formatCurrency(totalCashIn)}</td>
                      <td className="px-5 py-3 text-red-400 tabular-nums">-{formatCurrency(totalCashOut)}</td>
                      <td className="px-5 py-3 text-white tabular-nums">{formatCurrency(closingBalance)}</td>
                      <td className="px-5 py-3" colSpan={2} />
                    </tr>
                  )}
                  {cash.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-[#8888aa]">No entries in this period</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {active === 'liability' && isFinance && (
          <>
            <ReportHeader title={`Liability Register (${liabilities.length})`} onExport={exportLiabilityRegister} />
            <div className="divide-y divide-[#2a2a3a]">
              {liabilities.map((l, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex justify-between mb-2">
                    <div>
                      <span className="text-sm font-medium text-white">{l.party_name}</span>
                      <span className="ml-2 text-xs text-[#8888aa]">{l.type}{l.project?.name ? ` · ${l.project.name}` : ''}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white tabular-nums">{formatCurrency(l.amount_owed)}</div>
                      <div className="text-xs text-[#8888aa]">Bal: {formatCurrency(l.balance_remaining)}</div>
                    </div>
                  </div>
                  <ProgressBar value={l.amount_paid ?? 0} max={l.amount_owed ?? 1} showLabel />
                </div>
              ))}
              {liabilities.length === 0 && <div className="py-8 text-center text-[#8888aa] text-sm">No liabilities</div>}
            </div>
          </>
        )}

        {active === 'liability_payments' && isFinance && (
          <>
            <ReportHeader title={`Liability Payments (${libPayments.length})`} onExport={exportLiabilityPayments} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#2a2a3a]">
                  {['Date', 'Paid To', 'Amount', 'Recorded By', 'Notes'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-medium text-[#8888aa] uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-[#2a2a3a]">
                  {libPayments.map((p, i) => (
                    <tr key={i} className="hover:bg-[#1a1a24]">
                      <td className="px-5 py-3 text-white">{formatDate(p.payment_date)}</td>
                      <td className="px-5 py-3 text-white">{p.liability?.party_name ?? '—'}</td>
                      <td className="px-5 py-3 text-emerald-400 tabular-nums">{formatCurrency(p.amount)}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{p.paid_by_profile?.full_name ?? '—'}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{p.notes ?? '—'}</td>
                    </tr>
                  ))}
                  {libPayments.length > 0 && (
                    <tr className="bg-[#1a1a24] font-semibold">
                      <td className="px-5 py-3 text-white">TOTAL</td>
                      <td className="px-5 py-3" />
                      <td className="px-5 py-3 text-emerald-400 tabular-nums">{formatCurrency(libPayments.reduce((s, p) => s + (p.amount ?? 0), 0))}</td>
                      <td className="px-5 py-3" colSpan={2} />
                    </tr>
                  )}
                  {libPayments.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-[#8888aa]">No payments in this period</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {active === 'payments' && (
          <>
            <ReportHeader title={`Payment Register (${paymentRegister.length})`} onExport={exportPaymentRegister} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#2a2a3a]">
                  {['Date', 'Project', 'Payee', 'Purpose', 'Amount', 'Approval', 'Payment'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-medium text-[#8888aa] uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-[#2a2a3a]">
                  {paymentRegister.map((p, i) => (
                    <tr key={i} className="hover:bg-[#1a1a24]">
                      <td className="px-5 py-3 text-[#8888aa]">{formatDate(p.created_at)}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{p.project?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-white">{p.payee}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{p.purpose}</td>
                      <td className="px-5 py-3 text-white font-semibold tabular-nums">{formatCurrency(p.amount)}</td>
                      <td className="px-5 py-3"><StatusBadge label={p.approval_status} variant={p.approval_status === 'approved' ? 'green' : p.approval_status === 'rejected' ? 'red' : 'yellow'} /></td>
                      <td className="px-5 py-3"><StatusBadge label={p.payment_status} variant={p.payment_status === 'paid' ? 'green' : 'gray'} /></td>
                    </tr>
                  ))}
                  {paymentRegister.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-[#8888aa]">No payment requests in this period</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {active === 'documents' && (
          <>
            <ReportHeader title="Document Report" onExport={() => downloadCSV(
              ['Title', 'Type', 'Party', 'Project', 'Status', 'Document Date', 'Expiry Date'],
              documents.map(d => [d.title, DOCUMENT_TYPE_LABELS[d.document_type as keyof typeof DOCUMENT_TYPE_LABELS] ?? d.document_type, d.party_name ?? '', d.project?.name ?? '', d.status, ddmmyyyy(d.document_date), ddmmyyyy(d.expiry_date)]),
              'OPM_document_report'
            )} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#2a2a3a]">
                  {['Title', 'Type', 'Project', 'Status', 'Expiry'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-medium text-[#8888aa] uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-[#2a2a3a]">
                  {documents.map((d, i) => (
                    <tr key={i} className="hover:bg-[#1a1a24]">
                      <td className="px-5 py-3 text-white">{d.title}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{DOCUMENT_TYPE_LABELS[d.document_type as keyof typeof DOCUMENT_TYPE_LABELS] ?? d.document_type}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{d.project?.name ?? '—'}</td>
                      <td className="px-5 py-3"><StatusBadge label={d.status} variant="gray" /></td>
                      <td className="px-5 py-3 text-[#8888aa]">{d.expiry_date ? formatDate(d.expiry_date) : '—'}</td>
                    </tr>
                  ))}
                  {documents.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-[#8888aa]">No documents</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {active === 'expiring' && (
          <>
            <ReportHeader title="Expiring Agreements" onExport={() => downloadCSV(
              ['Title', 'Type', 'Party', 'Status', 'Expiry Date'],
              [...expired, ...expiring].map(d => [d.title, DOCUMENT_TYPE_LABELS[d.document_type as keyof typeof DOCUMENT_TYPE_LABELS] ?? d.document_type, d.party_name ?? '', isExpired(d.expiry_date) ? 'EXPIRED' : 'Expiring soon', ddmmyyyy(d.expiry_date)]),
              'OPM_expiring_agreements'
            )} />
            <div className="divide-y divide-[#2a2a3a]">
              {[...expired, ...expiring].map((d, i) => {
                const isExp = isExpired(d.expiry_date)
                return (
                  <div key={i} className={`px-5 py-4 flex items-center justify-between ${isExp ? 'bg-red-500/5' : 'bg-amber-500/5'}`}>
                    <div>
                      <div className="text-sm font-medium text-white">{d.title}</div>
                      <div className="text-xs text-[#8888aa]">{DOCUMENT_TYPE_LABELS[d.document_type as keyof typeof DOCUMENT_TYPE_LABELS]} · {d.party_name ?? ''}</div>
                    </div>
                    <div className="text-right">
                      <StatusBadge label={isExp ? 'Expired' : 'Expiring Soon'} variant={isExp ? 'red' : 'yellow'} />
                      <div className="text-xs text-[#8888aa] mt-1">{formatDate(d.expiry_date)}</div>
                    </div>
                  </div>
                )
              })}
              {expiring.length === 0 && expired.length === 0 && (
                <div className="py-8 text-center text-[#8888aa] text-sm">No expiring agreements</div>
              )}
            </div>
          </>
        )}

        {active === 'tds_register' && (
          <>
            <ReportHeader title={`TDS Register (${paymentRegister.filter(p => (p.tds_amount ?? 0) > 0).length} entries)`} onExport={exportTdsRegister} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#2a2a3a]">
                  {['Date', 'Payee', 'PAN', 'Amount', 'TDS %', 'TDS Amount', 'Net Paid'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-medium text-[#8888aa] uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-[#2a2a3a]">
                  {paymentRegister.filter(p => (p.tds_amount ?? 0) > 0).map((p, i) => (
                    <tr key={i} className="hover:bg-[#1a1a24]">
                      <td className="px-5 py-3 text-[#8888aa]">{formatDate(p.created_at)}</td>
                      <td className="px-5 py-3 text-white">{p.payee}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{p.vendor?.pan ?? '—'}</td>
                      <td className="px-5 py-3 text-white tabular-nums">{formatCurrency(p.amount)}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{p.tds_percent ?? 0}%</td>
                      <td className="px-5 py-3 text-red-400 tabular-nums">{formatCurrency(p.tds_amount ?? 0)}</td>
                      <td className="px-5 py-3 text-emerald-400 tabular-nums">{formatCurrency(p.net_payable ?? p.amount)}</td>
                    </tr>
                  ))}
                  {paymentRegister.filter(p => (p.tds_amount ?? 0) > 0).length > 0 && (() => {
                    const tdsPayments = paymentRegister.filter(p => (p.tds_amount ?? 0) > 0)
                    return (
                      <tr className="bg-[#1a1a24] font-semibold">
                        <td className="px-5 py-3 text-white" colSpan={5}>TOTAL</td>
                        <td className="px-5 py-3 text-red-400 tabular-nums">{formatCurrency(tdsPayments.reduce((s, p) => s + (p.tds_amount ?? 0), 0))}</td>
                        <td className="px-5 py-3 text-emerald-400 tabular-nums">{formatCurrency(tdsPayments.reduce((s, p) => s + (p.net_payable ?? p.amount ?? 0), 0))}</td>
                      </tr>
                    )
                  })()}
                  {paymentRegister.filter(p => (p.tds_amount ?? 0) > 0).length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-8 text-center text-[#8888aa]">No TDS deductions in this period</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ReportHeader({ title, onExport }: { title: string; onExport: () => void }) {
  return (
    <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <Button variant="secondary" size="sm" icon={Download} onClick={onExport}>Export CSV</Button>
    </div>
  )
}
