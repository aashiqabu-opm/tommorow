import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { RevenueClient } from './RevenueClient'

export default async function RevenuePage() {
  const supabase = await createClient()
  const profile = await requireProfile()
  if (!['founder', 'accountant'].includes(profile.role)) redirect('/dashboard')

  const [{ data: income }, { data: projects }] = await Promise.all([
    supabase.from('project_income')
      .select('*, project:projects(name)')
      .order('income_date', { ascending: false }),
    supabase.from('projects').select('id, name').order('name'),
  ])

  return (
    <RevenueClient
      income={income ?? []}
      projects={projects ?? []}
      userId={profile.id}
      role={profile.role}
    />
  )
}
