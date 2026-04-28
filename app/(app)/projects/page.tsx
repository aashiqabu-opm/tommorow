import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProjectsClient } from './ProjectsClient'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  return <ProjectsClient projects={projects ?? []} userId={user.id} role={profile?.role ?? ''} />
}
