import { AppShell } from '@/components/layout/AppShell'
import { WhatsAppNudge } from '@/components/ui/WhatsAppNudge'
import { requireProfile } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile()

  return (
    <AppShell profile={profile}>
      {!profile.whatsapp_number && <WhatsAppNudge />}
      <div className="p-4 lg:p-6">
        {children}
      </div>
    </AppShell>
  )
}
