import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { VehiclesClient } from './VehiclesClient'

export default async function VehiclesPage() {
  const supabase = await createClient()
  const profile = await requireProfile()
  if (!['founder', 'accountant', 'general_manager', 'executive_producer'].includes(profile.role)) redirect('/dashboard')

  const [{ data: vehicles }, { data: projects }] = await Promise.all([
    supabase.from('vehicles')
      .select('*, project:projects(name), logs:vehicle_logs(*)')
      .order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name').order('name'),
  ])

  return <VehiclesClient vehicles={vehicles ?? []} projects={projects ?? []} userId={profile.id} canDelete={profile.role === 'founder'} />
}
