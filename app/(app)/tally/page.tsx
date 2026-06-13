import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { TallyClient } from './TallyClient'
import { TallySetupChecklist } from './TallySetupChecklist'

export default async function TallyPage() {
  const profile = await requireProfile()
  if (!['founder', 'accountant'].includes(profile.role)) redirect('/dashboard')
  return (
    <div className="space-y-5">
      <PageHeader title="Tally Export" subtitle="Three simple steps to move your books into Tally" />
      <TallySetupChecklist />
      <TallyClient />
    </div>
  )
}
