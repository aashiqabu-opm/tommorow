import { requireProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { WorkspaceClient } from './WorkspaceClient'
import { getWorkspaceUsers } from '@/lib/google-workspace'

export const dynamic = 'force-dynamic'

export default async function WorkspacePage() {
  const profile = await requireProfile()
  
  if (profile.role !== 'founder' && profile.role !== 'general_manager') {
    redirect('/dashboard')
  }

  // Fetch users for the domain
  const users = await getWorkspaceUsers('opmrecords.com')

  return <WorkspaceClient initialUsers={users} />
}
