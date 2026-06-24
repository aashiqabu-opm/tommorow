import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { WhatMatters } from '@/components/ui/WhatMatters'
import { liabilitiesWhatMatters } from '@/lib/what-matters'
import { LiabilitiesClient } from './LiabilitiesClient'

export default async function LiabilitiesPage() {
  const supabase = await createClient()
  const profile = await requireProfile()
  if (profile.role !== 'founder' && profile.role !== 'accountant') redirect('/dashboard')

  const [{ data: liabilities }, { data: projects }] = await Promise.all([
    supabase.from('liabilities').select('*').order('priority').order('due_date'),
    supabase.from('projects').select('id, name'),
  ])

  return (
    <div className="space-y-4">
      <WhatMatters items={liabilitiesWhatMatters(liabilities ?? [])} />
      <LiabilitiesClient liabilities={liabilities ?? []} projects={projects ?? []} userId={profile.id} role={profile.role} />
    </div>
  )
}
