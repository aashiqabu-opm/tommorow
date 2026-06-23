'use client'

import { useEffect, useState } from 'react'

const inputCls = 'w-full bg-[#13131a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#5a5a7a] focus:outline-none focus:ring-2 focus:ring-white/30'
const TYPE_LABEL: Record<string, string> = { permanent: 'Permanent', project: 'Project', freelance: 'Freelance' }

interface Position { id: string; title: string; department: string | null; type: string; description: string | null }

export function CareersClient() {
  const [positions, setPositions] = useState<Position[] | null>(null)
  const [applyFor, setApplyFor] = useState<Position | null>(null)

  useEffect(() => {
    fetch('/api/public/positions').then(r => r.json()).then(d => setPositions(d.positions ?? [])).catch(() => setPositions([]))
  }, [])

  if (positions === null) return <p className="text-sm text-[#8888aa]">Loading open roles…</p>
  if (positions.length === 0) return <p className="text-sm text-[#8888aa]">No open positions right now. Check back soon, or use the Contact page.</p>

  return (
    <div className="space-y-3">
      {positions.map(p => (
        <div key={p.id} className="rounded-xl border border-[#2a2a3a] bg-[#13131a] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white">{p.title}</span>
                {p.department && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[#8888aa]">{p.department}</span>}
                <span className="text-[10px] uppercase tracking-wide text-[#8888aa]">{TYPE_LABEL[p.type] ?? p.type}</span>
              </div>
              {p.description && <p className="text-xs text-[#8888aa] mt-1 whitespace-pre-wrap">{p.description}</p>}
            </div>
            <button onClick={() => setApplyFor(p)} className="bg-white text-black rounded-lg px-3 py-1.5 text-xs font-medium shrink-0">Apply</button>
          </div>
        </div>
      ))}
      {applyFor && <ApplyModal position={applyFor} onClose={() => setApplyFor(null)} />}
    </div>
  )
}

function ApplyModal({ position, onClose }: { position: Position; onClose: () => void }) {
  const [f, setF] = useState({ applicant_name: '', email: '', phone: '', portfolio_url: '', cover_note: '' })
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.applicant_name.trim()) { setStatus('error'); return }
    setStatus('sending')
    try {
      const res = await fetch('/api/public/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_id: position.id, website, ...f }),
      })
      setStatus(res.ok ? 'done' : 'error')
    } catch { setStatus('error') }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-semibold text-white mb-1">Apply — {position.title}</h2>
        {status === 'done' ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300 mt-3">Application received. Thank you!</div>
        ) : (
          <form onSubmit={submit} className="space-y-3 mt-3">
            <input type="text" value={website} onChange={e => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <input className={inputCls} placeholder="Your name *" value={f.applicant_name} onChange={set('applicant_name')} required />
            <div className="grid grid-cols-2 gap-3">
              <input className={inputCls} placeholder="Email" type="email" value={f.email} onChange={set('email')} />
              <input className={inputCls} placeholder="Phone" value={f.phone} onChange={set('phone')} />
            </div>
            <input className={inputCls} placeholder="Portfolio / showreel URL" value={f.portfolio_url} onChange={set('portfolio_url')} />
            <textarea className={inputCls} rows={4} placeholder="Cover note" value={f.cover_note} onChange={set('cover_note')} />
            {status === 'error' && <p className="text-xs text-red-400">Please enter your name and try again.</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="text-sm text-[#8888aa] px-3 py-2">Cancel</button>
              <button type="submit" disabled={status === 'sending'} className="bg-white text-black rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{status === 'sending' ? 'Sending…' : 'Submit'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
