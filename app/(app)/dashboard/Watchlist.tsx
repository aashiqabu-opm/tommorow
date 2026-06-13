import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'

// Proactive, deterministic watchlist — surfaces things needing attention without
// any AI cost: pending approvals, unpaid approved payments, overdue liabilities,
// TDS without PAN, and unreconciled bank lines. Only fires items that matter.
export async function Watchlist() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [pending, approvedUnpaid, overdueLiab, tdsNoPan, unmatched] = await Promise.all([
    supabase.from('payment_requests').select('amount').eq('approval_status', 'pending'),
    supabase.from('payment_requests').select('amount').eq('approval_status', 'approved').eq('payment_status', 'unpaid'),
    supabase.from('liabilities').select('balance_remaining').neq('status', 'cleared').not('due_date', 'is', null).lt('due_date', today),
    supabase.from('payment_requests').select('payee, vendor:vendors(pan)').gt('tds_amount', 0),
    supabase.from('bank_transactions').select('id', { count: 'exact', head: true }).is('matched_type', null),
  ])

  const sum = (rows: { amount?: number; balance_remaining?: number }[] | null, key: 'amount' | 'balance_remaining') =>
    (rows ?? []).reduce((s, r) => s + Number((r as Record<string, number>)[key] ?? 0), 0)

  const noPanCount = (tdsNoPan.data ?? []).filter((p: Record<string, any>) => !p.vendor?.pan).length // eslint-disable-line @typescript-eslint/no-explicit-any

  const items = [
    { n: pending.data?.length ?? 0, label: 'payments awaiting approval', sub: formatCurrency(sum(pending.data, 'amount')), href: '/payments', tone: 'amber' },
    { n: approvedUnpaid.data?.length ?? 0, label: 'approved, not yet paid', sub: formatCurrency(sum(approvedUnpaid.data, 'amount')), href: '/payments', tone: 'amber' },
    { n: overdueLiab.data?.length ?? 0, label: 'liabilities overdue', sub: formatCurrency(sum(overdueLiab.data, 'balance_remaining')), href: '/liabilities', tone: 'red' },
    { n: noPanCount, label: 'TDS entries missing PAN', sub: 'needed for 26Q', href: '/payments', tone: 'red' },
    { n: unmatched.count ?? 0, label: 'unreconciled bank lines', sub: 'in Reconcile', href: '/reconcile', tone: 'amber' },
  ].filter(i => i.n > 0)

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Needs Attention</h3>
      </div>
      {items.length === 0 ? (
        <div className="py-8 text-center text-sm text-emerald-400/80 flex items-center justify-center gap-2"><CheckCircle2 size={16} /> All clear — nothing needs attention.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {items.map((it, i) => (
            <Link key={i} href={it.href} className="px-5 py-3 flex items-center gap-3 hover:bg-[#1a1a24] transition-colors">
              <span className={`text-lg font-bold tabular-nums shrink-0 ${it.tone === 'red' ? 'text-red-400' : 'text-amber-400'}`}>{it.n}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white">{it.label}</div>
                <div className="text-[11px] text-[#8888aa]">{it.sub}</div>
              </div>
              <ChevronRight size={16} className="text-[#5a5a7a] shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
