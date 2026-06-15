import { AppShell } from '@/components/layout/AppShell'
import { WhatsAppNudge } from '@/components/ui/WhatsAppNudge'
import { FloatingAssistant } from '@/components/ui/FloatingAssistant'
import { AiHealthBanner } from '@/components/ui/AiHealthBanner'
import { requireProfile } from '@/lib/auth'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile()
  // Ask OPM (incl. the floating button) is founder-only — it's a metered, costly resource.
  const canAsk = profile.role === 'founder'

  return (
    <AppShell profile={profile}>
      {!profile.whatsapp_number && <WhatsAppNudge />}
      <AiHealthBanner />
      <div className="p-4 lg:p-6">
        {children}
      </div>
      {canAsk && <FloatingAssistant firstName={(profile.full_name as string)?.split(' ')[0] ?? 'there'} finance={true} />}
    </AppShell>
  )
}
