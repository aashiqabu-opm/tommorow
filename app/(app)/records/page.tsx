import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { RecordsClient } from './RecordsClient'

export default async function RecordsPage() {
  const supabase = await createClient()
  const profile = await requireProfile()

  const allowedRoles = ['founder', 'accountant', 'general_manager']
  if (!allowedRoles.includes(profile.role)) {
    redirect('/dashboard')
  }

  const [
    { data: titles },
    { data: channels },
    { data: royalties }
  ] = await Promise.all([
    supabase.from('opm_records_titles').select('*').order('created_at', { ascending: false }),
    supabase.from('opm_records_channels').select('*').order('created_at', { ascending: false }),
    supabase.from('opm_records_royalties').select('*, title:opm_records_titles(*)').order('created_at', { ascending: false })
  ])

  return (
    <RecordsClient
      titles={titles ?? []}
      channels={channels ?? []}
      royalties={royalties ?? []}
      userId={profile.id}
      role={profile.role}
    />
  )
}
