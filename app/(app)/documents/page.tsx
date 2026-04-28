import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DocumentsClient } from './DocumentsClient'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role ?? ''

  const [{ data: documents }, { data: projects }] = await Promise.all([
    supabase.from('documents')
      .select('*, project:projects(name), uploader:profiles!uploaded_by(full_name)')
      .order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name'),
  ])

  return <DocumentsClient documents={documents ?? []} projects={projects ?? []} userId={user.id} role={role} />
}
