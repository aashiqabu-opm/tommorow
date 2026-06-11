import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AuditClient } from './AuditClient'

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'founder') redirect('/dashboard')

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*, profile:profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(300)

  return <AuditClient logs={logs ?? []} />
}
