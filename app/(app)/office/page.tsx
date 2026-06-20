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

  const [{ data: tasks }, { data: notices }, { data: team }] = await Promise.all([
    supabase.from('office_tasks').select('*, assignee:profiles!office_tasks_assignee_id_fkey(full_name)').order('created_at', { ascending: false }),
    supabase.from('office_notices').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name'),
  ])

  return (
    <OfficeClient
      tasks={(tasks ?? []) as OfficeTask[]}
      notices={(notices ?? []) as OfficeNotice[]}
      team={(team ?? []) as { id: string; full_name: string }[]}
      userId={profile.id}
      role={profile.role}
    />
  )
}
