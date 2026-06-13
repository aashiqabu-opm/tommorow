import { AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

// Shows an app-wide banner when AI is paused (most often: Anthropic credits
// exhausted). The flag is set by server routes when an AI call fails with a
// billing error, and cleared on the next successful call. Stale flags (>48h)
// are ignored so it never lingers if the clear didn't fire.
export async function AiHealthBanner() {
  const supabase = await createClient()
  const { data } = await supabase.from('system_status').select('message, detail, updated_at').eq('key', 'ai_credit').maybeSingle()
  if (!data) return null
  const ageHrs = (Date.now() - new Date(data.updated_at as string).getTime()) / 3_600_000
  if (ageHrs > 48) return null

  return (
    <div className="mx-4 lg:mx-6 mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-start gap-3">
      <AlertTriangle size={16} className="text-amber-400 mt-0.5 shrink-0" />
      <div className="text-xs leading-relaxed">
        <span className="text-amber-300 font-medium">{data.message ?? 'AI features are paused.'}</span>
        {data.detail && <span className="text-[#c8c8da]"> {data.detail}</span>}
      </div>
    </div>
  )
}
