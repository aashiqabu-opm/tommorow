import { Check, Circle, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

// Live setup checklist — probes the DB so the team sees, at a glance, what's
// ready and what's still pending for the Tally workflow.
async function probe(table: string): Promise<{ ok: boolean; count: number; missing: boolean }> {
  const supabase = await createClient()
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) return { ok: false, count: 0, missing: /does not exist|schema cache/i.test(error.message) }
  return { ok: (count ?? 0) > 0, count: count ?? 0, missing: false }
}

export async function TallySetupChecklist() {
  const [ledgers, vouchers, payments] = await Promise.all([probe('ledgers'), probe('vouchers'), probe('payment_requests')])

  const items = [
    {
      label: 'Accounting tables installed',
      done: !ledgers.missing && !vouchers.missing,
      note: ledgers.missing || vouchers.missing ? 'Run migration-vouchers.sql in Supabase' : 'Ready',
    },
    {
      label: 'Chart of accounts set up',
      done: ledgers.ok,
      note: ledgers.missing ? 'Install tables first' : ledgers.ok ? `${ledgers.count} ledgers` : 'Add your ledgers on the Vouchers page',
    },
    {
      label: 'Entries to export',
      done: vouchers.ok || payments.ok,
      note: vouchers.ok ? `${vouchers.count} vouchers` : payments.ok ? `${payments.count} payments ready` : 'Add vouchers or approve payments',
    },
  ]
  const pending = items.filter(i => !i.done).length

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Setup status</h3>
        <span className={`text-xs font-medium ${pending === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
          {pending === 0 ? 'All set' : `${pending} step${pending > 1 ? 's' : ''} left`}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2.5">
            {it.done
              ? <Check size={15} className="text-emerald-400 shrink-0" />
              : it.note.startsWith('Run ') ? <AlertCircle size={15} className="text-amber-400 shrink-0" /> : <Circle size={14} className="text-[#5a5a7a] shrink-0" />}
            <span className={`text-sm ${it.done ? 'text-[#c8c8da]' : 'text-white'}`}>{it.label}</span>
            <span className="text-[11px] text-[#8888aa] ml-auto">{it.note}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
