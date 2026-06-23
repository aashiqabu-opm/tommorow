import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { InboxClient, type Inquiry } from './InboxClient'

export const dynamic = 'force-dynamic'

const MGMT = ['founder', 'accountant', 'general_manager', 'executive_producer']

// Inbox of public website inquiries (line-production / contact / general).
// Careers applications live in the HR module.
export default async function InboxPage() {
  const profile = await requireProfile()
  if (!MGMT.includes(profile.role)) redirect('/dashboard')

  const supabase = await createClient()
  const { data } = await supabase.from('public_inquiries').select('*').order('created_at', { ascending: false }).limit(300)

  return (
    <div>
      <PageHeader title="Inbox" subtitle="Enquiries from the public website — line production, contact, and general. (Job applications are in HR.)" />
      <InboxClient rows={(data ?? []) as Inquiry[]} isFounder={profile.role === 'founder'} />
    </div>
  )
}
