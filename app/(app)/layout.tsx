import { AppShell } from '@/components/layout/AppShell'
import { WhatsAppNudge } from '@/components/ui/WhatsAppNudge'
import { FloatingAssistant } from '@/components/ui/FloatingAssistant'
import { requireProfile } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile()
  const isFinance = ['founder', 'accountant'].includes(profile.role)

  return (
    <AppShell profile={profile}>
      {!profile.whatsapp_number && <WhatsAppNudge />}
      <div className="p-4 lg:p-6">
        {children}
      </div>
      <FloatingAssistant firstName={(profile.full_name as string)?.split(' ')[0] ?? 'there'} finance={isFinance} />
    </AppShell>
  )
}
