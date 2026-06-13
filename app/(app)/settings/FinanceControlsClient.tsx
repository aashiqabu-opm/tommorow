'use client'

import { useState } from 'react'
import { Lock, Unlock, Sparkles, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface Props { lockedThrough: string; aiCap: string; aiUsed: number; canEdit: boolean }

export function FinanceControlsClient({ lockedThrough, aiCap, aiUsed, canEdit }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [lockDate, setLockDate] = useState(lockedThrough)
  const [cap, setCap] = useState(aiCap)
  const [busy, setBusy] = useState('')

  async function setSetting(key: string, value: string, label: string) {
    setBusy(key)
    const supabase = createClient()
    const { error } = await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) {
      const hint = /relation .*app_settings.* does not exist/i.test(error.message) ? 'run migration-hardening.sql first' : 'founder only'
      toast.error(`Couldn't save — ${hint}`); setBusy(''); return
    }
    await logAction('update', 'app_settings', key, undefined, { value })
    toast.success(label)
    setBusy(''); router.refresh()
  }

  const capNum = parseInt(cap) || 0
  const pct = capNum > 0 ? Math.min(Math.round((aiUsed / capNum) * 100), 100) : 0

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Month-end period lock */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1">
          {lockedThrough ? <Lock size={15} className="text-amber-400" /> : <Unlock size={15} className="text-white/60" />}
          <h3 className="text-sm font-semibold text-white">Month-end Lock</h3>
        </div>
        <p className="text-xs text-[#8888aa] leading-relaxed mb-3">
          Close the books through a date so no one can add, edit or delete entries in that period. Income, cash and vouchers are protected at the database level.
        </p>
        {lockedThrough && (
          <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-3">
            Books are locked through <span className="font-semibold">{formatDate(lockedThrough)}</span>.
          </div>
        )}
        {canEdit ? (
          <div className="space-y-2">
            <Input type="date" value={lockDate} onChange={e => setLockDate(e.target.value)} label="Lock books through" />
            <div className="flex gap-2">
              <Button size="sm" icon={Lock} loading={busy === 'books_locked_through'} onClick={() => setSetting('books_locked_through', lockDate, lockDate ? `Books locked through ${formatDate(lockDate)}` : 'Cleared')} disabled={!lockDate}>Lock</Button>
              {lockedThrough && <Button size="sm" variant="secondary" icon={Unlock} onClick={() => { setLockDate(''); setSetting('books_locked_through', '', 'Books unlocked') }}>Unlock</Button>}
            </div>
          </div>
        ) : <p className="text-[11px] text-[#5a5a7a]">Only the founder can change the lock.</p>}
      </div>

      {/* AI monthly usage / cap */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-1"><Sparkles size={15} className="text-white/60" /><h3 className="text-sm font-semibold text-white">AI Usage This Month</h3></div>
        <p className="text-xs text-[#8888aa] leading-relaxed mb-3">Caps AI calls per month so spend stays predictable. Leave the cap blank for no limit.</p>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold text-white tabular-nums">{aiUsed}</span>
          <span className="text-sm text-[#8888aa]">calls{capNum > 0 ? ` / ${capNum}` : ' this month'}</span>
        </div>
        {capNum > 0 && (
          <div className="h-1.5 bg-[#1a1a24] rounded-full overflow-hidden mb-3">
            <div className={`h-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
          </div>
        )}
        {pct >= 100 && <div className="text-[11px] text-red-400 flex items-center gap-1 mb-3"><AlertCircle size={12} /> Cap reached — AI calls are blocked until you raise it.</div>}
        {canEdit ? (
          <div className="flex gap-2 items-end">
            <Input type="number" value={cap} onChange={e => setCap(e.target.value)} label="Monthly cap (calls)" placeholder="no limit" />
            <Button size="sm" loading={busy === 'ai_monthly_cap'} onClick={() => setSetting('ai_monthly_cap', cap, cap ? `Cap set to ${cap}` : 'Cap removed')}>Save</Button>
          </div>
        ) : <p className="text-[11px] text-[#5a5a7a]">Only the founder can change the cap.</p>}
      </div>
    </div>
  )
}
