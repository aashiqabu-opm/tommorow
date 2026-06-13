import { createClient } from '@/lib/supabase/server'
import { FinanceControlsClient } from './FinanceControlsClient'

// Server wrapper: reads the lock date, AI cap and this-month usage, then hands
// them to the client editor. Finance roles only.
export async function FinanceControls({ role }: { role: string }) {
  if (!['founder', 'accountant'].includes(role)) return null
  const supabase = await createClient()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [{ data: settings }, { count }] = await Promise.all([
    supabase.from('app_settings').select('key, value').in('key', ['books_locked_through', 'ai_monthly_cap', 'tally_bank_ledger', 'tally_gst_split', 'tally_tds_ledger']),
    supabase.from('ai_usage').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
  ])
  const byKey = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]))

  return (
    <FinanceControlsClient
      lockedThrough={byKey['books_locked_through'] ?? ''}
      aiCap={byKey['ai_monthly_cap'] ?? ''}
      aiUsed={count ?? 0}
      bankLedger={byKey['tally_bank_ledger'] ?? 'Cash'}
      gstSplit={byKey['tally_gst_split'] ?? 'cgst_sgst'}
      tdsLedger={byKey['tally_tds_ledger'] ?? 'TDS Payable'}
      canEdit={role === 'founder'}
    />
  )
}
