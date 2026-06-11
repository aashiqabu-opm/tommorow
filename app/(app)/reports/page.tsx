import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { ReportsClient } from './ReportsClient'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Default period: current Indian financial year (1 April – today).
function fyStart(): string {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-04-01`
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; all?: string }>
}) {
  const supabase = await createClient()
  const profile = await requireProfile()
  const allowed = ['founder', 'accountant', 'general_manager', 'legal_viewer']
  if (!allowed.includes(profile.role)) redirect('/dashboard')

  const params = await searchParams
  const allTime = params.all === '1'
  const from = !allTime && DATE_RE.test(params.from ?? '') ? params.from! : allTime ? '' : fyStart()
  const to = DATE_RE.test(params.to ?? '') ? params.to! : ''

  // Date-bounded queries so the payload stays small as years of data accrue.
  // Liabilities and documents are point-in-time registers, so they stay full.
  let cashQuery = supabase.from('cash_entries')
    .select('*, entered_by_profile:profiles!entered_by(full_name)')
    .order('entry_date', { ascending: true })
  if (from) cashQuery = cashQuery.gte('entry_date', from)
  if (to) cashQuery = cashQuery.lte('entry_date', to)

  let libPayQuery = supabase.from('liability_payments')
    .select('*, liability:liabilities(party_name), paid_by_profile:profiles!paid_by(full_name)')
    .order('payment_date', { ascending: true })
  if (from) libPayQuery = libPayQuery.gte('payment_date', from)
  if (to) libPayQuery = libPayQuery.lte('payment_date', to)

  let paymentsQuery = supabase.from('payment_requests')
    .select('*, project:projects(name), requester:profiles!requested_by(full_name), approver:profiles!approved_by(full_name)')
    .order('created_at', { ascending: true })
  if (from) paymentsQuery = paymentsQuery.gte('created_at', from)
  if (to) paymentsQuery = paymentsQuery.lte('created_at', `${to}T23:59:59`)

  const [
    { data: cashEntries },
    { data: liabilities },
    { data: liabilityPayments },
    { data: payments },
    { data: documents },
    { data: projects },
  ] = await Promise.all([
    cashQuery,
    supabase.from('liabilities').select('*, project:projects(name)').order('created_at', { ascending: true }),
    libPayQuery,
    paymentsQuery,
    supabase.from('documents').select('*, project:projects(name)').order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name'),
  ])

  return (
    <ReportsClient
      cashEntries={cashEntries ?? []}
      liabilities={liabilities ?? []}
      liabilityPayments={liabilityPayments ?? []}
      payments={payments ?? []}
      documents={documents ?? []}
      projects={projects ?? []}
      role={profile.role}
      initialFrom={from}
      initialTo={to}
    />
  )
}
