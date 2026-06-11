'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageCircle, X } from 'lucide-react'

// Shown to any signed-in user who hasn't added a WhatsApp number yet.
// Dismissal lasts for the browser session.
export function WhatsAppNudge() {
  const [hidden, setHidden] = useState(() =>
    typeof sessionStorage !== 'undefined' && Boolean(sessionStorage.getItem('opm_wa_nudge_dismissed'))
  )
  if (hidden) return null

  function dismiss() {
    try { sessionStorage.setItem('opm_wa_nudge_dismissed', '1') } catch { /* private mode */ }
    setHidden(true)
  }

  return (
    <div className="mx-4 lg:mx-6 mt-4 flex items-center gap-3 bg-[#13131a] border border-emerald-500/30 rounded-xl px-4 py-3">
      <MessageCircle size={16} className="text-emerald-400 shrink-0" />
      <p className="text-xs text-[#c8c8da] flex-1">
        Add your WhatsApp number to get urgent alerts — approvals, rejections and overdue dues — straight to your phone.
      </p>
      <Link
        href="/settings"
        className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 shrink-0"
      >
        Add number
      </Link>
      <button onClick={dismiss} aria-label="Dismiss" className="text-[#5a5a7a] hover:text-white shrink-0">
        <X size={14} />
      </button>
    </div>
  )
}
