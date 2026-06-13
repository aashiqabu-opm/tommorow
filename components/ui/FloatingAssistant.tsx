'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, User, X } from 'lucide-react'

interface Msg { role: 'user' | 'assistant'; content: string }

const FINANCE_SUGGESTIONS = [
  "What's our cash position?",
  'Payments awaiting my approval?',
  'Which liabilities are overdue?',
  'What revenue is still receivable?',
]
const STAFF_SUGGESTIONS = [
  'What payment requests are pending?',
  'Which projects are active?',
  'Payments for Aja Sundari?',
  'Has my bill been approved?',
]

// App-wide floating chat. Read-only — talks to /api/assistant.
export function FloatingAssistant({ firstName, finance }: { firstName: string; finance: boolean }) {
  const SUGGESTIONS = finance ? FINANCE_SUGGESTIONS : STAFF_SUGGESTIONS
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading, open])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])

  async function send(text: string) {
    const q = text.trim()
    if (!q || loading) return
    const next = [...messages, { role: 'user' as const, content: q }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await res.json().catch(() => ({}))
      const answer = res.ok
        ? (data.answer ?? 'No answer.')
        : data.error === 'not_configured'
          ? 'The assistant isn’t configured yet (ANTHROPIC_API_KEY).'
          : (data.error ?? 'Something went wrong — try again.')
      setMessages(m => [...m, { role: 'assistant', content: answer }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Network error — please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Launcher button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Ask OPM"
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-white text-black shadow-lg shadow-black/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </button>

      {/* Pop-out panel */}
      {open && (
        <div
          className="fixed z-50 bg-[#13131a] border border-[#2a2a3a] rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
          style={{
            bottom: 'calc(5rem + 12px)',
            right: '1.25rem',
            width: 'min(384px, calc(100vw - 2rem))',
            height: 'min(560px, calc(100vh - 9rem))',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2a2a3a] shrink-0">
            <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center">
              <Sparkles size={15} className="text-white/70" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white leading-none">Ask OPM</div>
              <div className="text-[10px] text-[#8888aa] mt-0.5">Read-only · never changes data</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-[#8888aa] hover:text-white">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-2">
                <p className="text-sm text-white font-medium">Hi {firstName} 👋</p>
                <p className="text-xs text-[#8888aa]">Ask me anything about the books. I read your live data and answer in plain English.</p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="text-[11px] text-[#c8c8da] bg-[#1a1a24] border border-[#2a2a3a] hover:border-white/30 rounded-full px-2.5 py-1">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                    <Sparkles size={12} className="text-white/70" />
                  </div>
                )}
                <div className={`rounded-2xl px-3 py-2 text-[13px] whitespace-pre-wrap leading-relaxed max-w-[82%] ${
                  m.role === 'user' ? 'bg-white text-black' : 'bg-[#1a1a24] text-[#e8e8f0] border border-[#2a2a3a]'
                }`}>
                  {m.content}
                </div>
                {m.role === 'user' && (
                  <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                    <User size={12} className="text-white/70" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <Sparkles size={12} className="text-white/70 animate-pulse" />
                </div>
                <div className="rounded-2xl px-3 py-2 bg-[#1a1a24] border border-[#2a2a3a] text-[13px] text-[#8888aa]">
                  Reading the books…
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <form onSubmit={e => { e.preventDefault(); send(input) }} className="border-t border-[#2a2a3a] p-2.5 flex items-center gap-2 shrink-0">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about cash, payments, a film…"
              className="flex-1 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl px-3 py-2 text-[13px] text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-white/40"
            />
            <button type="submit" disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center disabled:opacity-40 shrink-0">
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
