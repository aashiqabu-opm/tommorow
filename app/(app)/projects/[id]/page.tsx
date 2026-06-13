import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { ProjectDetailClient } from './ProjectDetailClient'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const profile = await requireProfile()

  const isFinance = ['founder', 'accountant'].includes(profile.role)
  const isManagement = ['founder', 'accountant', 'general_manager', 'executive_producer'].includes(profile.role)

  const [
    { data: project },
    { data: documents },
    { data: payments },
    { data: liabilities },
    { data: income },
    funding,
    budgetLines,
    pettyFloats,
    crew,
    dprs,
    members,
    checkins,
    phaseTasks,
    collections,
    findings,
    campaignAssets,
  ] = await Promise.all([
    supabase.from('projects').select('*').eq('id', id).single(),
    supabase.from('documents').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('payment_requests').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    supabase.from('liabilities').select('*').eq('project_id', id),
    supabase.from('project_income').select('*').eq('project_id', id).order('income_date', { ascending: false }),
    // Finance-only; gracefully empty if the table isn't migrated yet
    isFinance
      ? supabase.from('project_funding')
          .select('*, transactions:funding_transactions(*)')
          .eq('project_id', id)
          .order('created_at', { ascending: true })
          .order('txn_date', { referencedTable: 'funding_transactions', ascending: false })
          .then(r => r.data ?? [])
      : Promise.resolve([]),
    isFinance
      ? supabase.from('budget_lines').select('*').eq('project_id', id).order('sort_order', { ascending: true }).then(r => r.data ?? [])
      : Promise.resolve([]),
    isFinance
      ? supabase.from('petty_cash_floats').select('*, txns:petty_cash_txns(*)').eq('project_id', id).order('created_at', { ascending: true }).then(r => r.data ?? [])
      : Promise.resolve([]),
    isFinance
      ? supabase.from('project_crew').select('*, payments:crew_payments(*)').eq('project_id', id).order('created_at', { ascending: true }).then(r => r.data ?? [])
      : Promise.resolve([]),
    isManagement
      ? supabase.from('production_reports').select('*').eq('project_id', id).order('report_date', { ascending: false }).then(r => r.data ?? [])
      : Promise.resolve([]),
    // Core team + daily check-ins — gracefully empty if not migrated yet
    supabase.from('project_members')
      .select('*, profile:profiles!user_id(id, full_name, email, role)')
      .eq('project_id', id)
      .order('created_at', { ascending: true })
      .then(r => r.data ?? []),
    supabase.from('project_checkins')
      .select('*, author:profiles!author_id(full_name, role)')
      .eq('project_id', id)
      .order('checkin_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(60)
      .then(r => r.data ?? []),
    // Tracker, collections, monitoring — gracefully empty if not migrated yet
    supabase.from('phase_tasks').select('*').eq('project_id', id).order('sort_order', { ascending: true }).then(r => r.data ?? []),
    supabase.from('box_office_collections').select('*').eq('project_id', id).order('collection_date', { ascending: false }).then(r => r.data ?? []),
    isManagement
      ? supabase.from('monitoring_findings').select('*').eq('project_id', id).order('scan_date', { ascending: false }).limit(60).then(r => r.data ?? [])
      : Promise.resolve([]),
    supabase.from('campaign_assets').select('*').eq('project_id', id).order('released_on', { ascending: false }).then(r => r.data ?? []),
  ])

  if (!project) notFound()

  // Roster of users that management can add to the team
  const canManageTeam = ['founder', 'general_manager', 'executive_producer'].includes(profile.role)
  const { data: allProfiles } = canManageTeam
    ? await supabase.from('profiles').select('id, full_name, email, role').eq('is_active', true).order('full_name')
    : { data: [] }

  // Petty-cash expenses and crew payments coded to a budget head feed the cost report's "Spent"
  const extraSpentByLine: Record<string, number> = {}
  const addSpent = (lineId: string | null, amt: number) => { if (lineId) extraSpentByLine[lineId] = (extraSpentByLine[lineId] ?? 0) + amt }
  for (const f of (pettyFloats as { txns?: { type: string; amount: number; budget_line_id: string | null }[] }[])) {
    for (const t of f.txns ?? []) {
      if (t.type === 'expense') addSpent(t.budget_line_id, Number(t.amount || 0))
    }
  }
  for (const c of (crew as { budget_line_id: string | null; payments?: { amount: number }[] }[])) {
    const paid = (c.payments ?? []).reduce((s, p) => s + Number(p.amount || 0), 0)
    addSpent(c.budget_line_id, paid)
  }

  return (
    <ProjectDetailClient
      project={project}
      documents={documents ?? []}
      payments={payments ?? []}
      liabilities={liabilities ?? []}
      income={income ?? []}
      funding={funding ?? []}
      budgetLines={budgetLines ?? []}
      pettyFloats={pettyFloats ?? []}
      crew={crew ?? []}
      dprs={dprs ?? []}
      members={members ?? []}
      checkins={checkins ?? []}
      allProfiles={allProfiles ?? []}
      phaseTasks={phaseTasks ?? []}
      collections={collections ?? []}
      findings={findings ?? []}
      campaignAssets={campaignAssets ?? []}
      extraSpentByLine={extraSpentByLine}
      userId={profile.id}
      role={profile.role}
    />
  )
}
