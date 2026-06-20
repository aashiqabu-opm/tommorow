import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withCronErrorAlert } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Daily recurrence engine for OPM Office tasks. A recurring task spawns its next
// occurrence once it's either DONE or past due — then is marked `rolled` so it
// never spawns twice. The successor keeps the same department/role/assignee and
// gets the next due date stepped from the original (so the cadence stays aligned
// to month-end etc.). Completion-or-overdue keeps the office's standing work
// (GST, payroll, rent…) flowing without manual re-creation.
export async function GET(request: Request) {
  return withCronErrorAlert('office-recurring', () => run(request))
}

function nextDue(due: string, recurrence: string): string {
  const d = new Date(due + 'T00:00:00')
  if (recurrence === 'weekly') d.setDate(d.getDate() + 7)
  else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1)
  else if (recurrence === 'quarterly') d.setMonth(d.getMonth() + 3)
  else if (recurrence === 'annual') d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

async function run(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'No service role key' }, { status: 500 })

  const today = new Date().toISOString().slice(0, 10)
  // Recurring tasks ready to roll: not yet rolled, with a due date, and either done or overdue.
  const { data: due } = await admin.from('office_tasks')
    .select('*')
    .neq('recurrence', 'none')
    .eq('rolled', false)
    .not('due_date', 'is', null)

  const ready = (due ?? []).filter(t => t.status === 'done' || (t.due_date && t.due_date < today))
  let spawned = 0
  for (const t of ready) {
    const successor = {
      title: t.title, description: t.description, department: t.department, category: t.category ?? 'general',
      assigned_role: t.assigned_role, assignee_id: t.assignee_id, priority: t.priority, recurrence: t.recurrence,
      status: 'todo', rolled: false, due_date: nextDue(t.due_date, t.recurrence), created_by: t.created_by,
    }
    const { error } = await admin.from('office_tasks').insert(successor)
    if (error) continue
    await admin.from('office_tasks').update({ rolled: true }).eq('id', t.id)
    spawned++
  }
  return NextResponse.json({ ok: true, checked: ready.length, spawned })
}
