import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { HrClient, type JobPosition, type JobApplication, type AssigneeOpt } from './HrClient'

export const dynamic = 'force-dynamic'

const MGMT = ['founder', 'accountant', 'general_manager', 'executive_producer']

// HR — OPM Flash internal hiring. Core team (management roles) only.
export default async function HrPage() {
  const profile = await requireProfile()
  if (!MGMT.includes(profile.role)) redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: positions }, { data: applications }, { data: people }] = await Promise.all([
    supabase.from('job_positions').select('*').order('created_at', { ascending: false }),
    supabase.from('job_applications').select('*, position:job_positions(title)').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, role').in('role', MGMT).eq('is_active', true).order('full_name'),
  ])

  const assignees = (people ?? []) as AssigneeOpt[]
  // Default assignee = Madan (general_manager), else first GM, else null
  const defaultAssignee = assignees.find(a => /madan/i.test(a.full_name))?.id
    ?? assignees.find(a => a.role === 'general_manager')?.id
    ?? null

  return (
    <div>
      <PageHeader title="HR" subtitle="Internal hiring — positions and applications. Madan manages; escalations route to the founder." />
      <HrClient
        positions={(positions ?? []) as JobPosition[]}
        applications={(applications ?? []) as JobApplication[]}
        assignees={assignees}
        defaultAssignee={defaultAssignee}
        userId={profile.id}
        isFounder={profile.role === 'founder'}
      />
    </div>
  )
}
