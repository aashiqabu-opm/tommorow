'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Film, CalendarDays, FileText, Plus, Pencil, Trash2, Upload, Loader2, Sparkles, ExternalLink, UserPlus, Megaphone, Link2, Scissors, Handshake } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { ScheduleModule } from './ScheduleModule'
import { PostModule } from './PostModule'
import { ReleaseModule } from './ReleaseModule'

interface Character { id: string; name: string; description?: string | null; age_range?: string | null; gender?: string | null; importance?: string | null; status: string; cast_actor?: string | null; notes?: string | null }
interface Audition { id: string; character_id?: string | null; applicant_name: string; contact?: string | null; age?: string | null; location?: string | null; photo_url?: string | null; video_url?: string | null; ai_score?: number | null; status: string; notes?: string | null }
interface Doc { id: string; title: string; doc_type: string; file_path?: string | null; file_name?: string | null; ai_summary?: string | null; created_at: string }
interface PressItem { id: string; kind: string; title: string; file_path?: string | null; link?: string | null; notes?: string | null }
interface Channel { id: string; platform: string; handle?: string | null; url: string; notes?: string | null }

type Tab = 'characters' | 'auditions' | 'schedule' | 'post' | 'release' | 'documents' | 'press' | 'channels'
const IMPORTANCE = ['lead', 'supporting', 'cameo', 'extra']

export function ProductionSuite({ projectId, projectStatus, userId, canEditCasting, canEditDocs, canEditPost, canEditDeliv, canEditDeals }: {
  projectId: string; projectStatus: string; userId: string; canEditCasting: boolean; canEditDocs: boolean; canEditPost: boolean; canEditDeliv: boolean; canEditDeals: boolean
}) {
  const toast = useToast()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('characters')
  const [characters, setCharacters] = useState<Character[]>([])
  const [auditions, setAuditions] = useState<Audition[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [press, setPress] = useState<PressItem[]>([])
  const [channels, setChannels] = useState<Channel[]>([])

  const load = useCallback(async () => {
    const [c, a, d, p, ch] = await Promise.all([
      supabase.from('project_characters').select('*').eq('project_id', projectId).order('created_at'),
      supabase.from('project_auditions').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('project_documents').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('project_press_kit').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      supabase.from('project_channels').select('*').eq('project_id', projectId).order('created_at'),
    ])
    setCharacters((c.data ?? []) as Character[]); setAuditions((a.data ?? []) as Audition[])
    setDocs((d.data ?? []) as Doc[])
    setPress((p.data ?? []) as PressItem[]); setChannels((ch.data ?? []) as Channel[])
  }, [projectId, supabase])
  useEffect(() => { load() }, [load])

  const TABS: [Tab, string, typeof Users][] = [['characters', 'Characters', Users], ['auditions', 'Auditions', Film], ['schedule', 'Shoot Schedule', CalendarDays], ['post', 'Post & Delivery', Scissors], ['release', 'Release & Deals', Handshake], ['documents', 'Documents', FileText], ['press', 'Press Kit', Megaphone], ['channels', 'Channels', Link2]]

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1"><Film size={15} className="text-[#f5b301]" /><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f5b301]">Production & Casting</span></div>
      <div className="flex gap-1 mb-4 border-b border-[#2a2a3a] overflow-x-auto">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === id ? 'border-[#f5b301] text-white' : 'border-transparent text-[#8888aa] hover:text-white'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {tab === 'characters' && <Characters projectId={projectId} rows={characters} canEdit={canEditCasting} onChange={load} supabase={supabase} toast={toast} />}
      {tab === 'auditions' && <Auditions projectId={projectId} rows={auditions} characters={characters} canEdit={canEditCasting} onChange={load} supabase={supabase} toast={toast} />}
      {tab === 'schedule' && <ScheduleModule projectId={projectId} canEdit={canEditCasting} />}
      {tab === 'post' && <PostModule projectId={projectId} canEditPost={canEditPost} canEditDeliv={canEditDeliv} />}
      {tab === 'release' && <ReleaseModule projectId={projectId} canEdit={canEditDeals} />}
      {tab === 'documents' && <Documents projectId={projectId} rows={docs} canEdit={canEditDocs} userId={userId} onChange={load} supabase={supabase} toast={toast} addCharacters={async (chars) => {
        const payload = chars.map(c => ({ project_id: projectId, name: c.name, description: c.description, status: 'open' }))
        const { error } = await supabase.from('project_characters').insert(payload)
        if (error) toast.error("Couldn't add characters"); else { toast.success(`${chars.length} characters added`); load() }
      }} />}
      {tab === 'press' && <PressKit projectId={projectId} rows={press} canEdit={canEditCasting} userId={userId} projectStatus={projectStatus} onChange={load} supabase={supabase} toast={toast} />}
      {tab === 'channels' && <Channels projectId={projectId} rows={channels} canEdit={canEditCasting} onChange={load} supabase={supabase} toast={toast} />}
      {projectStatus === 'post_production' && <p className="text-[11px] text-[#8888aa] mt-3">Casting director is auto-removed from the core team now the film is in post-production.</p>}
    </div>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type SB = ReturnType<typeof createClient>
type Toast = ReturnType<typeof useToast>
function Empty({ t }: { t: string }) { return <div className="text-center text-sm text-[#8888aa] bg-[#1a1a24] border border-dashed border-[#2a2a3a] rounded-lg py-8 px-4">{t}</div> }
const badge = (s: string) => <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/5 text-[#8888aa]">{s.replace(/_/g, ' ')}</span>

function Characters({ projectId, rows, canEdit, onChange, supabase, toast }: { projectId: string; rows: Character[]; canEdit: boolean; onChange: () => void; supabase: SB; toast: Toast }) {
  const [open, setOpen] = useState(false); const [ed, setEd] = useState<Character | null>(null)
  const [f, setF] = useState<any>({ name: '', description: '', age_range: '', gender: '', importance: 'supporting', status: 'open', cast_actor: '' })
  function openNew() { setEd(null); setF({ name: '', description: '', age_range: '', gender: '', importance: 'supporting', status: 'open', cast_actor: '' }); setOpen(true) }
  function openEd(r: Character) { setEd(r); setF({ name: r.name, description: r.description ?? '', age_range: r.age_range ?? '', gender: r.gender ?? '', importance: r.importance ?? 'supporting', status: r.status, cast_actor: r.cast_actor ?? '' }); setOpen(true) }
  async function save() {
    if (!f.name) { toast.error('Name required'); return }
    const p = { ...f, description: f.description || null, age_range: f.age_range || null, gender: f.gender || null, cast_actor: f.cast_actor || null }
    const { error } = ed ? await supabase.from('project_characters').update(p).eq('id', ed.id) : await supabase.from('project_characters').insert({ ...p, project_id: projectId })
    if (error) { toast.error("Couldn't save"); return }
    setOpen(false); toast.success('Saved'); onChange()
  }
  async function del(r: Character) { if (!confirm('Delete?')) return; await supabase.from('project_characters').delete().eq('id', r.id); onChange() }
  return (
    <div>
      {canEdit && <div className="flex justify-end mb-3"><Button icon={Plus} onClick={openNew}>Add character</Button></div>}
      {rows.length === 0 ? <Empty t="No characters yet. Add the roles to cast for this film." /> : (
        <div className="space-y-2">{rows.map(r => (
          <div key={r.id} className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3">
            <div className="min-w-0"><div className="text-sm text-white font-medium flex items-center gap-2">{r.name} {badge(r.importance ?? 'supporting')} {badge(r.status)}</div>
              <div className="text-xs text-[#8888aa] mt-0.5">{[r.age_range, r.gender, r.cast_actor ? `→ ${r.cast_actor}` : '', r.description].filter(Boolean).join(' · ')}</div></div>
            {canEdit && <div className="flex items-center gap-3 shrink-0"><button onClick={() => openEd(r)} className="text-[#8888aa] hover:text-white"><Pencil size={15} /></button><button onClick={() => del(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button></div>}
          </div>))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={ed ? 'Edit character' : 'Add character'}>
        <div className="space-y-3">
          <Input label="Character / role name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <Textarea label="Description" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Age range" value={f.age_range} onChange={e => setF({ ...f, age_range: e.target.value })} placeholder="30-40" />
            <Input label="Gender" value={f.gender} onChange={e => setF({ ...f, gender: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Importance" value={f.importance} onChange={e => setF({ ...f, importance: e.target.value })} options={IMPORTANCE.map(v => ({ value: v, label: v }))} />
            <Select label="Status" value={f.status} onChange={e => setF({ ...f, status: e.target.value })} options={['open', 'casting', 'cast', 'on_hold'].map(v => ({ value: v, label: v }))} />
          </div>
          <Input label="Cast actor (if cast)" value={f.cast_actor} onChange={e => setF({ ...f, cast_actor: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}

function Auditions({ projectId, rows, characters, canEdit, onChange, supabase, toast }: { projectId: string; rows: Audition[]; characters: Character[]; canEdit: boolean; onChange: () => void; supabase: SB; toast: Toast }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<any>({ applicant_name: '', contact: '', age: '', location: '', character_id: '', video_url: '', photo_url: '', status: 'new', notes: '' })
  const charName = (id?: string | null) => characters.find(c => c.id === id)?.name
  async function save() {
    if (!f.applicant_name) { toast.error('Name required'); return }
    const { error } = await supabase.from('project_auditions').insert({ project_id: projectId, ...f, character_id: f.character_id || null, contact: f.contact || null, age: f.age || null, location: f.location || null, video_url: f.video_url || null, photo_url: f.photo_url || null, notes: f.notes || null })
    if (error) { toast.error("Couldn't save"); return }
    setOpen(false); setF({ applicant_name: '', contact: '', age: '', location: '', character_id: '', video_url: '', photo_url: '', status: 'new', notes: '' }); toast.success('Audition added'); onChange()
  }
  async function setStatus(r: Audition, status: string) { await supabase.from('project_auditions').update({ status }).eq('id', r.id); onChange() }
  async function del(r: Audition) { if (!confirm('Delete?')) return; await supabase.from('project_auditions').delete().eq('id', r.id); onChange() }
  return (
    <div>
      {canEdit && <div className="flex justify-end mb-3"><Button icon={Plus} onClick={() => setOpen(true)}>Add audition</Button></div>}
      {rows.length === 0 ? <Empty t="No auditions logged. Add applicants and track them through to callback/cast." /> : (
        <div className="space-y-2">{rows.map(r => (
          <div key={r.id} className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3">
            <div className="min-w-0"><div className="text-sm text-white font-medium flex items-center gap-2">{r.applicant_name} {charName(r.character_id) && <span className="text-[#8888aa] font-normal">for {charName(r.character_id)}</span>} {badge(r.status)}{typeof r.ai_score === 'number' && <span className="text-[10px] text-[#f5b301]">{r.ai_score}/100</span>}</div>
              <div className="text-xs text-[#8888aa] mt-0.5">{[r.age, r.location, r.contact].filter(Boolean).join(' · ')}{r.video_url && <a href={r.video_url} target="_blank" rel="noreferrer" className="ml-2 text-[#f5b301] inline-flex items-center gap-1">tape <ExternalLink size={11} /></a>}</div></div>
            {canEdit && <div className="flex items-center gap-2 shrink-0">
              <select value={r.status} onChange={e => setStatus(r, e.target.value)} className="bg-[#13131a] border border-[#2a2a3a] rounded text-xs text-white px-1.5 py-1">{['new', 'shortlist', 'maybe', 'pass', 'callback', 'cast'].map(s => <option key={s} value={s}>{s}</option>)}</select>
              <button onClick={() => del(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button></div>}
          </div>))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add audition">
        <div className="space-y-3">
          <Input label="Applicant name" value={f.applicant_name} onChange={e => setF({ ...f, applicant_name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Contact" value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} />
            <Input label="Age" value={f.age} onChange={e => setF({ ...f, age: e.target.value })} />
          </div>
          <Input label="Location" value={f.location} onChange={e => setF({ ...f, location: e.target.value })} />
          <Select label="For character" value={f.character_id} onChange={e => setF({ ...f, character_id: e.target.value })} placeholder="— select role —" options={characters.map(c => ({ value: c.id, label: c.name }))} />
          <Input label="Self-tape video link" value={f.video_url} onChange={e => setF({ ...f, video_url: e.target.value })} placeholder="YouTube / Drive link" />
          <Input label="Photo link" value={f.photo_url} onChange={e => setF({ ...f, photo_url: e.target.value })} />
          <Textarea label="Notes" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}

function Documents({ projectId, rows, canEdit, userId, onChange, supabase, toast, addCharacters }: { projectId: string; rows: Doc[]; canEdit: boolean; userId: string; onChange: () => void; supabase: SB; toast: Toast; addCharacters: (c: { name: string; description: string }[]) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(''); const [docType, setDocType] = useState('screenplay')
  const [file, setFile] = useState<File | null>(null); const [analyzing, setAnalyzing] = useState(false); const [saving, setSaving] = useState(false)
  const [summary, setSummary] = useState<string | null>(null); const [extractedChars, setExtractedChars] = useState<{ name: string; description: string }[]>([]); const [aiData, setAiData] = useState<any>(null)

  function reset() { setTitle(''); setDocType('screenplay'); setFile(null); setSummary(null); setExtractedChars([]); setAiData(null) }
  function b64(fl: File): Promise<string> { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = rej; r.readAsDataURL(fl) }) }
  async function onFile(fl: File | null) {
    setFile(fl); if (!fl) return
    const ok = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
    if (!ok.includes(fl.type) || fl.size > 9_000_000) { toast.error('Use a PDF/image under ~6MB for AI read'); return }
    setAnalyzing(true)
    try {
      const res = await fetch('/api/projects/analyze-doc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base64: await b64(fl), mediaType: fl.type }) })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || "AI couldn't read it"); return }
      const x = d.extracted
      if (x.title && !title) setTitle(x.title)
      setSummary(x.summary ?? null); setExtractedChars(x.characters ?? []); setAiData(x)
      toast.success('AI read the document')
    } catch { toast.error("AI couldn't read it") } finally { setAnalyzing(false) }
  }
  async function save() {
    if (!title) { toast.error('Title required'); return }
    setSaving(true)
    let filePath: string | null = null, fileName: string | null = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `project-docs/${projectId}/${Date.now()}.${ext}`
      const { error: up } = await supabase.storage.from('documents').upload(path, file)
      if (up) { toast.error("Couldn't upload file"); setSaving(false); return }
      filePath = path; fileName = file.name
    }
    const { error } = await supabase.from('project_documents').insert({ project_id: projectId, title, doc_type: docType, file_path: filePath, file_name: fileName, ai_summary: summary, ai_data: aiData, uploaded_by: userId })
    setSaving(false)
    if (error) { toast.error("Couldn't save"); return }
    setOpen(false); reset(); toast.success('Document saved'); onChange()
  }
  async function view(r: Doc) { if (!r.file_path) return; const { data } = await supabase.storage.from('documents').getPublicUrl(r.file_path); if (data?.publicUrl) window.open(data.publicUrl, '_blank') }
  async function del(r: Doc) { if (!confirm('Delete?')) return; if (r.file_path) await supabase.storage.from('documents').remove([r.file_path]); await supabase.from('project_documents').delete().eq('id', r.id); onChange() }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-[#8888aa]">Screenplay, charts & PDFs. AI reads them and feeds project intelligence.{!canEdit && ' (View only — editing limited to director, screenwriter & ADs.)'}</p>
        {canEdit && <Button icon={Plus} onClick={() => setOpen(true)}>Add document</Button>}
      </div>
      {rows.length === 0 ? <Empty t="No documents yet. Upload the screenplay, production charts or reference PDFs." /> : (
        <div className="space-y-2">{rows.map(r => (
          <div key={r.id} className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3">
            <div className="min-w-0 flex items-center gap-3"><FileText size={18} className="text-[#8888aa] shrink-0" />
              <div className="min-w-0"><div className="text-sm text-white font-medium truncate flex items-center gap-2">{r.title} {badge(r.doc_type)}</div>
                {r.ai_summary && <div className="text-xs text-[#aaaacc] mt-0.5 line-clamp-2">{r.ai_summary}</div>}</div></div>
            <div className="flex items-center gap-3 shrink-0">
              {r.file_path && <button onClick={() => view(r)} className="text-[#8888aa] hover:text-white"><ExternalLink size={15} /></button>}
              {canEdit && <button onClick={() => del(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>}
            </div>
          </div>))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add document">
        <div className="space-y-3">
          <Select label="Type" value={docType} onChange={e => setDocType(e.target.value)} options={[['screenplay', 'Screenplay'], ['chart', 'Chart'], ['pdf', 'PDF'], ['reference', 'Reference'], ['other', 'Other']].map(([v, l]) => ({ value: v, label: l }))} />
          <label className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 cursor-pointer border ${analyzing ? 'border-[#f5b301]/50 text-[#f5b301]' : 'text-white bg-[#13131a] border-[#2a2a3a] hover:border-white/30'}`}>
            {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}{analyzing ? 'AI reading…' : file ? file.name : 'Upload screenplay / chart / PDF'}
            <input type="file" className="hidden" disabled={analyzing} onChange={e => onFile(e.target.files?.[0] ?? null)} />
          </label>
          <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} />
          {summary && <div className="text-xs text-[#aaaacc] bg-[#13131a] border border-[#2a2a3a] rounded-lg p-2"><span className="text-[#8888aa]">AI summary:</span> {summary}</div>}
          {extractedChars.length > 0 && (
            <div className="text-xs bg-[#13131a] border border-[#2a2a3a] rounded-lg p-2">
              <div className="text-[#8888aa] mb-1 flex items-center gap-1"><Sparkles size={12} className="text-[#f5b301]" /> {extractedChars.length} characters found in the screenplay</div>
              <button onClick={() => addCharacters(extractedChars)} className="flex items-center gap-1 text-[#f5b301] hover:underline"><UserPlus size={12} /> Add all to Characters</button>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}

const PRESS_KINDS = [['poster', 'Poster'], ['still', 'Still / hi-res image'], ['logo', 'Logo'], ['publicity', 'Publicity material'], ['trailer', 'Trailer / video'], ['press_note', 'Press note'], ['other', 'Other']]
function PressKit({ projectId, rows, canEdit, userId, projectStatus, onChange, supabase, toast }: { projectId: string; rows: PressItem[]; canEdit: boolean; userId: string; projectStatus: string; onChange: () => void; supabase: SB; toast: Toast }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<any>({ kind: 'poster', title: '', link: '', notes: '' })
  const [file, setFile] = useState<File | null>(null); const [saving, setSaving] = useState(false)
  async function save() {
    if (!f.title) { toast.error('Title required'); return }
    setSaving(true)
    let filePath: string | null = null
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `press-kit/${projectId}/${Date.now()}.${ext}`
      const { error: up } = await supabase.storage.from('documents').upload(path, file)
      if (up) { toast.error("Couldn't upload"); setSaving(false); return }
      filePath = path
    }
    const { error } = await supabase.from('project_press_kit').insert({ project_id: projectId, kind: f.kind, title: f.title, link: f.link || null, notes: f.notes || null, file_path: filePath, uploaded_by: userId })
    setSaving(false); if (error) { toast.error("Couldn't save"); return }
    setOpen(false); setF({ kind: 'poster', title: '', link: '', notes: '' }); setFile(null); toast.success('Added to press kit'); onChange()
  }
  async function view(r: PressItem) { if (r.file_path) { const { data } = await supabase.storage.from('documents').getPublicUrl(r.file_path); if (data?.publicUrl) window.open(data.publicUrl, '_blank') } else if (r.link) window.open(r.link, '_blank') }
  async function del(r: PressItem) { if (!confirm('Delete?')) return; if (r.file_path) await supabase.storage.from('documents').remove([r.file_path]); await supabase.from('project_press_kit').delete().eq('id', r.id); onChange() }
  return (
    <div>
      {projectStatus !== 'released' && <div className="text-[11px] text-[#f5b301] bg-[#f5b301]/10 border border-[#f5b301]/20 rounded-lg px-3 py-2 mb-3">Assemble the press kit before release — posters, hi-res stills, logos & publicity materials in one place.</div>}
      {canEdit && <div className="flex justify-end mb-3"><Button icon={Plus} onClick={() => setOpen(true)}>Add asset</Button></div>}
      {rows.length === 0 ? <Empty t="No press-kit assets yet. Upload posters, hi-res stills, logos and publicity materials." /> : (
        <div className="space-y-2">{rows.map(r => (
          <div key={r.id} className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3">
            <div className="min-w-0"><div className="text-sm text-white font-medium flex items-center gap-2">{r.title} {badge(r.kind)}</div>{r.notes && <div className="text-xs text-[#8888aa] mt-0.5">{r.notes}</div>}</div>
            <div className="flex items-center gap-3 shrink-0">
              {(r.file_path || r.link) && <button onClick={() => view(r)} className="text-[#8888aa] hover:text-white"><ExternalLink size={15} /></button>}
              {canEdit && <button onClick={() => del(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>}
            </div>
          </div>))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Add press-kit asset">
        <div className="space-y-3">
          <Select label="Kind" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })} options={PRESS_KINDS.map(([v, l]) => ({ value: v, label: l }))} />
          <Input label="Title" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="First-look poster" />
          <label className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 cursor-pointer border text-white bg-[#13131a] border-[#2a2a3a] hover:border-white/30">
            <Upload size={15} /> {file ? file.name : 'Upload file (hi-res image / PDF / video)'}
            <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Input label="Or external link" value={f.link} onChange={e => setF({ ...f, link: e.target.value })} placeholder="Drive / YouTube link" />
          <Textarea label="Notes" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}

const PLATFORMS = [['youtube', 'YouTube'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['x', 'X (Twitter)'], ['threads', 'Threads'], ['website', 'Website'], ['other', 'Other']]
function Channels({ projectId, rows, canEdit, onChange, supabase, toast }: { projectId: string; rows: Channel[]; canEdit: boolean; onChange: () => void; supabase: SB; toast: Toast }) {
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<any>({ platform: 'youtube', handle: '', url: '', notes: '' })
  async function save() {
    if (!f.url) { toast.error('URL required'); return }
    const { error } = await supabase.from('project_channels').insert({ project_id: projectId, platform: f.platform, handle: f.handle || null, url: f.url, notes: f.notes || null })
    if (error) { toast.error("Couldn't save"); return }
    setOpen(false); setF({ platform: 'youtube', handle: '', url: '', notes: '' }); toast.success('Channel linked'); onChange()
  }
  async function del(r: Channel) { if (!confirm('Remove?')) return; await supabase.from('project_channels').delete().eq('id', r.id); onChange() }
  return (
    <div>
      <p className="text-xs text-[#8888aa] mb-3">Link this film&apos;s YouTube channel & social pages. Live subscriber/view stats can be wired next (needs API setup).</p>
      {canEdit && <div className="flex justify-end mb-3"><Button icon={Plus} onClick={() => setOpen(true)}>Link channel</Button></div>}
      {rows.length === 0 ? <Empty t="No channels linked yet. Add the YouTube channel and social pages." /> : (
        <div className="space-y-2">{rows.map(r => (
          <div key={r.id} className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3">
            <div className="min-w-0"><div className="text-sm text-white font-medium flex items-center gap-2">{badge(r.platform)} {r.handle || r.url}</div>{r.notes && <div className="text-xs text-[#8888aa] mt-0.5">{r.notes}</div>}</div>
            <div className="flex items-center gap-3 shrink-0">
              <a href={r.url} target="_blank" rel="noreferrer" className="text-[#8888aa] hover:text-white"><ExternalLink size={15} /></a>
              {canEdit && <button onClick={() => del(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={15} /></button>}
            </div>
          </div>))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Link channel">
        <div className="space-y-3">
          <Select label="Platform" value={f.platform} onChange={e => setF({ ...f, platform: e.target.value })} options={PLATFORMS.map(([v, l]) => ({ value: v, label: l }))} />
          <Input label="Handle / name" value={f.handle} onChange={e => setF({ ...f, handle: e.target.value })} placeholder="@opmcinemas" />
          <Input label="URL" value={f.url} onChange={e => setF({ ...f, url: e.target.value })} placeholder="https://youtube.com/@opmcinemas" />
          <Textarea label="Notes" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}
