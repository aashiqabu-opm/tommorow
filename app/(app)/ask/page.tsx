import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { AskClient } from './AskClient'

export default async function AskPage() {
  const profile = await requireProfile()
  if (!['founder', 'accountant'].includes(profile.role)) redirect('/dashboard')
  return <AskClient firstName={(profile.full_name as string)?.split(' ')[0] ?? 'there'} />
}
