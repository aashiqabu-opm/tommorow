'use client'

import { useState } from 'react'
import { Download, BarChart3 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatCurrency, formatDate, paidPercent, isExpiringSoon, isExpired, DOCUMENT_TYPE_LABELS } from '@/lib/utils'

interface Props {
  cashEntries: Record<string, unknown>[]
  liabilities: Record<string, unknown>[]
  payments: Record<string, unknown>[]
  documents: Record<string, unknown>[]
  projects: { id: string; name: string }[]
  role: string
}

type ReportType = 'cash' | 'liability' | 'payments' | 'documents' | 'expiring' | 'missing'

export function ReportsClient({ cashEntries, liabilities, payments, documents, projects, role }: Props) {
  const [active, setActive] = useState<ReportType>('cash')
  const isFinance = role === 'founder' || role === 'accountant'

  function exportCSV(data: Record<string, unknown>[], filename: string) {
    if (!data.length) return
    const keys = Object.keys(data[0])
    const rows = [keys.join(','), ...data.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalCashIn = cashEntries.reduce((s, e) => s + ((e.cash_in as number) ?? 0), 0)
  const totalCashOut = cashEntries.reduce((s, e) => s + ((e.cash_out as number) ?? 0), 0)
  const totalOwed = liabilities.reduce((s, l) => s + ((l.amount_owed as number) ?? 0), 0)
  const totalPaid = liabilities.reduce((s, l) => s + ((l.amount_paid as number) ?? 0), 0)
  const pendingPayments = payments.filter(p => p.approval_status === 'pending')
  const expiring = documents.filter(d => d.expiry_date && isExpiringSoon(d.expiry_date as string, 30))
  const expired = documents.filter(d => d.expiry_date && isExpired(d.expiry_date as string))

  const TABS: { key: ReportType; label: string; finance?: boolean }[] = [
    { key: 'cash', label: 'Cash Report', finance: true },
    { key: 'liability', label: 'Liability Report', finance: true },
    { key: 'payments', label: 'Pending Payments' },
    { key: 'documents', label: 'Documents' },
    { key: 'expiring', label: 'Expiring Agreements' },
  ]

  const availableTabs = TABS.filter(t => !t.finance || isFinance)

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Financial and operational summaries" />

      {/* Summary cards */}
      {isFinance && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Total Cash In" value={formatCurrency(totalCashIn)} status="green" icon={BarChart3} />
          <StatCard title="Total Cash Out" value={formatCurrency(totalCashOut)} status="red" />
          <StatCard title="Total Liabilities" value={formatCurrency(totalOwed)} status="yellow" />
          <StatCard title="Liability Cleared" value={`${paidPercent(totalPaid, totalOwed)}%`} status={paidPercent(totalPaid, totalOwed) > 60 ? 'green' : 'yellow'} />
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
            <ReportHeader title="Cash Report" onExport={() => exportCSV(cashEntries, 'cash_report')} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#2a2a3a]">
                  {['Date', 'Opening', 'Cash In', 'Cash Out', 'Closing', 'Notes'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-medium text-[#8888aa] uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-[#2a2a3a]">
                  {cashEntries.map((e, i) => (
                    <tr key={i} className="hover:bg-[#1a1a24]">
                      <td className="px-5 py-3 text-white">{formatDate(e.entry_date as string)}</td>
                      <td className="px-5 py-3 text-[#8888aa] tabular-nums">{formatCurrency(e.opening_cash as number)}</td>
                      <td className="px-5 py-3 text-emerald-400 tabular-nums">+{formatCurrency(e.cash_in as number)}</td>
                      <td className="px-5 py-3 text-red-400 tabular-nums">-{formatCurrency(e.cash_out as number)}</td>
                      <td className="px-5 py-3 text-white font-semibold tabular-nums">{formatCurrency(e.closing_cash as number)}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{(e.notes as string) ?? '—'}</td>
                    </tr>
                  ))}
                  {cashEntries.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-[#8888aa]">No entries</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {active === 'liability' && isFinance && (
          <>
            <ReportHeader title="Liability Report" onExport={() => exportCSV(liabilities, 'liability_report')} />
            <div className="divide-y divide-[#2a2a3a]">
              {liabilities.map((l, i) => {
                const pct = paidPercent((l.amount_paid as number) ?? 0, (l.amount_owed as number) ?? 0)
                return (
                  <div key={i} className="px-5 py-4">
                    <div className="flex justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium text-white">{l.party_name as string}</span>
                        <span className="ml-2 text-xs text-[#8888aa]">{l.type as string}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-white tabular-nums">{formatCurrency(l.amount_owed as number)}</div>
                        <div className="text-xs text-[#8888aa]">Bal: {formatCurrency(l.balance_remaining as number)}</div>
                      </div>
                    </div>
                    <ProgressBar value={(l.amount_paid as number) ?? 0} max={(l.amount_owed as number) ?? 1} showLabel />
                  </div>
                )
              })}
              {liabilities.length === 0 && <div className="py-8 text-center text-[#8888aa] text-sm">No liabilities</div>}
            </div>
          </>
        )}

        {active === 'payments' && (
          <>
            <ReportHeader title="Pending Payment Report" onExport={() => exportCSV(pendingPayments, 'pending_payments')} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#2a2a3a]">
                  {['Project', 'Payee', 'Purpose', 'Amount', 'Due Date'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-medium text-[#8888aa] uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-[#2a2a3a]">
                  {pendingPayments.map((p, i) => (
                    <tr key={i} className="hover:bg-[#1a1a24]">
                      <td className="px-5 py-3 text-[#8888aa]">{(p.project as { name?: string } | null)?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-white">{p.payee as string}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{p.purpose as string}</td>
                      <td className="px-5 py-3 text-white font-semibold tabular-nums">{formatCurrency(p.amount as number)}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{p.due_date ? formatDate(p.due_date as string) : '—'}</td>
                    </tr>
                  ))}
                  {pendingPayments.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-[#8888aa]">No pending payments</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}

        {active === 'documents' && (
          <>
            <ReportHeader title="Document Report" onExport={() => exportCSV(documents, 'document_report')} />
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
                      <td className="px-5 py-3 text-white">{d.title as string}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{DOCUMENT_TYPE_LABELS[d.document_type as string] ?? (d.document_type as string)}</td>
                      <td className="px-5 py-3 text-[#8888aa]">{(d.project as { name?: string } | null)?.name ?? '—'}</td>
                      <td className="px-5 py-3"><StatusBadge label={d.status as string} variant="gray" /></td>
                      <td className="px-5 py-3 text-[#8888aa]">{d.expiry_date ? formatDate(d.expiry_date as string) : '—'}</td>
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
            <ReportHeader title="Expiring Agreements" onExport={() => exportCSV([...expiring, ...expired], 'expiring_agreements')} />
            <div className="divide-y divide-[#2a2a3a]">
              {[...expired, ...expiring].map((d, i) => {
                const isExp = isExpired(d.expiry_date as string)
                return (
                  <div key={i} className={`px-5 py-4 flex items-center justify-between ${isExp ? 'bg-red-500/5' : 'bg-amber-500/5'}`}>
                    <div>
                      <div className="text-sm font-medium text-white">{d.title as string}</div>
                      <div className="text-xs text-[#8888aa]">{DOCUMENT_TYPE_LABELS[d.document_type as string]} · {(d.party_name as string) ?? ''}</div>
                    </div>
                    <div className="text-right">
                      <StatusBadge label={isExp ? 'Expired' : 'Expiring Soon'} variant={isExp ? 'red' : 'yellow'} />
                      <div className="text-xs text-[#8888aa] mt-1">{formatDate(d.expiry_date as string)}</div>
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
