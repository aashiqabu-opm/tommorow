'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Clapperboard, MapPin, CalendarDays, Plus, Pencil, Trash2, ChevronDown, ChevronRight, Check, LayoutGrid, Shirt, Stamp, Hammer, UserPlus, Package, Users, Fuel, ClipboardCheck, Swords, Sparkles } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

/* eslint-disable @typescript-eslint/no-explicit-any */
type SB = ReturnType<typeof createClient>
type Toast = ReturnType<typeof useToast>

interface Loc { id: string; name: string; address?: string | null; map_link?: string | null; contact?: string | null; permit_status?: string | null; nearest_hospital?: string | null }
interface Scene { id: string; scene_no: string; int_ext: string; day_night: string; location_id?: string | null; set_name?: string | null; page_eighths: number; synopsis?: string | null; status: string }
interface Elem { id: string; scene_id: string; category: string; label: string; qty: number; notes?: string | null }
interface Day { id: string; shoot_date: string; day_number?: number | null; location_id?: string | null; call_time?: string | null; est_wrap?: string | null; status: string; weather?: string | null; notes?: string | null }
interface Req { id: string; schedule_day_id: string; category: string; label: string; qty: number; dept?: string | null; status: string }
interface Chk { id: string; schedule_day_id: string; item: string; owner_dept?: string | null; done: boolean }

const EL_CATS = ['cast', 'junior_artists', 'technician', 'prop', 'wardrobe', 'makeup', 'special_makeup', 'equipment', 'vehicle', 'stunt', 'vfx', 'sfx', 'animal', 'sound', 'set_dressing', 'other']
const REQ_CATS = ['cast', 'junior_artists', 'technician', 'equipment', 'special_makeup', 'prop', 'vehicle', 'wardrobe', 'stunt', 'vfx', 'other']
const eighths = (e: number) => `${Math.floor(e / 8)} ${e % 8}/8`.replace('0 0/8', '—')
const cat = (s: string) => <span className="text-[9px] uppercase tracking-wide px-1 py-0.5 rounded bg-white/5 text-[#8888aa]">{s.replace(/_/g, ' ')}</span>

export function ScheduleModule({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const toast = useToast(); const supabase = createClient()
  const [view, setView] = useState<'breakdown' | 'days' | 'dood' | 'locations'>('breakdown')
  const [locs, setLocs] = useState<Loc[]>([]); const [scenes, setScenes] = useState<Scene[]>([])
  const [elems, setElems] = useState<Elem[]>([]); const [days, setDays] = useState<Day[]>([])

  const load = useCallback(async () => {
    const [l, s, e, d] = await Promise.all([
      supabase.from('locations').select('*').eq('project_id', projectId).order('name'),
      supabase.from('scenes').select('*').eq('project_id', projectId).order('sort_order').order('scene_no'),
      supabase.from('scene_elements').select('*').eq('project_id', projectId),
      supabase.from('project_schedule').select('*').eq('project_id', projectId).order('shoot_date'),
    ])
    setLocs((l.data ?? []) as Loc[]); setScenes((s.data ?? []) as Scene[]); setElems((e.data ?? []) as Elem[]); setDays((d.data ?? []) as Day[])
  }, [projectId, supabase])
  useEffect(() => { load() }, [load])

  const locName = (id?: string | null) => locs.find(l => l.id === id)?.name

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {([['breakdown', 'Breakdown', Clapperboard], ['days', 'Shoot Days', CalendarDays], ['dood', 'Day-Out-of-Days', LayoutGrid], ['locations', 'Locations', MapPin]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setView(id)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg ${view === id ? 'bg-white/10 text-white' : 'text-[#8888aa] hover:text-white'}`}><Icon size={13} /> {label}</button>
        ))}
        <Link href={`/projects/${projectId}/costume`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-[#8888aa] hover:text-white"><Shirt size={13} /> Costume Readiness</Link>
        <Link href={`/projects/${projectId}/permits`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-[#8888aa] hover:text-white"><Stamp size={13} /> Permits</Link>
        <Link href={`/projects/${projectId}/art-sets`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-[#8888aa] hover:text-white"><Hammer size={13} /> Art Sets</Link>
        <Link href={`/projects/${projectId}/crew-onboarding`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-[#8888aa] hover:text-white"><UserPlus size={13} /> Crew Onboarding</Link>
        <Link href={`/projects/${projectId}/store`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-[#8888aa] hover:text-white"><Package size={13} /> Store</Link>
        <Link href={`/projects/${projectId}/extras`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-[#8888aa] hover:text-white"><Users size={13} /> Extras</Link>
        <Link href={`/projects/${projectId}/fuel`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-[#8888aa] hover:text-white"><Fuel size={13} /> Fuel</Link>
        <Link href={`/projects/${projectId}/attendance`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-[#8888aa] hover:text-white"><ClipboardCheck size={13} /> Attendance</Link>
        <Link href={`/projects/${projectId}/sequences`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-[#8888aa] hover:text-white"><Swords size={13} /> Special Sequences</Link>
        <Link href={`/projects/${projectId}/vfx`} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-[#8888aa] hover:text-white"><Sparkles size={13} /> VFX Shots</Link>
      </div>
      {view === 'breakdown' && <Breakdown {...{ projectId, canEdit, scenes, elems, locs, locName, onChange: load, supabase, toast }} />}
      {view === 'days' && <Days {...{ projectId, canEdit, days, scenes, locs, locName, onChange: load, supabase, toast }} />}
      {view === 'dood' && <DOOD {...{ days, scenes, elems, supabase }} />}
      {view === 'locations' && <Locations {...{ projectId, canEdit, rows: locs, onChange: load, supabase, toast }} />}
    </div>
  )
}

function Empty({ t }: { t: string }) { return <div className="text-center text-sm text-[#8888aa] bg-[#1a1a24] border border-dashed border-[#2a2a3a] rounded-lg py-8 px-4">{t}</div> }

function Breakdown({ projectId, canEdit, scenes, elems, locs, locName, onChange, supabase, toast }: any) {
  const [open, setOpen] = useState(false); const [ed, setEd] = useState<Scene | null>(null)
  const [exp, setExp] = useState<string | null>(null)
  const [f, setF] = useState<any>({ scene_no: '', int_ext: 'INT', day_night: 'DAY', location_id: '', set_name: '', page_eighths: 0, synopsis: '', status: 'unscheduled' })
  const [elOpen, setElOpen] = useState<string | null>(null)
  const [elF, setElF] = useState<any>({ category: 'cast', label: '', qty: 1, notes: '' })

  function openNew() { setEd(null); setF({ scene_no: '', int_ext: 'INT', day_night: 'DAY', location_id: '', set_name: '', page_eighths: 0, synopsis: '', status: 'unscheduled' }); setOpen(true) }
  function openEd(s: Scene) { setEd(s); setF({ scene_no: s.scene_no, int_ext: s.int_ext, day_night: s.day_night, location_id: s.location_id ?? '', set_name: s.set_name ?? '', page_eighths: s.page_eighths, synopsis: s.synopsis ?? '', status: s.status }); setOpen(true) }
  async function save() {
    if (!f.scene_no) { toast.error('Scene no. required'); return }
    const p = { ...f, location_id: f.location_id || null, set_name: f.set_name || null, synopsis: f.synopsis || null, page_eighths: Number(f.page_eighths) || 0 }
    const { error } = ed ? await supabase.from('scenes').update(p).eq('id', ed.id) : await supabase.from('scenes').insert({ ...p, project_id: projectId })
    if (error) { toast.error("Couldn't save"); return }
    setOpen(false); toast.success('Saved'); onChange()
  }
  async function del(s: Scene) { if (!confirm('Delete scene?')) return; await supabase.from('scenes').delete().eq('id', s.id); onChange() }
  async function addEl(sceneId: string) {
    if (!elF.label) { toast.error('Label required'); return }
    const { error } = await supabase.from('scene_elements').insert({ scene_id: sceneId, project_id: projectId, category: elF.category, label: elF.label, qty: Number(elF.qty) || 1, notes: elF.notes || null })
    if (error) { toast.error("Couldn't add"); return }
    setElOpen(null); setElF({ category: 'cast', label: '', qty: 1, notes: '' }); onChange()
  }
  async function delEl(id: string) { await supabase.from('scene_elements').delete().eq('id', id); onChange() }

  return (
    <div>
      {canEdit && <div className="flex justify-end mb-3"><Button icon={Plus} onClick={openNew}>Add scene</Button></div>}
      {scenes.length === 0 ? <Empty t="No scenes yet. Break the script down scene-by-scene with their elements (cast, junior artists, equipment, special makeup…)." /> : (
        <div className="space-y-2">{scenes.map((s: Scene) => {
          const se = elems.filter((e: Elem) => e.scene_id === s.id)
          const isOpen = exp === s.id
          return (
            <div key={s.id} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg">
              <div className="flex items-center justify-between px-4 py-3">
                <button onClick={() => setExp(isOpen ? null : s.id)} className="flex items-center gap-2 min-w-0 text-left">
                  {isOpen ? <ChevronDown size={15} className="text-[#8888aa]" /> : <ChevronRight size={15} className="text-[#8888aa]" />}
                  <div className="min-w-0"><div className="text-sm text-white font-medium">Sc {s.scene_no} · {s.int_ext} {s.day_night} {cat(s.status)}</div>
                    <div className="text-xs text-[#8888aa] mt-0.5">{[locName(s.location_id), s.set_name, `${eighths(s.page_eighths)} pg`, `${se.length} elements`].filter(Boolean).join(' · ')}{s.synopsis ? ` — ${s.synopsis}` : ''}</div></div>
                </button>
                {canEdit && <div className="flex items-center gap-3 shrink-0"><button onClick={() => openEd(s)} className="text-[#8888aa] hover:text-white"><Pencil size={14} /></button><button onClick={() => del(s)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={14} /></button></div>}
              </div>
              {isOpen && (
                <div className="px-4 pb-3 border-t border-[#2a2a3a] pt-2">
                  <div className="flex flex-wrap gap-1.5 mb-2">{se.length === 0 ? <span className="text-xs text-[#8888aa]">No elements.</span> : se.map((e: Elem) => (
                    <span key={e.id} className="inline-flex items-center gap-1 text-xs bg-[#13131a] border border-[#2a2a3a] rounded px-2 py-1">{cat(e.category)} {e.label}{e.qty > 1 ? ` ×${e.qty}` : ''}{canEdit && <button onClick={() => delEl(e.id)} className="text-[#8888aa] hover:text-red-400 ml-1"><Trash2 size={11} /></button>}</span>
                  ))}</div>
                  {canEdit && (elOpen === s.id ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <Select label="Category" value={elF.category} onChange={(e: any) => setElF({ ...elF, category: e.target.value })} options={EL_CATS.map(v => ({ value: v, label: v.replace(/_/g, ' ') }))} />
                      <Input label="Label" value={elF.label} onChange={(e: any) => setElF({ ...elF, label: e.target.value })} className="w-44" />
                      <Input label="Qty" type="number" value={elF.qty} onChange={(e: any) => setElF({ ...elF, qty: e.target.value })} className="w-16" />
                      <Button onClick={() => addEl(s.id)}>Add</Button><Button variant="ghost" onClick={() => setElOpen(null)}>×</Button>
                    </div>
                  ) : <button onClick={() => setElOpen(s.id)} className="text-xs text-[#D6B16F] hover:underline flex items-center gap-1"><Plus size={12} /> Add element</button>)}
                </div>
              )}
            </div>
          )
        })}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={ed ? 'Edit scene' : 'Add scene'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><Input label="Scene no." value={f.scene_no} onChange={(e: any) => setF({ ...f, scene_no: e.target.value })} /><Input label="Page (eighths)" type="number" value={f.page_eighths} onChange={(e: any) => setF({ ...f, page_eighths: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="INT/EXT" value={f.int_ext} onChange={(e: any) => setF({ ...f, int_ext: e.target.value })} options={['INT', 'EXT', 'INT/EXT'].map(v => ({ value: v, label: v }))} />
            <Select label="Day/Night" value={f.day_night} onChange={(e: any) => setF({ ...f, day_night: e.target.value })} options={['DAY', 'NIGHT', 'DAWN', 'DUSK'].map(v => ({ value: v, label: v }))} />
          </div>
          <Select label="Location" value={f.location_id} onChange={(e: any) => setF({ ...f, location_id: e.target.value })} placeholder="—" options={locs.map((l: Loc) => ({ value: l.id, label: l.name }))} />
          <Input label="Set / sub-location" value={f.set_name} onChange={(e: any) => setF({ ...f, set_name: e.target.value })} />
          <Textarea label="Synopsis" value={f.synopsis} onChange={(e: any) => setF({ ...f, synopsis: e.target.value })} />
          <Select label="Status" value={f.status} onChange={(e: any) => setF({ ...f, status: e.target.value })} options={['unscheduled', 'scheduled', 'shot', 'omitted'].map(v => ({ value: v, label: v }))} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}

function Days({ projectId, canEdit, days, scenes, locs, locName, onChange, supabase, toast }: any) {
  const [open, setOpen] = useState(false); const [ed, setEd] = useState<Day | null>(null)
  const [exp, setExp] = useState<string | null>(null)
  const [f, setF] = useState<any>({ shoot_date: new Date().toISOString().slice(0, 10), day_number: '', location_id: '', call_time: '', est_wrap: '', weather: '', status: 'planned', notes: '' })
  // expanded-day data
  const [dayScenes, setDayScenes] = useState<any[]>([]); const [reqs, setReqs] = useState<Req[]>([]); const [chks, setChks] = useState<Chk[]>([])
  const [reqF, setReqF] = useState<any>({ category: 'equipment', label: '', qty: 1, dept: '' }); const [chkItem, setChkItem] = useState('')
  const [addSceneId, setAddSceneId] = useState('')
  // call sheet
  const [csText, setCsText] = useState<string | null>(null); const [csOpen, setCsOpen] = useState(false); const [csBusy, setCsBusy] = useState(false)

  async function previewCallSheet(dayId: string) {
    setCsBusy(true)
    try {
      const res = await fetch('/api/projects/callsheet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dayId, previewOnly: true }) })
      const d = await res.json(); if (!res.ok) { toast.error(d.error || 'Failed'); return }
      setCsText(d.text); setCsOpen(true)
    } catch { toast.error('Failed') } finally { setCsBusy(false) }
  }
  async function sendCallSheet(dayId: string) {
    setCsBusy(true)
    try {
      const res = await fetch('/api/projects/callsheet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dayId }) })
      const d = await res.json(); if (!res.ok) { toast.error(d.error || 'Failed'); return }
      toast.success(`Call sheet sent — WhatsApp ${d.sent?.whatsapp ?? 0}, email ${d.sent?.email ?? 0}`); setCsOpen(false)
    } catch { toast.error('Failed') } finally { setCsBusy(false) }
  }
  function printCallSheet() { const w = window.open('', '_blank'); if (w && csText) { w.document.write(`<pre style="font:14px/1.5 monospace;white-space:pre-wrap;padding:24px">${csText.replace(/</g, '&lt;')}</pre>`); w.document.close(); w.print() } }

  const loadDay = useCallback(async (dayId: string) => {
    const [ds, r, c] = await Promise.all([
      supabase.from('schedule_day_scenes').select('*').eq('schedule_day_id', dayId).order('sort_order'),
      supabase.from('day_requirements').select('*').eq('schedule_day_id', dayId),
      supabase.from('day_checklist').select('*').eq('schedule_day_id', dayId),
    ])
    setDayScenes(ds.data ?? []); setReqs((r.data ?? []) as Req[]); setChks((c.data ?? []) as Chk[])
  }, [supabase])
  useEffect(() => { if (exp) loadDay(exp) }, [exp, loadDay])

  function openNew() { setEd(null); setF({ shoot_date: new Date().toISOString().slice(0, 10), day_number: String(days.length + 1), location_id: '', call_time: '', est_wrap: '', weather: '', status: 'planned', notes: '' }); setOpen(true) }
  function openEd(d: Day) { setEd(d); setF({ shoot_date: d.shoot_date, day_number: d.day_number ?? '', location_id: d.location_id ?? '', call_time: d.call_time ?? '', est_wrap: d.est_wrap ?? '', weather: d.weather ?? '', status: d.status, notes: d.notes ?? '' }); setOpen(true) }
  async function save() {
    const p = { shoot_date: f.shoot_date, day_number: f.day_number ? Number(f.day_number) : null, location_id: f.location_id || null, call_time: f.call_time || null, est_wrap: f.est_wrap || null, weather: f.weather || null, status: f.status, notes: f.notes || null }
    const { error } = ed ? await supabase.from('project_schedule').update(p).eq('id', ed.id) : await supabase.from('project_schedule').insert({ ...p, project_id: projectId })
    if (error) { toast.error("Couldn't save"); return }
    setOpen(false); toast.success('Saved'); onChange()
  }
  async function del(d: Day) { if (!confirm('Delete shoot day?')) return; await supabase.from('project_schedule').delete().eq('id', d.id); onChange() }
  async function assignScene(dayId: string) { if (!addSceneId) return; await supabase.from('schedule_day_scenes').insert({ schedule_day_id: dayId, scene_id: addSceneId }); await supabase.from('scenes').update({ status: 'scheduled' }).eq('id', addSceneId); setAddSceneId(''); loadDay(dayId) }
  async function unassign(id: string, dayId: string) { await supabase.from('schedule_day_scenes').delete().eq('id', id); loadDay(dayId) }
  async function addReq(dayId: string) { if (!reqF.label) { toast.error('Label'); return } await supabase.from('day_requirements').insert({ schedule_day_id: dayId, category: reqF.category, label: reqF.label, qty: Number(reqF.qty) || 1, dept: reqF.dept || null }); setReqF({ category: 'equipment', label: '', qty: 1, dept: '' }); loadDay(dayId) }
  async function reqStatus(r: Req, status: string, dayId: string) { await supabase.from('day_requirements').update({ status }).eq('id', r.id); loadDay(dayId) }
  async function delReq(id: string, dayId: string) { await supabase.from('day_requirements').delete().eq('id', id); loadDay(dayId) }
  async function addChk(dayId: string) { if (!chkItem) return; await supabase.from('day_checklist').insert({ schedule_day_id: dayId, item: chkItem }); setChkItem(''); loadDay(dayId) }
  async function toggleChk(c: Chk, dayId: string) { await supabase.from('day_checklist').update({ done: !c.done }).eq('id', c.id); loadDay(dayId) }
  // Auto-seed requirements from the scenes assigned to a day
  async function seedReqs(dayId: string) {
    const sids = dayScenes.map(x => x.scene_id)
    if (!sids.length) { toast.error('Assign scenes first'); return }
    const { data: els } = await supabase.from('scene_elements').select('category, label, qty').in('scene_id', sids)
    const seen = new Set(reqs.map(r => `${r.category}|${r.label.toLowerCase()}`))
    const rows = (els ?? []).filter((e: any) => !seen.has(`${e.category}|${e.label.toLowerCase()}`)).map((e: any) => ({ schedule_day_id: dayId, category: e.category, label: e.label, qty: e.qty }))
    if (!rows.length) { toast.success('Requirements already up to date'); return }
    await supabase.from('day_requirements').insert(rows); toast.success(`${rows.length} requirements added from scenes`); loadDay(dayId)
  }
  const sceneLabel = (id: string) => { const s = scenes.find((x: Scene) => x.id === id); return s ? `Sc ${s.scene_no} (${s.int_ext} ${s.day_night})` : 'Scene' }

  return (
    <div>
      {canEdit && <div className="flex justify-end mb-3"><Button icon={Plus} onClick={openNew}>Add shoot day</Button></div>}
      {days.length === 0 ? <Empty t="No shoot days yet. Add days, assign scenes, and the requirements + call sheet build from there." /> : (
        <div className="space-y-2">{days.map((d: Day) => {
          const isOpen = exp === d.id
          return (
            <div key={d.id} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg">
              <div className="flex items-center justify-between px-4 py-3">
                <button onClick={() => setExp(isOpen ? null : d.id)} className="flex items-center gap-2 min-w-0 text-left">
                  {isOpen ? <ChevronDown size={15} className="text-[#8888aa]" /> : <ChevronRight size={15} className="text-[#8888aa]" />}
                  <div><div className="text-sm text-white font-medium">{d.day_number ? `Day ${d.day_number} · ` : ''}{formatDate(d.shoot_date)} {cat(d.status)}</div>
                    <div className="text-xs text-[#8888aa] mt-0.5">{[locName(d.location_id), d.call_time ? `call ${d.call_time}` : '', d.weather].filter(Boolean).join(' · ')}</div></div>
                </button>
                {canEdit && <div className="flex items-center gap-3 shrink-0"><button onClick={() => openEd(d)} className="text-[#8888aa] hover:text-white"><Pencil size={14} /></button><button onClick={() => del(d)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={14} /></button></div>}
              </div>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-[#2a2a3a] pt-3 space-y-4 text-sm">
                  {canEdit && <div className="flex justify-end"><Button variant="ghost" onClick={() => previewCallSheet(d.id)} loading={csBusy}>📋 Call sheet</Button></div>}
                  {/* Scenes */}
                  <div>
                    <div className="text-xs font-semibold text-white mb-1">Scenes</div>
                    <div className="space-y-1">{dayScenes.length === 0 ? <span className="text-xs text-[#8888aa]">No scenes assigned.</span> : dayScenes.map((x: any) => (
                      <div key={x.id} className="flex items-center justify-between text-xs text-white/90"><span>{sceneLabel(x.scene_id)}</span>{canEdit && <button onClick={() => unassign(x.id, d.id)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={12} /></button>}</div>
                    ))}</div>
                    {canEdit && <div className="flex items-end gap-2 mt-2"><Select label="Add scene" value={addSceneId} onChange={(e: any) => setAddSceneId(e.target.value)} placeholder="—" options={scenes.filter((s: Scene) => !dayScenes.some(ds => ds.scene_id === s.id)).map((s: Scene) => ({ value: s.id, label: `Sc ${s.scene_no}` }))} /><Button onClick={() => assignScene(d.id)}>Add</Button></div>}
                  </div>
                  {/* Requirements */}
                  <div>
                    <div className="flex items-center justify-between mb-1"><div className="text-xs font-semibold text-white">Requirements</div>{canEdit && <button onClick={() => seedReqs(d.id)} className="text-xs text-[#D6B16F] hover:underline">Pull from scenes</button>}</div>
                    <div className="space-y-1">{reqs.length === 0 ? <span className="text-xs text-[#8888aa]">No requirements.</span> : reqs.map(r => (
                      <div key={r.id} className="flex items-center justify-between text-xs"><span className="text-white/90">{cat(r.category)} {r.label}{r.qty > 1 ? ` ×${r.qty}` : ''}{r.dept ? ` · ${r.dept}` : ''}</span>
                        {canEdit && <span className="flex items-center gap-2"><select value={r.status} onChange={e => reqStatus(r, e.target.value, d.id)} className="bg-[#13131a] border border-[#2a2a3a] rounded text-[11px] text-white px-1 py-0.5">{['pending', 'arranged', 'done'].map(s => <option key={s} value={s}>{s}</option>)}</select><button onClick={() => delReq(r.id, d.id)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={11} /></button></span>}</div>
                    ))}</div>
                    {canEdit && <div className="flex flex-wrap items-end gap-2 mt-2">
                      <Select label="Cat" value={reqF.category} onChange={(e: any) => setReqF({ ...reqF, category: e.target.value })} options={REQ_CATS.map(v => ({ value: v, label: v.replace(/_/g, ' ') }))} />
                      <Input label="Item" value={reqF.label} onChange={(e: any) => setReqF({ ...reqF, label: e.target.value })} className="w-40" />
                      <Input label="Qty" type="number" value={reqF.qty} onChange={(e: any) => setReqF({ ...reqF, qty: e.target.value })} className="w-14" />
                      <Input label="Dept" value={reqF.dept} onChange={(e: any) => setReqF({ ...reqF, dept: e.target.value })} className="w-24" />
                      <Button onClick={() => addReq(d.id)}>Add</Button></div>}
                  </div>
                  {/* Checklist */}
                  <div>
                    <div className="text-xs font-semibold text-white mb-1">Day checklist</div>
                    <div className="space-y-1">{chks.map(c => (
                      <div key={c.id} className="flex items-center gap-2 text-xs"><button onClick={() => canEdit && toggleChk(c, d.id)} className={`w-4 h-4 rounded border flex items-center justify-center ${c.done ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'border-[#3a3a4a] text-transparent'}`}><Check size={10} /></button><span className={c.done ? 'text-[#8888aa] line-through' : 'text-white/90'}>{c.item}</span></div>
                    ))}</div>
                    {canEdit && <div className="flex items-end gap-2 mt-2"><Input label="" placeholder="Add checklist item" value={chkItem} onChange={(e: any) => setChkItem(e.target.value)} className="w-56" /><Button onClick={() => addChk(d.id)}>Add</Button></div>}
                  </div>
                </div>
              )}
            </div>
          )
        })}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={ed ? 'Edit shoot day' : 'Add shoot day'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><Input label="Date" type="date" value={f.shoot_date} onChange={(e: any) => setF({ ...f, shoot_date: e.target.value })} /><Input label="Day #" type="number" value={f.day_number} onChange={(e: any) => setF({ ...f, day_number: e.target.value })} /></div>
          <Select label="Location" value={f.location_id} onChange={(e: any) => setF({ ...f, location_id: e.target.value })} placeholder="—" options={locs.map((l: Loc) => ({ value: l.id, label: l.name }))} />
          <div className="grid grid-cols-2 gap-3"><Input label="Call time" value={f.call_time} onChange={(e: any) => setF({ ...f, call_time: e.target.value })} placeholder="6:00 AM" /><Input label="Est. wrap" value={f.est_wrap} onChange={(e: any) => setF({ ...f, est_wrap: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><Input label="Weather" value={f.weather} onChange={(e: any) => setF({ ...f, weather: e.target.value })} /><Select label="Status" value={f.status} onChange={(e: any) => setF({ ...f, status: e.target.value })} options={['planned', 'confirmed', 'done', 'cancelled'].map(v => ({ value: v, label: v }))} /></div>
          <Textarea label="Notes" value={f.notes} onChange={(e: any) => setF({ ...f, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
      <Modal open={csOpen} onClose={() => setCsOpen(false)} title="Call sheet">
        <div className="space-y-3">
          <pre className="text-xs text-white/90 whitespace-pre-wrap bg-[#13131a] border border-[#2a2a3a] rounded-lg p-3 max-h-[50vh] overflow-y-auto">{csText}</pre>
          <p className="text-[11px] text-[#8888aa]">Sends to every core-team member with a WhatsApp number / email on file.</p>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={printCallSheet}>Print / PDF</Button><Button onClick={() => { const id = days.find((d: Day) => exp === d.id)?.id; if (id) sendCallSheet(id) }} loading={csBusy}>Send to unit</Button></div>
        </div>
      </Modal>
    </div>
  )
}

// Day-Out-of-Days: cast × shoot-day grid with Start/Work/Hold/Finish codes.
function DOOD({ days, scenes, elems, supabase }: any) {
  const [map, setMap] = useState<Record<string, string[]>>({})  // dayId -> sceneIds
  useEffect(() => {
    (async () => {
      const ids = days.map((d: Day) => d.id)
      if (!ids.length) { setMap({}); return }
      const { data } = await supabase.from('schedule_day_scenes').select('schedule_day_id, scene_id').in('schedule_day_id', ids)
      const m: Record<string, string[]> = {}
      for (const r of (data ?? []) as any[]) { (m[r.schedule_day_id] ||= []).push(r.scene_id) }
      setMap(m)
    })()
  }, [days, supabase])

  const castNames: string[] = Array.from(new Set((elems as Elem[]).filter(e => e.category === 'cast').map(e => e.label.trim()))).sort()
  const ordered = [...days].sort((a: Day, b: Day) => a.shoot_date.localeCompare(b.shoot_date))
  // cast -> set of scene_ids they appear in
  const castScenes: Record<string, Set<string>> = {}
  for (const e of (elems as Elem[]).filter(e => e.category === 'cast')) { (castScenes[e.label.trim()] ||= new Set()).add(e.scene_id) }
  // works[cast][dayIndex] = boolean
  function worksOn(cast: string, dayId: string) { const sids = map[dayId] ?? []; const cs = castScenes[cast]; return cs ? sids.some(s => cs.has(s)) : false }

  if (!castNames.length || !ordered.length) return <Empty t="Day-Out-of-Days builds automatically once you've tagged cast in scenes and assigned scenes to shoot days." />

  const codeFor = (cast: string) => {
    const w = ordered.map((d: Day) => worksOn(cast, d.id))
    const first = w.indexOf(true), last = w.lastIndexOf(true)
    return ordered.map((_: Day, i: number) => {
      if (first === -1 || i < first || i > last) return ''
      if (i === first && i === last) return 'SWF'
      if (i === first) return 'SW'
      if (i === last) return 'WF'
      return w[i] ? 'W' : 'H'
    })
  }
  const color = (c: string) => c === 'H' ? 'text-amber-300' : c.includes('S') || c.includes('F') ? 'text-[#D6B16F]' : c === 'W' ? 'text-emerald-300' : 'text-transparent'

  return (
    <div>
      <p className="text-xs text-[#8888aa] mb-2">SW=Start·Work · W=Work · H=Hold (idle, still paid) · WF=Work·Finish · SWF=single day. Tighten the schedule to cut hold days.</p>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead><tr><th className="sticky left-0 bg-[#13131a] text-left text-[#8888aa] font-semibold px-2 py-1 border-b border-[#2a2a3a]">Cast</th>
            {ordered.map((d: Day, i: number) => <th key={d.id} className="px-2 py-1 text-[#8888aa] border-b border-[#2a2a3a] whitespace-nowrap">{d.day_number ?? i + 1}</th>)}
            <th className="px-2 py-1 text-[#8888aa] border-b border-[#2a2a3a]">Days</th></tr></thead>
          <tbody>{castNames.map(cast => { const codes = codeFor(cast); const work = codes.filter(c => c && c !== 'H').length; const hold = codes.filter(c => c === 'H').length; return (
            <tr key={cast}><td className="sticky left-0 bg-[#13131a] text-white px-2 py-1 border-b border-[#1f1f2a] whitespace-nowrap">{cast}</td>
              {codes.map((c, i) => <td key={i} className={`px-2 py-1 text-center border-b border-[#1f1f2a] ${color(c)}`}>{c}</td>)}
              <td className="px-2 py-1 text-center border-b border-[#1f1f2a] text-white/80 whitespace-nowrap">{work}{hold ? ` +${hold}H` : ''}</td></tr>
          ) })}</tbody>
        </table>
      </div>
    </div>
  )
}

function Locations({ projectId, canEdit, rows, onChange, supabase, toast }: any) {
  const [open, setOpen] = useState(false); const [ed, setEd] = useState<Loc | null>(null)
  const [f, setF] = useState<any>({ name: '', address: '', map_link: '', contact: '', permit_status: 'pending', nearest_hospital: '' })
  function openNew() { setEd(null); setF({ name: '', address: '', map_link: '', contact: '', permit_status: 'pending', nearest_hospital: '' }); setOpen(true) }
  function openEd(l: Loc) { setEd(l); setF({ name: l.name, address: l.address ?? '', map_link: l.map_link ?? '', contact: l.contact ?? '', permit_status: l.permit_status ?? 'pending', nearest_hospital: l.nearest_hospital ?? '' }); setOpen(true) }
  async function save() {
    if (!f.name) { toast.error('Name required'); return }
    const p = { ...f, address: f.address || null, map_link: f.map_link || null, contact: f.contact || null, nearest_hospital: f.nearest_hospital || null }
    const { error } = ed ? await supabase.from('locations').update(p).eq('id', ed.id) : await supabase.from('locations').insert({ ...p, project_id: projectId })
    if (error) { toast.error("Couldn't save"); return }
    setOpen(false); toast.success('Saved'); onChange()
  }
  async function del(l: Loc) { if (!confirm('Delete?')) return; await supabase.from('locations').delete().eq('id', l.id); onChange() }
  return (
    <div>
      {canEdit && <div className="flex justify-end mb-3"><Button icon={Plus} onClick={openNew}>Add location</Button></div>}
      {rows.length === 0 ? <Empty t="No locations yet. Add shoot locations with maps, contacts, permits and nearest hospital." /> : (
        <div className="space-y-2">{rows.map((l: Loc) => (
          <div key={l.id} className="flex items-center justify-between bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-4 py-3">
            <div className="min-w-0"><div className="text-sm text-white font-medium flex items-center gap-2">{l.name} {cat(l.permit_status ?? 'pending')}</div>
              <div className="text-xs text-[#8888aa] mt-0.5">{[l.address, l.contact, l.nearest_hospital ? `🏥 ${l.nearest_hospital}` : ''].filter(Boolean).join(' · ')}</div></div>
            <div className="flex items-center gap-3 shrink-0">{l.map_link && <a href={l.map_link} target="_blank" rel="noreferrer" className="text-[#8888aa] hover:text-white"><MapPin size={14} /></a>}{canEdit && <><button onClick={() => openEd(l)} className="text-[#8888aa] hover:text-white"><Pencil size={14} /></button><button onClick={() => del(l)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={14} /></button></>}</div>
          </div>))}</div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={ed ? 'Edit location' : 'Add location'}>
        <div className="space-y-3">
          <Input label="Name" value={f.name} onChange={(e: any) => setF({ ...f, name: e.target.value })} />
          <Input label="Address" value={f.address} onChange={(e: any) => setF({ ...f, address: e.target.value })} />
          <Input label="Map link" value={f.map_link} onChange={(e: any) => setF({ ...f, map_link: e.target.value })} />
          <div className="grid grid-cols-2 gap-3"><Input label="Contact" value={f.contact} onChange={(e: any) => setF({ ...f, contact: e.target.value })} /><Select label="Permit" value={f.permit_status} onChange={(e: any) => setF({ ...f, permit_status: e.target.value })} options={['pending', 'applied', 'approved', 'na'].map(v => ({ value: v, label: v }))} /></div>
          <Input label="Nearest hospital" value={f.nearest_hospital} onChange={(e: any) => setF({ ...f, nearest_hospital: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></div>
        </div>
      </Modal>
    </div>
  )
}
