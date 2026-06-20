import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { OfficeClient } from './OfficeClient'
import type { OfficeTask, OfficeNotice } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function OfficePage() {
  const supabase = await createClient()
  const profile = await requireProfile()
  const allowed = ['founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer', 'staff']
  if (!allowed.includes(profile.role)) redirect('/dashboard')

  const [{ data: tasks }, { data: notices }, { data: team }, { data: ops }] = await Promise.all([
    supabase.from('office_tasks').select('*, assignee:profiles!office_tasks_assignee_id_fkey(full_name)').order('created_at', { ascending: false }),
    supabase.from('office_notices').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
    supabase.from('projects').select('id, name').eq('is_operations', true).maybeSingle(),
  ])

  // Office overhead finances come from the operations entity (OPM Office).
  let finance: { budget: number; spent: number; liabilities: number } | null = null
  const isFinance = ['founder', 'accountant', 'general_manager'].includes(profile.role)
  if (ops?.id && isFinance) {
    const [{ data: bl }, { data: pay }, { data: liab }] = await Promise.all([
      supabase.from('budget_lines').select('estimated').eq('project_id', ops.id),
      supabase.from('payment_requests').select('amount, net_payable, payment_status').eq('project_id', ops.id),
      supabase.from('liabilities').select('balance_remaining, status').eq('project_id', ops.id),
    ])
    finance = {
      budget: (bl ?? []).reduce((s, b) => s + Number(b.estimated || 0), 0),
      spent: (pay ?? []).filter(p => p.payment_status === 'paid').reduce((s, p) => s + Number(p.net_payable ?? p.amount ?? 0), 0),
      liabilities: (liab ?? []).filter(l => l.status !== 'cleared').reduce((s, l) => s + Number(l.balance_remaining || 0), 0),
    }
  }

  return (
    <OfficeClient
      tasks={(tasks ?? []) as OfficeTask[]}
      notices={(notices ?? []) as OfficeNotice[]}
      team={(team ?? []) as { id: string; full_name: string }[]}
      finance={finance}
      userId={profile.id}
      role={profile.role}
    />
  )
}
