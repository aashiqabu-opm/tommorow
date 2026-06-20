'use client'

import { useState, useMemo } from 'react'
import { Share2, Plus, Pencil, Trash2, Instagram, Youtube, Facebook, Globe, CalendarClock, Send, FileEdit, Lightbulb, CheckCircle2, ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import { formatDate } from '@/lib/utils'
import { SOCIAL_POST_STATUS_LABELS, type SocialAccount, type SocialPost } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props { accounts: SocialAccount[]; posts: SocialPost[]; userId: string; role: string }

const STATUS_ORDER: SocialPost['status'][] = ['idea', 'draft', 'scheduled', 'published']
const STATUS_VARIANT: Record<SocialPost['status'], 'gray' | 'yellow' | 'blue' | 'green' | 'purple'> = { idea: 'gray', draft: 'yellow', scheduled: 'blue', published: 'green', archived: 'gray' }
const PLAT_ICON: Record<string, typeof Globe> = { instagram: Instagram, youtube: Youtube, facebook: Facebook }
const POST_EMPTY = { title: '', caption: '', account_id: '', post_type: 'post', status: 'idea', scheduled_at: '', link: '', notes: '' }
const ACC_EMPTY = { platform: 'instagram', name: '', handle: '', url: '', entity: 'OPM Cinemas Proprietorship', followers: '', status: 'active', notes: '' }

export function SocialClient({ accounts, posts, userId, role }: Props) {
  const router = useRouter()
  const toast = useToast()
  const canPost = ['founder', 'general_manager', 'executive_producer', 'staff'].includes(role)
  const canManageAcc = ['founder', 'general_manager', 'executive_producer'].includes(role)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<SocialPost | null>(null)
  const [form, setForm] = useState(POST_EMPTY)
  const [accOpen, setAccOpen] = useState(false)
  const [editingAcc, setEditingAcc] = useState<SocialAccount | null>(null)
  const [accForm, setAccForm] = useState(ACC_EMPTY)
  const [saving, setSaving] = useState(false)

  const now = new Date().toISOString()
  const scheduled = posts.filter(p => p.status === 'scheduled')
  const upcoming = scheduled.filter(p => p.scheduled_at && p.scheduled_at >= now)
  const drafts = posts.filter(p => p.status === 'draft' || p.status === 'idea')
  const publishedThisMonth = posts.filter(p => p.status === 'published' && p.published_at && p.published_at.slice(0, 7) === now.slice(0, 7))
  const grouped = useMemo(() => STATUS_ORDER.map(s => ({ s, items: posts.filter(p => p.status === s) })), [posts])

  function openNew() { setEditing(null); setForm(POST_EMPTY); setOpen(true) }
  function openEdit(p: SocialPost) {
    setEditing(p)
    setForm({ title: p.title, caption: p.caption ?? '', account_id: p.account_id ?? '', post_type: p.post_type, status: p.status, scheduled_at: p.scheduled_at ? p.scheduled_at.slice(0, 16) : '', link: p.link ?? '', notes: p.notes ?? '' })
    setOpen(true)
  }

  async function save() {
    if (!form.title.trim()) return toast.error('Title required')
    setSaving(true)
    const sb = createClient()
    const acc = accounts.find(a => a.id === form.account_id)
    const payload: Record<string, unknown> = {
      title: form.title.trim(), caption: form.caption || null, account_id: form.account_id || null,
      platform: acc?.platform ?? null, post_type: form.post_type, status: form.status,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      link: form.link || null, notes: form.notes || null,
      published_at: form.status === 'published' ? (editing?.published_at ?? new Date().toISOString()) : null,
    }
    if (editing) {
      const { error } = await sb.from('social_posts').update(payload).eq('id', editing.id)
      if (error) { toast.error("Couldn't save"); setSaving(false); return }
      await logAction('update', 'social_posts', editing.id)
    } else {
      const { data, error } = await sb.from('social_posts').insert({ ...payload, created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save — " + error.message.slice(0, 60)); setSaving(false); return }
      if (data) await logAction('create', 'social_posts', data.id)
    }
    setSaving(false); setOpen(false); setEditing(null); toast.success('Post saved'); router.refresh()
  }
  async function setStatus(p: SocialPost, status: SocialPost['status']) {
    const sb = createClient()
    await sb.from('social_posts').update({ status, published_at: status === 'published' ? (p.published_at ?? new Date().toISOString()) : p.published_at }).eq('id', p.id)
    await logAction('update', 'social_posts', p.id, undefined, { status })
    router.refresh()
  }
  async function remove(p: SocialPost) {
    if (!confirm(`Delete "${p.title}"?`)) return
    const sb = createClient(); await sb.from('social_posts').delete().eq('id', p.id)
    await logAction('delete', 'social_posts', p.id); toast.success('Deleted'); router.refresh()
  }

  async function saveAcc() {
    if (!accForm.name.trim()) return toast.error('Name required')
    setSaving(true)
    const sb = createClient()
    const payload = { ...accForm, followers: parseInt(accForm.followers) || 0, handle: accForm.handle || null, url: accForm.url || null, notes: accForm.notes || null }
    if (editingAcc) { await sb.from('social_accounts').update(payload).eq('id', editingAcc.id); await logAction('update', 'social_accounts', editingAcc.id) }
    else { const { data } = await sb.from('social_accounts').insert({ ...payload, created_by: userId }).select().single(); if (data) await logAction('create', 'social_accounts', data.id) }
    setSaving(false); setAccOpen(false); setEditingAcc(null); setAccForm(ACC_EMPTY); toast.success('Account saved'); router.refresh()
  }
  async function removeAcc(a: SocialAccount) {
    if (!confirm(`Remove ${a.name} (${a.platform})?`)) return
    const sb = createClient(); await sb.from('social_accounts').delete().eq('id', a.id); await logAction('delete', 'social_accounts', a.id); router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Social Media" subtitle="Plan, schedule and track posts across OPM's channels"
        action={canPost ? <Button icon={Plus} onClick={openNew}>New Post</Button> : undefined} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Scheduled" value={upcoming.length} icon={CalendarClock} status={upcoming.length > 0 ? 'yellow' : 'green'} subtitle="Upcoming" />
        <StatCard title="In Draft" value={drafts.length} icon={FileEdit} status="default" />
        <StatCard title="Published (mo.)" value={publishedThisMonth.length} icon={Send} status="green" />
        <StatCard title="Channels" value={accounts.length} icon={Share2} status="default" />
      </div>

      {/* Accounts */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center justify-between">
          <div className="flex items-center gap-2"><Share2 size={16} className="text-white/70" /><h3 className="text-sm font-semibold text-white">Channels</h3></div>
          {canManageAcc && <Button size="sm" variant="secondary" icon={Plus} onClick={() => { setEditingAcc(null); setAccForm(ACC_EMPTY); setAccOpen(true) }}>Add Channel</Button>}
        </div>
        {accounts.length === 0 ? <div className="py-8 text-center text-sm text-[#8888aa]">No channels linked yet.</div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 divide-[#2a2a3a]">
            {accounts.map(a => { const Icon = PLAT_ICON[a.platform] ?? Globe; return (
              <div key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-3 border-[#2a2a3a] sm:border-r">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon size={18} className="text-[#8888aa] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{a.name} <span className="text-[#8888aa]">{a.handle}</span></div>
                    <div className="text-[11px] text-[#8888aa]">{a.entity}{a.followers ? ` · ${a.followers.toLocaleString()} followers` : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="text-[#8888aa] hover:text-white"><ExternalLink size={14} /></a>}
                  {canManageAcc && <><button onClick={() => { setEditingAcc(a); setAccForm({ platform: a.platform, name: a.name, handle: a.handle ?? '', url: a.url ?? '', entity: a.entity ?? '', followers: String(a.followers || ''), status: a.status, notes: a.notes ?? '' }); setAccOpen(true) }} className="text-[#8888aa] hover:text-white"><Pencil size={13} /></button>
                  <button onClick={() => removeAcc(a)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={13} /></button></>}
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Content planner */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {grouped.map(({ s, items }) => (
          <div key={s} className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center justify-between">
              <div className="flex items-center gap-2">
                {s === 'idea' ? <Lightbulb size={13} className="text-[#8888aa]" /> : s === 'published' ? <CheckCircle2 size={13} className="text-emerald-400/70" /> : null}
                <StatusBadge label={SOCIAL_POST_STATUS_LABELS[s]} variant={STATUS_VARIANT[s]} /><span className="text-xs text-[#8888aa]">{items.length}</span>
              </div>
            </div>
            <div className="divide-y divide-[#2a2a3a] flex-1 min-h-[60px]">
              {items.length === 0 ? <div className="py-6 text-center text-[11px] text-[#5a5a7a]">—</div> : items.map(p => (
                <div key={p.id} className="px-4 py-3 group">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm text-white leading-snug">{p.title}</div>
                      <div className="text-[11px] text-[#8888aa] mt-0.5">{p.account?.name ? `${p.account.name} · ` : ''}{p.post_type}</div>
                      {p.scheduled_at && <div className="text-[11px] text-[#5a5a7a] mt-0.5 flex items-center gap-1"><CalendarClock size={10} /> {formatDate(p.scheduled_at)}</div>}
                    </div>
                    {canPost && (
                      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {p.link && <a href={p.link} target="_blank" rel="noreferrer" className="text-[#8888aa] hover:text-white"><ExternalLink size={12} /></a>}
                        <button onClick={() => openEdit(p)} className="text-[#8888aa] hover:text-white"><Pencil size={13} /></button>
                        <button onClick={() => remove(p)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                  {canPost && (
                    <select value={p.status} onChange={e => setStatus(p, e.target.value as SocialPost['status'])}
                      className="mt-2 w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-md px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-white/40">
                      {STATUS_ORDER.map(o => <option key={o} value={o}>{SOCIAL_POST_STATUS_LABELS[o]}</option>)}
                      <option value="archived">Archived</option>
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Post modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Post' : 'New Post'}>
        <div className="space-y-3">
          <Input label="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Rifle Club teaser drop" />
          <Textarea label="Caption" value={form.caption} onChange={e => setForm({ ...form, caption: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Channel" value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })}
              options={[{ value: '', label: '— Select —' }, ...accounts.map(a => ({ value: a.id, label: `${a.name} (${a.platform})` }))]} />
            <Select label="Type" value={form.post_type} onChange={e => setForm({ ...form, post_type: e.target.value })}
              options={[{ value: 'post', label: 'Post' }, { value: 'reel', label: 'Reel' }, { value: 'story', label: 'Story' }, { value: 'short', label: 'Short' }, { value: 'video', label: 'Video' }, { value: 'carousel', label: 'Carousel' }, { value: 'tweet', label: 'Tweet' }]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STATUS_ORDER.map(s => ({ value: s, label: SOCIAL_POST_STATUS_LABELS[s] }))} />
            <Input label="Schedule for" type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
          </div>
          <Input label="Link (once published)" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} placeholder="https://…" />
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} loading={saving}>{editing ? 'Save' : 'Add Post'}</Button></div>
        </div>
      </Modal>

      {/* Account modal */}
      <Modal open={accOpen} onClose={() => setAccOpen(false)} title={editingAcc ? 'Edit Channel' : 'Add Channel'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Platform" value={accForm.platform} onChange={e => setAccForm({ ...accForm, platform: e.target.value })}
              options={[{ value: 'instagram', label: 'Instagram' }, { value: 'facebook', label: 'Facebook' }, { value: 'youtube', label: 'YouTube' }, { value: 'x', label: 'X / Twitter' }, { value: 'threads', label: 'Threads' }, { value: 'linkedin', label: 'LinkedIn' }, { value: 'other', label: 'Other' }]} />
            <Input label="Name *" value={accForm.name} onChange={e => setAccForm({ ...accForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Handle" value={accForm.handle} onChange={e => setAccForm({ ...accForm, handle: e.target.value })} placeholder="@…" />
            <Input label="Followers" type="number" value={accForm.followers} onChange={e => setAccForm({ ...accForm, followers: e.target.value })} />
          </div>
          <Input label="URL" value={accForm.url} onChange={e => setAccForm({ ...accForm, url: e.target.value })} />
          <Input label="Entity / brand" value={accForm.entity} onChange={e => setAccForm({ ...accForm, entity: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setAccOpen(false)}>Cancel</Button><Button onClick={saveAcc} loading={saving}>{editingAcc ? 'Save' : 'Add'}</Button></div>
        </div>
      </Modal>
    </div>
  )
}
