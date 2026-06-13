import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth'
import { TemplatesClient } from './TemplatesClient'

export default async function TemplatesPage() {
  const supabase = await createClient()
  const profile = await requireProfile()

  const { data: templates } = await supabase.from('templates')
    .select('*, uploader:profiles!created_by(full_name)')
    .order('created_at', { ascending: false })

  const canManage = ['founder', 'accountant', 'general_manager', 'executive_producer'].includes(profile.role)
  return <TemplatesClient templates={templates ?? []} userId={profile.id} canManage={canManage} role={profile.role} />
}
