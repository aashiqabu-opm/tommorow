import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PayrollClient } from './PayrollClient'

export default async function PayrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = profile?.role

  const allowed = ['founder', 'accountant']
  if (!allowed.includes(role ?? '')) redirect('/dashboard')

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [{ data: staff }, { data: vendors }, { data: pendingLiabilities }] = await Promise.all([
    supabase.from('staff_salaries').select('*').order('person_name'),
    supabase.from('vendors').select('id, name').order('name'),
    supabase.from('liabilities')
      .select('id')
      .eq('type', 'salary')
      .eq('status', 'unpaid')
      .gte('original_date', `${currentMonth}-01`)
      .lt('original_date', new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0]),
  ])

  const activeStaff = (staff ?? []).filter(s => s.is_active)
  const totalMonthlyPayroll = activeStaff.reduce((s, p) => s + (p.monthly_salary ?? 0), 0)

  return (
    <PayrollClient
      staff={staff ?? []}
      vendors={vendors ?? []}
      totalMonthlyPayroll={totalMonthlyPayroll}
      pendingThisMonth={pendingLiabilities?.length ?? 0}
      userId={user.id}
    />
  )
}
