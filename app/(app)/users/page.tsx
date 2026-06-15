import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { UsersClient } from './UsersClient'

export default async function UsersPage() {
  const supabase = await createClient()
  const profile = await requireProfile()
  if (profile.role !== 'founder') redirect('/dashboard')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at')

  // Map each login that belongs to project crew → the projects + roles they hold,
  // so the Users page can show their real designation instead of the generic
  // "staff" label and keep them separate from company users.
  const { data: memberships } = await supabase
    .from('project_members')
    .select('user_id, project_role, title, projects(name)')
    .not('user_id', 'is', null)

  const crew: Record<string, { project: string; role: string }[]> = {}
  for (const m of memberships ?? []) {
    const uid = m.user_id as string | null
    if (!uid) continue
    ;(crew[uid] ??= []).push({
      project: (m.projects as { name?: string } | null)?.name ?? 'Project',
      role: (m.title as string) || (m.project_role as string) || 'crew',
    })
  }

  return <UsersClient profiles={profiles ?? []} currentUserId={profile.id} crew={crew} />
}
