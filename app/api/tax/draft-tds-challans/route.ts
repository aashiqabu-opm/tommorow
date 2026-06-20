import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Auto-draft TDS challans from payments that have both a TDS amount and a
// section. Groups by (section, deduction month) and sums the TDS into one draft
// challan each. Idempotent: it refreshes the auto-drafted challans (those still
// without a challan number) and never touches challans you've already filed.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('id, role, is_active').eq('id', user.id).single()
  if (!profile?.is_active || !['founder', 'accountant'].includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: pays } = await supabase
    .from('payment_requests')
    .select('tds_amount, tds_section, paid_at, due_date, created_at')
    .gt('tds_amount', 0)
    .not('tds_section', 'is', null)

  // group by `${section}|${YYYY-MM}`
  const groups: Record<string, { section: string; month: string; amount: number; count: number }> = {}
  for (const p of pays ?? []) {
    const section = String(p.tds_section).trim()
    const d = (p.paid_at || p.due_date || p.created_at || '').slice(0, 7)
    if (!section || !d) continue
    const k = `${section}|${d}`
    ;(groups[k] ??= { section, month: d, amount: 0, count: 0 })
    groups[k].amount += Number(p.tds_amount || 0)
    groups[k].count++
  }

  // refresh auto-drafts: remove prior unfiled auto-drafts, keep filed ones (challan_no set)
  await supabase.from('tds_challans').delete().like('notes', 'Auto-draft%').is('challan_no', null)

  const rows = Object.values(groups).filter(g => Math.round(g.amount) > 0).map(g => ({
    deposit_date: new Date().toISOString().slice(0, 10),
    period_month: g.month, section: g.section, amount: Math.round(g.amount * 100) / 100,
    notes: `Auto-draft from ${g.count} payment(s). Review, deposit, then add challan no.`,
    created_by: profile.id,
  }))
  let drafted = 0
  if (rows.length) { const { error } = await supabase.from('tds_challans').insert(rows); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); drafted = rows.length }

  const total = rows.reduce((s, r) => s + r.amount, 0)
  return NextResponse.json({ ok: true, drafted, total, sections: [...new Set(rows.map(r => r.section))] })
}
