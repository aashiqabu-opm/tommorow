import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth'
import { MarketClient } from './MarketClient'

export default async function MarketPage() {
  const supabase = await createClient()
  const profile = await requireProfile()

  const { data: films } = await supabase.from('industry_films')
    .select('*').order('release_date', { ascending: false }).limit(60)

  const canRefresh = ['founder', 'general_manager', 'executive_producer'].includes(profile.role)
  return <MarketClient films={films ?? []} canRefresh={canRefresh} />
}
