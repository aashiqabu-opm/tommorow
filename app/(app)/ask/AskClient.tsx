'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, User } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'

interface Msg { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  "What's our cash position right now?",
  'What payments are awaiting my approval?',
  'Which liabilities are overdue?',
  "How is Aja Sundari doing financially?",
  'What revenue is still receivable?',
]

export function AskClient({ firstName }: { firstName: string }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

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
    <div className="space-y-4 max-w-3xl mx-auto">
      <PageHeader title="Ask OPM" subtitle="Ask anything about your finances — read-only, never changes data" />

      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl flex flex-col" style={{ height: 'calc(100vh - 230px)', minHeight: 380 }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 px-4">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
                <Sparkles size={22} className="text-white/70" />
              </div>
              <div>
                <p className="text-sm text-white font-medium">Hi {firstName} — ask me about the books.</p>
                <p className="text-xs text-[#8888aa] mt-1">I read your live data and answer in plain English. I can&apos;t change anything.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => send(s)}
                    className="text-xs text-[#c8c8da] bg-[#1a1a24] border border-[#2a2a3a] hover:border-white/30 rounded-full px-3 py-1.5">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                  <Sparkles size={14} className="text-white/70" />
                </div>
              )}
              <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed max-w-[80%] ${
                m.role === 'user' ? 'bg-white text-black' : 'bg-[#1a1a24] text-[#e8e8f0] border border-[#2a2a3a]'
              }`}>
                {m.content}
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <User size={14} className="text-white/70" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                <Sparkles size={14} className="text-white/70 animate-pulse" />
              </div>
              <div className="rounded-2xl px-4 py-2.5 bg-[#1a1a24] border border-[#2a2a3a] text-sm text-[#8888aa]">
                Reading the books…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={e => { e.preventDefault(); send(input) }}
          className="border-t border-[#2a2a3a] p-3 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about cash, payments, liabilities, a film's P&L…"
            className="flex-1 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-white/40"
          />
          <button type="submit" disabled={loading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center disabled:opacity-40 shrink-0">
            <Send size={16} />
          </button>
        </form>
      </div>
      <p className="text-[11px] text-[#5a5a7a] text-center">Ask OPM reads live data and can make mistakes — verify anything important against the source page.</p>
    </div>
  )
}
