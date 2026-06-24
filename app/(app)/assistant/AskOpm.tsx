'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type Msg = { role: 'user' | 'assistant'; content: string }

const SUGGESTIONS = [
  "What's our cash position?",
  'Which payments are awaiting approval?',
  'How is each project tracking against budget?',
  'What contract dates are coming up?',
]

// Minimal, dependency-free markdown: bold, headings, bullet lists, tables → HTML.
// The assistant replies in light markdown; render it readably without a library.
function renderMarkdown(src: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const lines = src.split('\n')
  const out: string[] = []
  let i = 0
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
  while (i < lines.length) {
    const line = lines[i]
    // Table block
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[-:\s|]+\|\s*$/.test(lines[i + 1])) {
      const header = line.split('|').slice(1, -1).map(c => c.trim())
      i += 2
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()))
        i++
      }
      out.push(
        '<table class="w-full text-sm my-2 border-collapse">' +
          '<thead><tr>' + header.map(h => `<th class="text-left font-semibold text-[#aaaacc] border-b border-[#2a2a3a] py-1.5 pr-3">${inline(h)}</th>`).join('') + '</tr></thead>' +
          '<tbody>' + rows.map(r => '<tr>' + r.map(c => `<td class="py-1.5 pr-3 border-b border-[#1f1f2a] text-white/90">${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody>' +
          '</table>',
      )
      continue
    }
    if (/^#{1,3}\s/.test(line)) {
      out.push(`<div class="font-semibold text-white mt-2 mb-1">${inline(line.replace(/^#{1,3}\s/, ''))}</div>`)
      i++
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`)
        i++
      }
      out.push(`<ul class="list-disc pl-5 space-y-0.5 my-1">${items.join('')}</ul>`)
      continue
    }
    if (line.trim() === '') { out.push('<div class="h-2"></div>'); i++; continue }
    out.push(`<p class="my-0.5">${inline(line)}</p>`)
    i++
  }
  return out.join('')
}

export function AskOpm() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function send(text: string) {
    const q = text.trim()
    if (!q || loading) return
    setError(null)
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
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
      } else {
        setMessages([...next, { role: 'assistant', content: data.answer }])
      }
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)] max-w-3xl">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/5 border border-white/10 mb-4">
              <Sparkles size={22} className="text-[#D6B16F]" />
            </div>
            <p className="text-[#8888aa] text-sm mb-5">Ask anything about OPM Cinemas — finances, projects, contracts, production. I only see what your role is allowed to see.</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-sm text-white/90 px-3 py-2.5 rounded-lg bg-[#13131a] border border-[#2a2a3a] hover:border-white/20 hover:bg-[#1a1a24] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, idx) => (
          <div key={idx} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'rounded-2xl px-4 py-2.5 max-w-[85%] text-sm',
                m.role === 'user'
                  ? 'bg-white/10 text-white border border-white/15'
                  : 'bg-[#13131a] text-white/90 border border-[#2a2a3a]',
              )}
            >
              {m.role === 'assistant'
                ? <div className="leading-relaxed" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                : m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 bg-[#13131a] border border-[#2a2a3a] text-[#8888aa] flex items-center gap-2 text-sm">
              <Loader2 size={15} className="animate-spin" /> Thinking…
            </div>
          </div>
        )}
        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input) }}
        className="mt-3 flex items-end gap-2 border-t border-[#2a2a3a] pt-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
          placeholder="Ask about cash, projects, contracts…"
          rows={1}
          className="flex-1 resize-none bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#5a5a7a] focus:outline-none focus:border-white/25 max-h-32"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="shrink-0 h-11 w-11 flex items-center justify-center rounded-xl bg-white/10 border border-white/15 text-white hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        </button>
      </form>
    </div>
  )
}
