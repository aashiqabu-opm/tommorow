import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth'
import { DocumentsClient } from './DocumentsClient'

export default async function DocumentsPage() {
  const supabase = await createClient()
  const profile = await requireProfile()
  const role = profile.role

  const [{ data: documents }, { data: projects }] = await Promise.all([
    supabase.from('documents')
      .select('*, project:projects(name), uploader:profiles!uploaded_by(full_name), files:document_files(id)')
      .order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name'),
  ])

  return <DocumentsClient documents={documents ?? []} projects={projects ?? []} userId={profile.id} role={role} />
}
