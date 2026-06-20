import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SocialClient } from './SocialClient'
import type { SocialAccount, SocialPost } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function SocialPage() {
  const supabase = await createClient()
  const profile = await requireProfile()
  const allowed = ['founder', 'accountant', 'general_manager', 'executive_producer', 'staff']
  if (!allowed.includes(profile.role)) redirect('/dashboard')

  const [{ data: accounts }, { data: posts }] = await Promise.all([
    supabase.from('social_accounts').select('*').order('created_at'),
    supabase.from('social_posts').select('*, account:social_accounts(name, platform)').order('scheduled_at', { ascending: true, nullsFirst: false }),
  ])

  return (
    <SocialClient
      accounts={(accounts ?? []) as SocialAccount[]}
      posts={(posts ?? []) as SocialPost[]}
      userId={profile.id}
      role={profile.role}
    />
  )
}
