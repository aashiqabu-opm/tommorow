import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

// Request-level memoized auth.
//
// React's cache() dedupes these calls across every server component rendered
// for a single request — so the app shell (layout) and the page it wraps make
// just one auth round-trip and one profile query between them, instead of
// repeating both in each component. getUser() in particular validates the JWT
// over the network on every call, so collapsing it is a real latency win.

export const getSessionUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return (data as Profile) ?? null
})

// Require a signed-in profile; redirect to /login otherwise. Returns the full
// profile (its `id` equals the auth user id, so callers rarely need the user).
export const requireProfile = cache(async (): Promise<Profile> => {
  const profile = await getSessionProfile()
  if (!profile) redirect('/login')
  return profile
})
