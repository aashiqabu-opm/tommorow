'use client'

import { useState } from 'react'

const inputCls = 'w-full bg-[#13131a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#5a5a7a] focus:outline-none focus:ring-2 focus:ring-white/30'

interface Props {
  kind: 'line_production' | 'contact' | 'casting' | 'general'
  source: string
  showCompany?: boolean
}

export function PublicInquiryForm({ kind, source, showCompany }: Props) {
  const [f, setF] = useState({ name: '', email: '', phone: '', company: '', subject: '', message: '' })
  const [website, setWebsite] = useState('') // honeypot
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.name.trim()) { setStatus('error'); return }
    setStatus('sending')
    try {
      const res = await fetch('/api/public/inquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, source, website, ...f }),
      })
      setStatus(res.ok ? 'done' : 'error')
    } catch { setStatus('error') }
  }

  if (status === 'done') {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-300">
        Thanks — your message has reached the OPM team. We'll be in touch.
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* honeypot — hidden from humans */}
      <input type="text" name="website" value={website} onChange={e => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid sm:grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Your name *" value={f.name} onChange={set('name')} required />
        <input className={inputCls} placeholder="Email" type="email" value={f.email} onChange={set('email')} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <input className={inputCls} placeholder="Phone" value={f.phone} onChange={set('phone')} />
        {showCompany && <input className={inputCls} placeholder="Company / production" value={f.company} onChange={set('company')} />}
      </div>
      <input className={inputCls} placeholder="Subject" value={f.subject} onChange={set('subject')} />
      <textarea className={inputCls} rows={5} placeholder="Message" value={f.message} onChange={set('message')} />
      {status === 'error' && <p className="text-xs text-red-400">Please enter your name and try again.</p>}
      <button type="submit" disabled={status === 'sending'} className="bg-white text-black rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
        {status === 'sending' ? 'Sending…' : 'Send'}
      </button>
    </form>
  )
}
