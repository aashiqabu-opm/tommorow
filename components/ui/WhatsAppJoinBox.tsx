'use client'

import { useState } from 'react'
import { MessageCircle, Copy, Check, ExternalLink } from 'lucide-react'
import { SANDBOX_ACTIVE, SANDBOX_NUMBER, SANDBOX_JOIN_CODE, SANDBOX_WA_LINK } from '@/lib/alerts/sandbox'

// Shows the one-time sandbox-join steps so a staff member can switch on
// WhatsApp alerts without anyone explaining it. Renders nothing once the
// account moves to a production sender (SANDBOX_ACTIVE = false).
export function WhatsAppJoinBox() {
  const [copied, setCopied] = useState(false)
  if (!SANDBOX_ACTIVE) return null

  function copyCode() {
    navigator.clipboard?.writeText(SANDBOX_JOIN_CODE).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  return (
    <div className="bg-[#1a1a24] border border-emerald-500/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
        <MessageCircle size={15} /> One-time WhatsApp setup
      </div>
      <p className="text-xs text-[#c8c8da] leading-relaxed">
        To receive WhatsApp alerts, send the message <span className="font-semibold text-white">{SANDBOX_JOIN_CODE}</span> to{' '}
        <span className="font-semibold text-white">{SANDBOX_NUMBER}</span> from your WhatsApp. You&apos;ll get a
        &ldquo;You are all set&rdquo; reply — then alerts start arriving.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={SANDBOX_WA_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-black bg-emerald-400 hover:bg-emerald-300 rounded-lg px-3 py-1.5"
        >
          <ExternalLink size={12} /> Open WhatsApp with code ready
        </a>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#c8c8da] border border-[#2a2a3a] hover:bg-white/5 rounded-lg px-3 py-1.5"
        >
          {copied ? <><Check size={12} className="text-emerald-400" /> Copied</> : <><Copy size={12} /> Copy code</>}
        </button>
      </div>
      <p className="text-[11px] text-[#5a5a7a]">
        Tip: keep the number saved as a contact. The free sandbox re-opens its 24-hour window each time you reply to it.
      </p>
    </div>
  )
}
