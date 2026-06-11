'use client'

import { useMemo, useState } from 'react'
import { ScrollText, Filter } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import type { AuditLog } from '@/lib/types'

interface Props {
  logs: AuditLog[]
}

const ENTITY_LABELS: Record<string, string> = {
  cash_entries: 'Cash Entry',
  liabilities: 'Liability',
  liability_payments: 'Liability Payment',
  payment_requests: 'Payment Request',
  documents: 'Document',
  document_files: 'Document File',
  projects: 'Project',
  profiles: 'User',
  comments: 'Comment',
}

const ACTION_VARIANTS: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  create: 'green',
  update: 'yellow',
  delete: 'red',
}

// Skip noisy bookkeeping fields when summarizing a change
const HIDDEN_FIELDS = new Set(['updated_at', 'created_at', 'id', 'verified_at', 'approved_at', 'paid_at', 'verified_by', 'approved_by', 'paid_by'])

function summarize(log: AuditLog): string {
  const newValues = log.new_values ?? {}
  const oldValues = log.old_values ?? {}

  if (log.action === 'create') {
    const highlights = ['payee', 'party_name', 'title', 'name', 'full_name', 'amount', 'amount_owed', 'closing_cash', 'purpose']
      .filter((k) => newValues[k] !== undefined && newValues[k] !== null)
      .slice(0, 3)
      .map((k) => `${k.replace(/_/g, ' ')}: ${newValues[k]}`)
    return highlights.join(' · ') || 'New record created'
  }

  const changes = Object.keys(newValues)
    .filter((k) => !HIDDEN_FIELDS.has(k))
    .map((k) => {
      const from = oldValues[k]
      return from !== undefined
        ? `${k.replace(/_/g, ' ')}: ${from} → ${newValues[k]}`
        : `${k.replace(/_/g, ' ')}: ${newValues[k]}`
    })
  return changes.join(' · ') || 'Record updated'
}

export function AuditClient({ logs }: Props) {
  const [entityFilter, setEntityFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const entityTypes = useMemo(() => [...new Set(logs.map((l) => l.entity_type))].sort(), [logs])
  const actions = useMemo(() => [...new Set(logs.map((l) => l.action))].sort(), [logs])

  const filtered = logs.filter((l) =>
    (!entityFilter || l.entity_type === entityFilter) &&
    (!actionFilter || l.action === actionFilter)
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" subtitle="Every action taken in the app, by everyone" />

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-[#8888aa]" />
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="bg-[#13131a] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40"
        >
          <option value="">All modules</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{ENTITY_LABELS[t] ?? t}</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-[#13131a] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a} className="capitalize">{a}</option>
          ))}
        </select>
        <span className="text-xs text-[#5a5a7a] ml-auto">{filtered.length} of {logs.length} entries (latest 300)</span>
      </div>

      {/* Log list */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[#8888aa] text-sm flex flex-col items-center gap-2">
            <ScrollText size={24} className="text-[#5a5a7a]" />
            No audit entries found
          </div>
        ) : (
          <div className="divide-y divide-[#2a2a3a]">
            {filtered.map((log) => (
              <div key={log.id} className="px-5 py-3.5 hover:bg-[#1a1a24] transition-colors">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-white">{log.profile?.full_name ?? 'Unknown user'}</span>
                  <StatusBadge label={log.action} variant={ACTION_VARIANTS[log.action] ?? 'gray'} />
                  <span className="text-xs text-[#8888aa]">{ENTITY_LABELS[log.entity_type] ?? log.entity_type}</span>
                  <span className="text-[11px] text-[#5a5a7a] ml-auto shrink-0">
                    {new Date(log.created_at).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true,
                    })}
                  </span>
                </div>
                <p className="text-[11px] text-[#8888aa] mt-1 break-words">{summarize(log)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
