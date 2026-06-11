import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth'
import Link from 'next/link'
import { CreditCard, Building2, AlertTriangle, FileText, Clapperboard, Search } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { SearchInput } from './SearchInput'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const profile = await requireProfile()
  const role = profile.role

  const params = await searchParams
  const q = (params.q ?? '').trim()
  const isLegalViewer = role === 'legal_viewer'

  let payments: { id: string; payee: string; purpose: string; amount: number; approval_status: string }[] = []
  let vendors: { id: string; name: string; phone?: string }[] = []
  let liabilities: { id: string; party_name: string; amount_owed: number; status: string }[] = []
  let documents: { id: string; title: string; document_type: string; status: string }[] = []
  let projects: { id: string; name: string; status: string }[] = []

  if (q.length >= 2) {
    const likeQ = `%${q}%`

    const queries = await Promise.all([
      // payments
      isLegalViewer
        ? Promise.resolve({ data: [] })
        : supabase.from('payment_requests')
            .select('id, payee, purpose, amount, approval_status')
            .or(`payee.ilike.${likeQ},purpose.ilike.${likeQ}`)
            .limit(8),
      // vendors
      isLegalViewer
        ? Promise.resolve({ data: [] })
        : supabase.from('vendors')
            .select('id, name, phone')
            .ilike('name', likeQ)
            .limit(8),
      // liabilities
      isLegalViewer
        ? Promise.resolve({ data: [] })
        : supabase.from('liabilities')
            .select('id, party_name, amount_owed, status')
            .ilike('party_name', likeQ)
            .limit(8),
      // documents
      supabase.from('documents')
        .select('id, title, document_type, status')
        .or(`title.ilike.${likeQ},party_name.ilike.${likeQ}`)
        .limit(8),
      // projects
      isLegalViewer
        ? Promise.resolve({ data: [] })
        : supabase.from('projects')
            .select('id, name, status')
            .ilike('name', likeQ)
            .limit(5),
    ])

    payments = (queries[0].data ?? []) as typeof payments
    vendors = (queries[1].data ?? []) as typeof vendors
    liabilities = (queries[2].data ?? []) as typeof liabilities
    documents = (queries[3].data ?? []) as typeof documents
    projects = (queries[4].data ?? []) as typeof projects
  }

  const hasResults = payments.length + vendors.length + liabilities.length + documents.length + projects.length > 0

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-white mb-1">Global Search</h1>
        <p className="text-sm text-[#8888aa]">Search across payments, vendors, liabilities, documents and projects</p>
      </div>

      <SearchInput initialValue={q} />

      {q.length > 0 && q.length < 2 && (
        <p className="text-sm text-[#8888aa]">Type at least 2 characters to search</p>
      )}

      {q.length >= 2 && !hasResults && (
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-12 text-center">
          <Search size={32} className="text-[#5a5a7a] mx-auto mb-3" />
          <p className="text-sm text-[#8888aa]">No results found for &ldquo;{q}&rdquo;</p>
        </div>
      )}

      {q.length >= 2 && hasResults && (
        <div className="space-y-6">
          {!isLegalViewer && payments.length > 0 && (
            <ResultSection title={`Payment Requests (${payments.length})`} icon={CreditCard}>
              {payments.map(p => (
                <ResultItem key={p.id} href="/payments" title={p.payee} subtitle={p.purpose}
                  right={formatCurrency(p.amount)} badge={p.approval_status} />
              ))}
            </ResultSection>
          )}

          {!isLegalViewer && vendors.length > 0 && (
            <ResultSection title={`Vendors (${vendors.length})`} icon={Building2}>
              {vendors.map(v => (
                <ResultItem key={v.id} href="/vendors" title={v.name} subtitle={v.phone ?? ''} />
              ))}
            </ResultSection>
          )}

          {!isLegalViewer && liabilities.length > 0 && (
            <ResultSection title={`Liabilities (${liabilities.length})`} icon={AlertTriangle}>
              {liabilities.map(l => (
                <ResultItem key={l.id} href="/liabilities" title={l.party_name}
                  right={formatCurrency(l.amount_owed)} badge={l.status} />
              ))}
            </ResultSection>
          )}

          {documents.length > 0 && (
            <ResultSection title={`Documents (${documents.length})`} icon={FileText}>
              {documents.map(d => (
                <ResultItem key={d.id} href="/documents" title={d.title}
                  subtitle={d.document_type.replace(/_/g, ' ')} badge={d.status} />
              ))}
            </ResultSection>
          )}

          {!isLegalViewer && projects.length > 0 && (
            <ResultSection title={`Projects (${projects.length})`} icon={Clapperboard}>
              {projects.map(p => (
                <ResultItem key={p.id} href={`/projects/${p.id}`} title={p.name} badge={p.status} />
              ))}
            </ResultSection>
          )}
        </div>
      )}
    </div>
  )
}

function ResultSection({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ size?: number; className?: string }>; children: React.ReactNode }) {
  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#2a2a3a] flex items-center gap-2">
        <Icon size={14} className="text-[#8888aa]" />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <div className="divide-y divide-[#2a2a3a]">{children}</div>
    </div>
  )
}

function ResultItem({ href, title, subtitle, right, badge }: {
  href: string; title: string; subtitle?: string; right?: string; badge?: string
}) {
  return (
    <Link href={href} className="flex items-center justify-between px-5 py-3 hover:bg-[#1a1a24] transition-colors">
      <div>
        <div className="text-sm text-white">{title}</div>
        {subtitle && <div className="text-xs text-[#8888aa] mt-0.5">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right && <span className="text-sm font-semibold text-white tabular-nums">{right}</span>}
        {badge && <span className="text-[10px] text-[#8888aa] bg-[#2a2a3a] px-2 py-0.5 rounded-full">{badge.replace(/_/g, ' ')}</span>}
      </div>
    </Link>
  )
}
