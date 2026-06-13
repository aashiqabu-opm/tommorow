import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth'
import { SettingsClient } from './SettingsClient'
import { FinanceControls } from './FinanceControls'

export default async function SettingsPage() {
  const supabase = await createClient()
  const profile = await requireProfile()
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*, profile:profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-5">
      <FinanceControls role={profile.role} />
      <SettingsClient profile={profile} auditLogs={auditLogs ?? []} />
    </div>
  )
}
