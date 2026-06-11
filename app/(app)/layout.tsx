import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/AppShell'
import { WhatsAppNudge } from '@/components/ui/WhatsAppNudge'
import type { Profile } from '@/lib/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return (
    <AppShell profile={profile as Profile}>
      {!(profile as Profile).whatsapp_number && <WhatsAppNudge />}
      <div className="p-4 lg:p-6">
        {children}
      </div>
    </AppShell>
  )
}
