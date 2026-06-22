'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Scissors, PackageCheck, FileSignature, Plus, Trash2, Pencil, Copy, HardDrive } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

/* eslint-disable @typescript-eslint/no-explicit-any */
type SB = ReturnType<typeof createClient>
type Toast = ReturnType<typeof useToast>

interface PostTask { id: string; stage: string; title: string; status: string; owner?: string | null; due_date?: string | null }
interface Deliv { id: string; item: string; target: string; status: string; due_date?: string | null; notes?: string | null }
interface Memo { id: string; party_name: string; party_kind: string; role_title?: string | null; fee?: number | null; advance?: number | null; tds_percent?: number | null; terms?: string | null; status: string }

const STAGES: [string, string][] = [['edit', 'Edit'], ['di', 'DI / Colour'], ['sound_design', 'Sound Design'], ['mix', 'Mix'], ['vfx', 'VFX'], ['songs', 'Songs'], ['bgm', 'BGM'], ['dubbing', 'Dubbing'], ['final_mix', 'Final Mix'], ['censor', 'CBFC Censor'], ['other', 'Other']]
const STAGE_LABEL = Object.fromEntries(STAGES)
const POST_STATUS = ['not_started', 'in_progress', 'review', 'done']
const badge = (s: string) => <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/5 text-[#8888aa]">{s.replace(/_/g, ' ')}</span>
function Empty({ t }: { t: string }) { return <div className="text-center text-sm text-[#8888aa] bg-[#1a1a24] border border-dashed border-[#2a2a3a] rounded-lg py-8 px-4">{t}</div> }

export function PostModule({ projectId, canEditPost, canEditDeliv }: { projectId: string; canEditPost: boolean; canEditDeliv: boolean }) {
  const toast = useToast(); const supabase = createClient()
  const [view, setView] = useState<'pipeline' | 'deliverables' | 'memos'>('pipeline')
  const [tasks, setTasks] = useState<PostTask[]>([]); const [delivs, setDelivs] = useState<Deliv[]>([]); const [memos, setMemos] = useState<Memo[]>([])

  const load = useCallback(async () => {
    const [t, d, m] = await Promise.all([
      supabase.from('project_post_tasks').select('*').eq('project_id', projectId).order('sort_order'),
      supabase.from('project_deliverables').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('project_deal_memos').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
    ])
    setTasks((t.data ?? []) as PostTask[]); setDelivs((d.data ?? []) as Deliv[]); setMemos((m.data ?? []) as Memo[])
  }, [projectId, supabase])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {([['pipeline', 'Post Pipeline', Scissors], ['deliverables', 'Deliverables', PackageCheck], ['memos', 'Deal Memos', FileSignature]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setView(id)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg ${view === id ? 'bg-white/10 text-white' : 'text-[#8888aa] hover:text-white'}`}><Icon size={13} /> {label}</button>
        ))}
        <Link href={`/projects/${projectId}/media`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-[#8888aa] hover:text-white"><HardDrive size={13} /> Media Assets</Link>
      </div>
      {view === 'pipeline' && <Pipeline {...{ projectId, canEdit: canEditPost, rows: tasks, onChange: load, supabase, toast }} />}
      {view === 'deliverables' && <Deliverables {...{ projectId, canEdit: canEditDeliv, rows: delivs, onChange: load, supabase, toast }} />}
      {view === 'memos' && <Memos {...{ projectId, canEdit: canEditDeliv, rows: memos, onChange: load, supabase, toast }} />}
    </div>
  )
}

function Pipeline({ projectId, canEdit, rows, onChange, supabase, toast }: any) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<any>({ stage: 'edit', title: '', owner: '', due_date: '' })
  async function seed() {
    const have = new Set(rows.map((r: PostTask) => r.stage))
    const toAdd = STAGES.filter(([s]) => s !== 'other' && !have.has(s)).map(([s, label], i) => ({ project_id: projectId, stage: s, title: label, sort_order: i }))
    if (!toAdd.length) { toast.success('All stages already present'); return }
    const { error } = await supabase.from('project_post_tasks').insert(toAdd)
    if (error) { toast.error("Couldn't seed"); return }
    toast.success(`${toAdd.length} post stages added`); onChange()
  }
  async function save() {
    if (!f.title) { toast.error('Title required'); return }
    const { error } = await supabase.from('project_post_tasks').insert({ project_id: projectId, stage: f.stage, title: f.title, owner: f.owner || null, due_date: f.due_date || null })
    if (error) { toast.error("Couldn't save"); return }
    setOpen(false); setF({ stage: 'edit', title: '', owner: '', due_date: '' }); toast.success('Added'); onChange()
  }
  async function setStatus(r: PostTask, status: string) { await supabase.from('project_post_tasks').update({ status }).eq('id', r.id); onChange() }
  async function del(r: PostTask) { if (!confirm('Delete?')) return; await supabase.from('project_post_tasks').delete().eq('id', r.id); onChange() }
  const done = rows.filter((r: PostTask) => r.status === 'done').length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-[#8888aa]">{rows.length ? `${done}/${rows.length} stages done` : 'Track edit → DI → sound → VFX → songs → dubbing → censor.'}</p>
        {canEdit && <div className="flex gap-2"><Button variant="ghost" onClick={seed}>Seed standard stages</Button><Button icon={Plus} onClick={() => setOpen(true)}>Add</Button></div>}
      </div>
      {rows.length === 0 ? <Empty t="No post-production tasks yet. 'Seed standard stages' to start the pipeline." /> : (
        <div className="space-y-2">{rows.map((r: PostTask) => (
          <div key={r.id} className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3">
            <div className="min-w-0"><div className="text-sm text-white font-medium flex items-center gap-2">{badge(STAGE_LABEL[r.stage] ?? r.stage)} {r.title}</div>
              <div className="text-xs text-[#8888aa] mt-0.5">{[r.owner, r.due_date ? `due ${formatDate(r.due_date)}` : ''].filter(Boolean).join(' · ') || '—'}</div></div>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit ? <select value={r.status} onChange={e => setStatus(r, e.target.value)} className="bg-[#13131a] border border-[#2a2a3a] rounded text-xs text-white px-1.5 py-1">{POST_STATUS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select> : badge(r.status)}
              {canEdit && <button onClick={() => del(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>}
            </div>
          </div>))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add post task">
        <div className="space-y-3">
          <Select label="Stage" value={f.stage} onChange={e => setF({ ...f, stage: e.target.value })} options={STAGES.map(([v, l]) => ({ value: v, label: l }))} />
          <Input label="Title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-3"><Input label="Owner" value={f.owner} onChange={e => setF({ ...f, owner: e.target.value })} /><Input label="Due date" type="date" value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}

const DELIV_TARGETS = [['theatrical', 'Theatrical'], ['satellite', 'Satellite'], ['ott', 'OTT'], ['audio', 'Audio'], ['censor', 'Censor'], ['general', 'General']]
const STANDARD_DELIV = [
  { item: 'DCP', target: 'theatrical' }, { item: 'KDM', target: 'theatrical' },
  { item: 'CBFC censor certificate', target: 'censor' },
  { item: 'Satellite master (M&E + textless)', target: 'satellite' }, { item: 'Subtitles (SRT)', target: 'satellite' },
  { item: 'OTT mezzanine + spec sheet', target: 'ott' }, { item: 'Artwork / metadata', target: 'ott' },
  { item: 'Audio / music masters', target: 'audio' },
]
function Deliverables({ projectId, canEdit, rows, onChange, supabase, toast }: any) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<any>({ item: '', target: 'theatrical', due_date: '', notes: '' })
  async function seed() {
    const have = new Set(rows.map((r: Deliv) => r.item.toLowerCase()))
    const toAdd = STANDARD_DELIV.filter(d => !have.has(d.item.toLowerCase())).map(d => ({ project_id: projectId, item: d.item, target: d.target }))
    if (!toAdd.length) { toast.success('Already added'); return }
    const { error } = await supabase.from('project_deliverables').insert(toAdd)
    if (error) { toast.error("Couldn't seed"); return }
    toast.success(`${toAdd.length} deliverables added`); onChange()
  }
  async function save() {
    if (!f.item) { toast.error('Item required'); return }
    const { error } = await supabase.from('project_deliverables').insert({ project_id: projectId, item: f.item, target: f.target, due_date: f.due_date || null, notes: f.notes || null })
    if (error) { toast.error("Couldn't save"); return }
    setOpen(false); setF({ item: '', target: 'theatrical', due_date: '', notes: '' }); toast.success('Added'); onChange()
  }
  async function setStatus(r: Deliv, status: string) { await supabase.from('project_deliverables').update({ status }).eq('id', r.id); onChange() }
  async function del(r: Deliv) { if (!confirm('Delete?')) return; await supabase.from('project_deliverables').delete().eq('id', r.id); onChange() }
  const delivered = rows.filter((r: Deliv) => r.status === 'delivered').length

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-[#8888aa]">{rows.length ? `${delivered}/${rows.length} delivered` : 'DCP/KDM, censor cert, satellite M&E, OTT specs, audio masters.'}</p>
        {canEdit && <div className="flex gap-2"><Button variant="ghost" onClick={seed}>Seed standard list</Button><Button icon={Plus} onClick={() => setOpen(true)}>Add</Button></div>}
      </div>
      {rows.length === 0 ? <Empty t="No deliverables yet. 'Seed standard list' for the usual theatrical/satellite/OTT/censor items." /> : (
        <div className="space-y-2">{rows.map((r: Deliv) => (
          <div key={r.id} className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3">
            <div className="min-w-0"><div className="text-sm text-white font-medium flex items-center gap-2">{r.item} {badge(r.target)}</div>
              <div className="text-xs text-[#8888aa] mt-0.5">{[r.due_date ? `due ${formatDate(r.due_date)}` : '', r.notes].filter(Boolean).join(' · ') || '—'}</div></div>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit ? <select value={r.status} onChange={e => setStatus(r, e.target.value)} className="bg-[#13131a] border border-[#2a2a3a] rounded text-xs text-white px-1.5 py-1">{['pending', 'in_progress', 'delivered'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select> : badge(r.status)}
              {canEdit && <button onClick={() => del(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>}
            </div>
          </div>))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add deliverable">
        <div className="space-y-3">
          <Input label="Item" value={f.item} onChange={e => setF({ ...f, item: e.target.value })} />
          <Select label="Target" value={f.target} onChange={e => setF({ ...f, target: e.target.value })} options={DELIV_TARGETS.map(([v, l]) => ({ value: v, label: l }))} />
          <Input label="Due date" type="date" value={f.due_date} onChange={e => setF({ ...f, due_date: e.target.value })} />
          <Textarea label="Notes" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}

function Memos({ projectId, canEdit, rows, onChange, supabase, toast }: any) {
  const [open, setOpen] = useState(false); const [ed, setEd] = useState<Memo | null>(null)
  const [f, setF] = useState<any>({ party_name: '', party_kind: 'crew', role_title: '', fee: '', advance: '', tds_percent: '', terms: '', status: 'draft' })
  function openNew() { setEd(null); setF({ party_name: '', party_kind: 'crew', role_title: '', fee: '', advance: '', tds_percent: '', terms: '', status: 'draft' }); setOpen(true) }
  function openEd(r: Memo) { setEd(r); setF({ party_name: r.party_name, party_kind: r.party_kind, role_title: r.role_title ?? '', fee: r.fee ?? '', advance: r.advance ?? '', tds_percent: r.tds_percent ?? '', terms: r.terms ?? '', status: r.status }); setOpen(true) }
  async function save() {
    if (!f.party_name) { toast.error('Name required'); return }
    const p = { party_name: f.party_name, party_kind: f.party_kind, role_title: f.role_title || null, fee: f.fee ? Number(f.fee) : null, advance: f.advance ? Number(f.advance) : null, tds_percent: f.tds_percent ? Number(f.tds_percent) : null, terms: f.terms || null, status: f.status }
    const { error } = ed ? await supabase.from('project_deal_memos').update(p).eq('id', ed.id) : await supabase.from('project_deal_memos').insert({ ...p, project_id: projectId })
    if (error) { toast.error("Couldn't save"); return }
    setOpen(false); toast.success('Saved'); onChange()
  }
  async function setStatus(r: Memo, status: string) { await supabase.from('project_deal_memos').update({ status }).eq('id', r.id); onChange() }
  async function del(r: Memo) { if (!confirm('Delete?')) return; await supabase.from('project_deal_memos').delete().eq('id', r.id); onChange() }
  function copyMemo(r: Memo) {
    const t = `DEAL MEMO\n\nParty: ${r.party_name}${r.role_title ? ` (${r.role_title})` : ''}\nEngagement: ${r.party_kind}\nFee: ${r.fee ? formatCurrency(Number(r.fee)) : '—'}\nAdvance: ${r.advance ? formatCurrency(Number(r.advance)) : '—'}\nTDS: ${r.tds_percent ? r.tds_percent + '%' : '—'}\n\nTerms:\n${r.terms || '—'}\n\nThis memo records the agreed terms of engagement for the above project.`
    navigator.clipboard?.writeText(t); toast.success('Memo text copied')
  }
  return (
    <div>
      {canEdit && <div className="flex justify-end mb-3"><Button icon={Plus} onClick={openNew}>Add deal memo</Button></div>}
      {rows.length === 0 ? <Empty t="No deal memos yet. Record agreed terms for cast & crew; copy the memo text to share or get signed." /> : (
        <div className="space-y-2">{rows.map((r: Memo) => (
          <div key={r.id} className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3">
            <div className="min-w-0"><div className="text-sm text-white font-medium flex items-center gap-2">{r.party_name} {r.role_title && <span className="text-[#8888aa] font-normal">· {r.role_title}</span>} {badge(r.status)}</div>
              <div className="text-xs text-[#8888aa] mt-0.5">{r.party_kind}{r.fee ? ` · fee ${formatCurrency(Number(r.fee))}` : ''}{r.advance ? ` · adv ${formatCurrency(Number(r.advance))}` : ''}{r.tds_percent ? ` · TDS ${r.tds_percent}%` : ''}</div></div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => copyMemo(r)} className="text-[#8888aa] hover:text-white" title="Copy memo text"><Copy size={14} /></button>
              {canEdit && <select value={r.status} onChange={e => setStatus(r, e.target.value)} className="bg-[#13131a] border border-[#2a2a3a] rounded text-xs text-white px-1.5 py-1">{['draft', 'sent', 'signed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}</select>}
              {canEdit && <><button onClick={() => openEd(r)} className="text-[#8888aa] hover:text-white"><Pencil size={14} /></button><button onClick={() => del(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={14} /></button></>}
            </div>
          </div>))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={ed ? 'Edit deal memo' : 'Add deal memo'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><Input label="Party name" value={f.party_name} onChange={e => setF({ ...f, party_name: e.target.value })} /><Select label="Kind" value={f.party_kind} onChange={e => setF({ ...f, party_kind: e.target.value })} options={[['cast', 'Cast'], ['crew', 'Crew'], ['vendor', 'Vendor'], ['other', 'Other']].map(([v, l]) => ({ value: v, label: l }))} /></div>
          <Input label="Role / title" value={f.role_title} onChange={e => setF({ ...f, role_title: e.target.value })} />
          <div className="grid grid-cols-3 gap-3"><MoneyInput label="Fee" value={String(f.fee)} onChange={(v: string) => setF({ ...f, fee: v })} /><MoneyInput label="Advance" value={String(f.advance)} onChange={(v: string) => setF({ ...f, advance: v })} /><Input label="TDS %" type="number" value={f.tds_percent} onChange={e => setF({ ...f, tds_percent: e.target.value })} /></div>
          <Textarea label="Terms" value={f.terms} onChange={e => setF({ ...f, terms: e.target.value })} />
          <Select label="Status" value={f.status} onChange={e => setF({ ...f, status: e.target.value })} options={['draft', 'sent', 'signed', 'cancelled'].map(v => ({ value: v, label: v }))} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}
