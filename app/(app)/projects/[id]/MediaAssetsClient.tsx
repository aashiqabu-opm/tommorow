'use client'

import { useRef, useState } from 'react'
import { HardDrive, Plus, Trash2, Pencil, Upload } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'

export interface MediaAsset {
  id: string
  asset_type: string
  label: string
  capacity_tb: number | null
  used_tb: number | null
  contents: string | null
  shoot_date: string | null
  location: string | null
  copies: number | null
  status: string
  health_checked_date: string | null
  source: string
}

const TYPES = ['drive', 'card', 'cloud', 'archive']
const STATUSES = ['active', 'archived', 'missing', 'retired']
const statusCls: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400 border-green-500/30',
  archived: 'bg-white/5 text-[#8888aa] border-[#2a2a3a]',
  missing: 'bg-red-500/15 text-red-400 border-red-500/30',
  retired: 'bg-white/5 text-[#666688] border-[#2a2a3a]',
}
const EMPTY = { asset_type: 'drive', label: '', capacity_tb: '', used_tb: '', contents: '', shoot_date: '', location: '', copies: '', status: 'active', health_checked_date: '' }

// Tiny CSV parser (handles quoted fields). DIT logs are simple comma files.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let cur: string[] = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') q = false
      else field += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { cur.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') { if (field !== '' || cur.length) { cur.push(field); rows.push(cur); cur = []; field = '' } }
    else field += ch
  }
  if (field !== '' || cur.length) { cur.push(field); rows.push(cur) }
  if (!rows.length) return []
  const header = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return rows.slice(1).filter(r => r.some(c => c.trim())).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

interface Props { projectId: string; rows: MediaAsset[]; userId: string; canManage: boolean; canDelete: boolean }

export function MediaAssetsClient({ projectId, rows, userId, canManage, canDelete }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [editing, setEditing] = useState<MediaAsset | null>(null)
  const [form, setForm] = useState(EMPTY)
  const fileRef = useRef<HTMLInputElement>(null)

  const totalTb = rows.reduce((s, r) => s + Number(r.capacity_tb || 0), 0)
  const missing = rows.filter(r => r.status === 'missing').length

  function openNew() { setEditing(null); setForm(EMPTY); setOpen(true) }
  function openEdit(r: MediaAsset) {
    setEditing(r)
    setForm({
      asset_type: r.asset_type, label: r.label, capacity_tb: r.capacity_tb?.toString() ?? '', used_tb: r.used_tb?.toString() ?? '',
      contents: r.contents ?? '', shoot_date: r.shoot_date ?? '', location: r.location ?? '', copies: r.copies?.toString() ?? '',
      status: r.status, health_checked_date: r.health_checked_date ?? '',
    })
    setOpen(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.label.trim()) return toast.error('Label is required')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      project_id: projectId, asset_type: form.asset_type, label: form.label.trim(),
      capacity_tb: form.capacity_tb ? Number(form.capacity_tb) : null, used_tb: form.used_tb ? Number(form.used_tb) : null,
      contents: form.contents || null, shoot_date: form.shoot_date || null, location: form.location || null,
      copies: form.copies ? parseInt(form.copies) : null, status: form.status, health_checked_date: form.health_checked_date || null,
    }
    if (editing) {
      const { error } = await supabase.from('media_assets').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't update"); setSaving(false); return }
      await logAction('update', 'media_assets', editing.id, undefined, payload)
    } else {
      const { data, error } = await supabase.from('media_assets').insert({ ...payload, source: 'manual', created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('create', 'media_assets', data.id, undefined, payload)
    }
    toast.success(editing ? 'Asset updated' : 'Asset added')
    setSaving(false); setOpen(false); router.refresh()
  }

  async function remove(r: MediaAsset) {
    if (!window.confirm(`Delete ${r.label}?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('media_assets').delete().eq('id', r.id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'media_assets', r.id)
    toast.success('Deleted'); router.refresh()
  }

  async function importDit(file: File) {
    setImporting(true)
    try {
      const parsed = parseCsv(await file.text())
      const records = parsed
        .map(r => ({
          project_id: projectId,
          asset_type: TYPES.includes(r.asset_type) ? r.asset_type : 'card',
          label: r.label || r.name || r.card || r.reel || '',
          capacity_tb: r.capacity_tb ? Number(r.capacity_tb) : null,
          used_tb: r.used_tb ? Number(r.used_tb) : null,
          contents: r.contents || r.scenes || r.notes || null,
          shoot_date: /^\d{4}-\d{2}-\d{2}$/.test(r.shoot_date || r.date || '') ? (r.shoot_date || r.date) : null,
          location: r.location || null,
          copies: r.copies ? parseInt(r.copies) : null,
          status: 'active', source: 'dit_import', created_by: userId,
        }))
        .filter(r => r.label)
      if (!records.length) { toast.error('No rows with a label/card column found'); setImporting(false); return }
      const supabase = createClient()
      const { error } = await supabase.from('media_assets').insert(records)
      if (error) { toast.error('Import failed: ' + error.message.slice(0, 80)); setImporting(false); return }
      await logAction('create', 'media_assets', projectId, undefined, { dit_import: records.length })
      toast.success(`Imported ${records.length} assets from DIT log`)
      router.refresh()
    } catch { toast.error('Could not read the CSV') }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={e => e.target.files?.[0] && importDit(e.target.files[0])} />
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <HardDrive size={16} className="text-white/70" />
          <h3 className="text-sm font-semibold text-white">Media Asset Register</h3>
          {missing > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">{missing} missing</span>}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" icon={Upload} loading={importing} onClick={() => fileRef.current?.click()}>Import DIT CSV</Button>
            <Button size="sm" icon={Plus} onClick={openNew}>Add</Button>
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <div className="px-5 py-3 border-b border-[#2a2a3a] flex gap-6 text-xs">
          <span className="text-[#8888aa]">Assets <span className="text-white font-semibold">{rows.length}</span></span>
          <span className="text-[#8888aa]">Total capacity <span className="text-white font-semibold">{totalTb.toFixed(1)} TB</span></span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#8888aa]">No media assets yet. Add manually or import the DIT CSV log.</div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {rows.map(r => (
            <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">{r.label}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[#8888aa]">{r.asset_type}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusCls[r.status] ?? statusCls.archived}`}>{r.status}</span>
                  {r.source === 'dit_import' && <span className="text-[10px] text-[#5a5a7a]">DIT</span>}
                </div>
                <div className="text-[11px] text-[#8888aa] mt-0.5">
                  {[r.capacity_tb ? `${r.capacity_tb} TB` : null, r.location, r.shoot_date ? formatDate(r.shoot_date) : null].filter(Boolean).join(' · ')}
                  {r.contents && <span className="text-[#5a5a7a]"> · {r.contents}</span>}
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(r)} className="p-1.5 text-[#8888aa] hover:text-white"><Pencil size={14} /></button>
                  {canDelete && <button onClick={() => remove(r)} className="p-1.5 text-red-400/70 hover:text-red-400"><Trash2 size={14} /></button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Asset' : 'Add Media Asset'} size="sm">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={form.asset_type} onChange={e => setForm({ ...form, asset_type: e.target.value })} options={TYPES.map(t => ({ value: t, label: t }))} />
            <Input label="Label" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="DRIVE-01 / A001" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Capacity (TB)" type="number" value={form.capacity_tb} onChange={e => setForm({ ...form, capacity_tb: e.target.value })} />
            <Input label="Used (TB)" type="number" value={form.used_tb} onChange={e => setForm({ ...form, used_tb: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Shoot date" type="date" value={form.shoot_date} onChange={e => setForm({ ...form, shoot_date: e.target.value })} />
            <Input label="Copies" type="number" value={form.copies} onChange={e => setForm({ ...form, copies: e.target.value })} />
          </div>
          <Input label="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Shelf / cloud bucket" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STATUSES.map(s => ({ value: s, label: s }))} />
            <Input label="Health checked" type="date" value={form.health_checked_date} onChange={e => setForm({ ...form, health_checked_date: e.target.value })} />
          </div>
          <Textarea label="Contents" value={form.contents} onChange={e => setForm({ ...form, contents: e.target.value })} rows={2} placeholder="Scene numbers / dates" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Update' : 'Save'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
