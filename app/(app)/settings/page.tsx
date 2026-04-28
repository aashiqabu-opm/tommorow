import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*, profile:profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  return <SettingsClient profile={profile} auditLogs={auditLogs ?? []} />
}
