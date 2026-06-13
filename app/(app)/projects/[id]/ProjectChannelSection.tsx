'use client'

import { useState } from 'react'
import { MessagesSquare, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import type { ProjectMessage } from '@/lib/types'
import { useRouter } from 'next/navigation'

const ROLE_LABELS: Record<string, string> = {
  founder: 'Founder', accountant: 'Accountant', general_manager: 'GM',
  executive_producer: 'EP', legal_viewer: 'Legal', staff: 'Crew',
}

interface Props {
  projectId: string
  messages: ProjectMessage[]
  userId: string
  role: string
  canPost: boolean
}

function when(ts: string): string {
  const d = new Date(ts)
  const today = new Date().toDateString() === d.toDateString()
  return today ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : `${formatDate(ts)} ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`
}

export function ProjectChannelSection({ projectId, messages, userId, role, canPost }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    const supabase = createClient()
    const { error } = await supabase.from('project_messages').insert({ project_id: projectId, author_id: userId, body: body.trim() })
    if (error) {
      toast.error(/relation .*project_messages.* does not exist/i.test(error.message) ? 'run migration-crew-teams.sql first' : "Couldn't send")
      setSending(false); return
    }
    setBody(''); setSending(false); router.refresh()
  }

  async function remove(m: ProjectMessage) {
    const supabase = createClient()
    await supabase.from('project_messages').delete().eq('id', m.id)
    router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center gap-2">
        <MessagesSquare size={16} className="text-white/70" />
        <h3 className="text-sm font-semibold text-white">Team Channel</h3>
        <span className="text-xs text-[#8888aa]">· project communication</span>
      </div>

      <div className="max-h-96 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="py-6 text-center text-sm text-[#8888aa]">No messages yet. Say hello to the team.</div>
        ) : messages.map(m => {
          const mine = m.author_id === userId
          return (
            <div key={m.id} className={`flex gap-2.5 group ${mine ? 'flex-row-reverse' : ''}`}>
              <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {(m.author?.full_name ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className={`min-w-0 max-w-[78%] ${mine ? 'items-end text-right' : ''}`}>
                <div className="flex items-center gap-2 mb-0.5 text-[11px] text-[#8888aa]">
                  <span className="text-white/90 font-medium">{m.author?.full_name ?? 'Unknown'}</span>
                  <span className="text-[9px] uppercase tracking-wide">{ROLE_LABELS[m.author?.role ?? ''] ?? ''}</span>
                  <span>· {when(m.created_at)}</span>
                  {(mine || role === 'founder') && <button onClick={() => remove(m)} className="opacity-0 group-hover:opacity-100 text-[#5a5a7a] hover:text-red-400"><Trash2 size={11} /></button>}
                </div>
                <div className={`inline-block text-sm text-[#e8e8f0] rounded-2xl px-3 py-2 whitespace-pre-wrap break-words ${mine ? 'bg-indigo-500/20 border border-indigo-500/20' : 'bg-[#1a1a24] border border-[#2a2a3a]'}`}>
                  {m.body}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {canPost && (
        <form onSubmit={send} className="px-5 py-3 border-t border-[#2a2a3a] flex gap-2">
          <input value={body} onChange={e => setBody(e.target.value)} placeholder="Message the team…"
            className="flex-1 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/40" />
          <Button type="submit" loading={sending} icon={Send}>Send</Button>
        </form>
      )}
    </div>
  )
}
