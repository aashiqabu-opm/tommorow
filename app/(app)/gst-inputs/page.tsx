import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { GstInputsClient, type GstInput } from './GstInputsClient'

// Company-side GST input register. Receives items the founder pushes from their
// private Personal module. Finance-only.
export default async function GstInputsPage() {
  const profile = await requireProfile()
  if (!['founder', 'accountant'].includes(profile.role)) redirect('/dashboard')

  const supabase = await createClient()
  const { data } = await supabase.from('gst_inputs').select('*').order('invoice_date', { ascending: false, nullsFirst: false })
  return <GstInputsClient rows={(data ?? []) as GstInput[]} />
}
