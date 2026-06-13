import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth'
import { MarketClient } from './MarketClient'

export default async function MarketPage() {
  const supabase = await createClient()
  const profile = await requireProfile()

  const { data: briefs } = await supabase.from('industry_briefs')
    .select('*').order('week_of', { ascending: false }).limit(26)

  const canRefresh = ['founder', 'general_manager', 'executive_producer'].includes(profile.role)
  return <MarketClient briefs={briefs ?? []} canRefresh={canRefresh} />
}
