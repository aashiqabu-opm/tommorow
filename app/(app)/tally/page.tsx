import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { TallyClient } from './TallyClient'

export default async function TallyPage() {
  const profile = await requireProfile()
  if (!['founder', 'accountant'].includes(profile.role)) redirect('/dashboard')
  return <TallyClient />
}
