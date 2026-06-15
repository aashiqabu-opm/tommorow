'use client'

import { useState } from 'react'
import { Megaphone, Plus, Sparkles, ExternalLink, Trash2, RefreshCw, Clock, Pencil } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { WEB_SEARCH_ENABLED } from '@/lib/flags'
import type { CampaignAsset } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  assets: CampaignAsset[]
  userId: string
  canManage: boolean
}

const TYPES = [
  { value: 'teaser', label: 'Teaser' }, { value: 'trailer', label: 'Trailer' },
  { value: 'first_look', label: 'First Look' }, { value: 'poster', label: 'Poster' },
  { value: 'song', label: 'Song' }, { value: 'promo', label: 'Promo' }, { value: 'other', label: 'Other' },
]
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPES.map(t => [t.value, t.label]))
const SENTIMENT_VARIANT: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  positive: 'green', mixed: 'yellow', negative: 'red', unknown: 'gray',
}

export function CampaignSection({ projectId, assets, userId, canManage }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [editing, setEditing] = useState<CampaignAsset | null>(null)
  const [form, setForm] = useState({ asset_type: 'trailer', title: '', url: '', released_on: new Date().toISOString().split('T')[0] })

  function openNew() { setEditing(null); setForm({ asset_type: 'trailer', title: '', url: '', released_on: new Date().toISOString().split('T')[0] }); setOpen(true) }
  function openEdit(a: CampaignAsset) { setEditing(a); setForm({ asset_type: a.asset_type, title: a.title, url: a.url ?? '', released_on: a.released_on ?? '' }); setOpen(true) }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Enter a title')
    setSaving(true)
    const supabase = createClient()
    const payload = { asset_type: form.asset_type, title: form.title.trim(), url: form.url.trim() || null, released_on: form.released_on || null }
    if (editing) {
      const { error } = await supabase.from('campaign_assets').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('update', 'campaign_assets', editing.id, undefined, payload)
      toast.success('Asset updated'); setSaving(false); setOpen(false); setEditing(null); router.refresh()
      return
    }
    const { data, error } = await supabase.from('campaign_assets').insert({ project_id: projectId, ...payload, created_by: userId }).select().single()
    if (error) {
      const hint = /relation .*campaign_assets.* does not exist/i.test(error.message) ? 'run migration-tracking2.sql first' : error.message
      toast.error(`Couldn't add — ${String(hint).slice(0, 80)}`); setSaving(false); return
    }
    if (data) await logAction('create', 'campaign_assets', data.id, undefined, data)
    toast.success(WEB_SEARCH_ENABLED ? 'Asset added — hit “Track buzz” to pull its reception' : 'Asset added')
    setSaving(false); setOpen(false); setForm({ asset_type: 'trailer', title: '', url: '', released_on: new Date().toISOString().split('T')[0] })
    router.refresh()
  }

  async function trackBuzz(a: CampaignAsset) {
    setRefreshing(a.id)
    try {
      const res = await fetch(`/api/projects/${projectId}/intel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'asset', assetId: a.id }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Could not track'); setRefreshing(null); return }
      toast.success('Buzz updated')
      router.refresh()
    } catch { toast.error('Could not track') }
    setRefreshing(null)
  }

  async function remove(a: CampaignAsset) {
    if (!window.confirm(`Delete "${a.title}"?`)) return
    const supabase = createClient()
    await supabase.from('campaign_assets').delete().eq('id', a.id)
    router.refresh()
  }

  return (
    <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone size={16} className="text-white/70" />
          <h3 className="text-sm font-semibold text-white">Campaign & Buzz</h3>
          <span className="text-xs text-[#8888aa]">· {assets.length}</span>
        </div>
        {canManage && <Button size="sm" icon={Plus} onClick={openNew}>Add asset</Button>}
      </div>

      {assets.length === 0 ? (
        <div className="py-8 text-center text-sm text-[#8888aa]">
          No promo assets tracked yet.{canManage ? ' Add your teaser, trailer, posters and songs to track how each lands.' : ''}
        </div>
      ) : (
        <div className="divide-y divide-[#2a2a3a]">
          {assets.map(a => (
            <div key={a.id} className="px-5 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wide text-white/80 bg-white/10 border border-white/15 rounded px-1.5 py-0.5">{TYPE_LABEL[a.asset_type] ?? a.asset_type}</span>
                    <span className="text-sm font-medium text-white">{a.title}</span>
                    {a.ai_metrics?.sentiment && <StatusBadge label={a.ai_metrics.sentiment} variant={SENTIMENT_VARIANT[a.ai_metrics.sentiment] ?? 'gray'} />}
                  </div>
                  <div className="text-[11px] text-[#8888aa] mt-0.5 flex items-center gap-2 flex-wrap">
                    {a.released_on && <span>Dropped {formatDate(a.released_on)}</span>}
                    {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1"><ExternalLink size={10} /> link</a>}
                    {a.last_checked && <span className="text-[#5a5a7a] inline-flex items-center gap-1"><Clock size={9} /> {formatDate(a.last_checked)}</span>}
                  </div>
                  {a.ai_summary && <p className="text-xs text-[#c8c8da] mt-1.5 leading-relaxed">{a.ai_summary}</p>}
                  {a.ai_metrics && (a.ai_metrics.views || a.ai_metrics.likes || a.ai_metrics.trending) && (
                    <div className="flex gap-3 mt-1.5 text-[11px] text-[#8888aa]">
                      {a.ai_metrics.views && <span><span className="text-white">{a.ai_metrics.views}</span> views</span>}
                      {a.ai_metrics.likes && <span><span className="text-white">{a.ai_metrics.likes}</span> likes</span>}
                      {a.ai_metrics.trending && <span className="text-emerald-400">{a.ai_metrics.trending}</span>}
                    </div>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center gap-2 shrink-0">
                    {WEB_SEARCH_ENABLED && (
                      <button onClick={() => trackBuzz(a)} title="Track buzz" className="text-indigo-300 hover:text-indigo-200">
                        <RefreshCw size={14} className={refreshing === a.id ? 'animate-spin' : ''} />
                      </button>
                    )}
                    <button onClick={() => openEdit(a)} className="text-[#3a3a4a] hover:text-white"><Pencil size={13} /></button>
                    <button onClick={() => remove(a)} className="text-[#3a3a4a] hover:text-red-400"><Trash2 size={13} /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Campaign Asset' : 'Add Campaign Asset'} size="sm">
        <form onSubmit={add} className="space-y-4">
          <Select label="Type" value={form.asset_type} onChange={e => setForm({ ...form, asset_type: e.target.value })} options={TYPES} />
          <Input label="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Official Trailer" />
          <Input label="URL (YouTube / social)" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://youtu.be/…" />
          <Input label="Released on" type="date" value={form.released_on} onChange={e => setForm({ ...form, released_on: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving} icon={editing ? Pencil : WEB_SEARCH_ENABLED ? Sparkles : Plus}>{editing ? 'Save' : WEB_SEARCH_ENABLED ? 'Add & track' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
