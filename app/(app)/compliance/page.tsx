import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth'
import { ComplianceClient } from './ComplianceClient'

export default async function CompliancePage() {
  const supabase = await createClient()
  const profile = await requireProfile()
  if (!['founder', 'accountant'].includes(profile.role)) redirect('/dashboard')

  const [{ data: payments }, { data: crew }, { data: income }, { data: challans }] = await Promise.all([
    supabase.from('payment_requests')
      .select('created_at, paid_at, payee, amount, tds_percent, tds_amount, tds_section, gst_amount, category, approval_status, payment_status, project:projects(name), vendor:vendors(name, pan, gst_number)')
      .order('created_at', { ascending: false }),
    supabase.from('project_crew')
      .select('name, pan, tds_percent, project:projects(name), payments:crew_payments(amount, payment_date)')
      .gt('tds_percent', 0),
    supabase.from('project_income')
      .select('amount, gst_amount, income_date, party, source, project:projects(name)')
      .order('income_date', { ascending: false }),
    supabase.from('tds_challans').select('*').order('deposit_date', { ascending: false }),
  ])

  return <ComplianceClient payments={payments ?? []} crew={crew ?? []} income={income ?? []} challans={challans ?? []} userId={profile.id} />
}
