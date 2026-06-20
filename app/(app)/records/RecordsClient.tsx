'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Music, Plus, Pencil, Trash2, Youtube, Radio, Link2, TrendingUp, DollarSign, Disc, Users, Eye, Upload, FileText, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { OpmRecordTitle, OpmRecordChannel, OpmRecordRoyalty, OpmRecordRelease } from '@/lib/types'
import { RELEASE_STAGE_LABELS } from '@/lib/types'

interface Props {
  titles: OpmRecordTitle[]
  channels: OpmRecordChannel[]
  royalties: OpmRecordRoyalty[]
  releases: OpmRecordRelease[]
  userId: string
  role: string
}

type Tab = 'dashboard' | 'releases' | 'titles' | 'channels' | 'royalties'

const REL_EMPTY = { title: '', release_type: 'single', primary_artist: '', upc: '', release_date: '', distributor: 'Believe', territory: 'Worldwide', stage: 'draft', art_ready: false, audio_ready: false, metadata_ready: false, lyrics_ready: false, rights_cleared: false, distributor_ref: '', notes: '' }
const REL_STAGES: OpmRecordRelease['stage'][] = ['draft', 'metadata', 'assets', 'qc', 'scheduled', 'submitted', 'live', 'takedown']
const STAGE_VARIANT: Record<OpmRecordRelease['stage'], 'gray' | 'yellow' | 'blue' | 'green' | 'red' | 'purple'> = { draft: 'gray', metadata: 'gray', assets: 'yellow', qc: 'yellow', scheduled: 'blue', submitted: 'purple', live: 'green', takedown: 'red' }

export function RecordsClient({ titles, channels, royalties, releases, userId, role }: Props) {
  const router = useRouter()
  const toast = useToast()
  const supabase = createClient()
  const [relModal, setRelModal] = useState(false)
  const [editingRel, setEditingRel] = useState<OpmRecordRelease | null>(null)
  const [relForm, setRelForm] = useState(REL_EMPTY)
  const relToForm = (r: OpmRecordRelease) => ({ title: r.title, release_type: r.release_type, primary_artist: r.primary_artist || '', upc: r.upc || '', release_date: r.release_date || '', distributor: r.distributor || 'Believe', territory: r.territory || 'Worldwide', stage: r.stage, art_ready: r.art_ready, audio_ready: r.audio_ready, metadata_ready: r.metadata_ready, lyrics_ready: r.lyrics_ready, rights_cleared: r.rights_cleared, distributor_ref: r.distributor_ref || '', notes: r.notes || '' })

  async function saveRelease() {
    if (!relForm.title.trim()) { toast.error('Title required'); return }
    const sb = createClient()
    const payload = { ...relForm, primary_artist: relForm.primary_artist || null, upc: relForm.upc || null, release_date: relForm.release_date || null, distributor_ref: relForm.distributor_ref || null, notes: relForm.notes || null }
    if (editingRel) {
      const { error } = await sb.from('opm_records_releases').update(payload).eq('id', editingRel.id)
      if (error) { toast.error("Couldn't save release"); return }
      await logAction('update', 'opm_records_releases', editingRel.id)
    } else {
      const { data, error } = await sb.from('opm_records_releases').insert({ ...payload, label: 'OPM Records', created_by: userId }).select().single()
      if (error) { toast.error("Couldn't save — " + error.message.slice(0, 60)); return }
      if (data) await logAction('create', 'opm_records_releases', data.id)
    }
    setRelModal(false); setEditingRel(null); toast.success('Release saved'); router.refresh()
  }
  async function advanceStage(r: OpmRecordRelease, stage: OpmRecordRelease['stage']) {
    const sb = createClient()
    await sb.from('opm_records_releases').update({ stage }).eq('id', r.id)
    await logAction('update', 'opm_records_releases', r.id, undefined, { stage })
    router.refresh()
  }
  async function deleteRelease(r: OpmRecordRelease) {
    if (!window.confirm(`Delete release "${r.title}"? Its tracks stay in the catalogue.`)) return
    const sb = createClient()
    await sb.from('opm_records_releases').delete().eq('id', r.id)
    await logAction('delete', 'opm_records_releases', r.id)
    toast.success('Release deleted'); router.refresh()
  }
  const [tab, setTab] = useState<Tab>('dashboard')
  
  // Modals state
  const [titleModal, setTitleModal] = useState(false)
  const [editingTitle, setEditingTitle] = useState<OpmRecordTitle | null>(null)
  const [titleForm, setTitleForm] = useState({ title: '', album_movie: '', release_date: '', artists: '', isrc: '', notes: '' })

  const [channelModal, setChannelModal] = useState(false)
  const [editingChannel, setEditingChannel] = useState<OpmRecordChannel | null>(null)
  const [channelForm, setChannelForm] = useState({ name: '', platform: 'youtube', handle: '', url: '', subscriber_count: '', views_count: '', status: 'active', notes: '' })

  const [royaltyModal, setRoyaltyModal] = useState(false)
  const [editingRoyalty, setEditingRoyalty] = useState<OpmRecordRoyalty | null>(null)
  const [royaltyForm, setRoyaltyForm] = useState({ title_id: '', platform: 'youtube', period: '', amount: '', streams_count: '', payout_status: 'pending', notes: '' })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function refreshYouTube() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/records/refresh-youtube', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error === 'not_configured' ? 'Live stats need a YouTube API key on the server.' : (data.error || 'Refresh failed'))
      } else {
        toast.success(`Updated ${data.updated} YouTube channel(s)`); router.refresh()
      }
    } catch { toast.error('Refresh failed') }
    setRefreshing(false)
  }

  // Believe statement import
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importRate, setImportRate] = useState('92')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ period: string; lines: number; inrTotal: number; eurTotal: number; platforms: number; titlesAdded: number } | null>(null)

  async function runImport() {
    if (!importFile) { toast.error('Choose a Believe CSV'); return }
    setImporting(true); setImportResult(null)
    try {
      const csv = await importFile.text()
      const res = await fetch('/api/records/import-statement', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, rate: parseFloat(importRate) || 92, filename: importFile.name }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Import failed'); setImporting(false); return }
      setImportResult(data)
      toast.success(`Imported ${data.period}: ${data.lines} lines, ₹${data.inrTotal.toLocaleString()}`)
      router.refresh()
    } catch { toast.error('Import failed') }
    setImporting(false)
  }

  // Calculations
  const totalRoyalties = royalties.reduce((s, r) => s + Number(r.amount), 0)
  const receivedRoyalties = royalties.filter(r => r.payout_status === 'received').reduce((s, r) => s + Number(r.amount), 0)
  const pendingRoyalties = royalties.filter(r => r.payout_status === 'pending').reduce((s, r) => s + Number(r.amount), 0)
  const totalSubscribers = channels.reduce((s, c) => s + Number(c.subscriber_count ?? 0), 0)
  const totalViews = channels.reduce((s, c) => s + Number(c.views_count ?? 0), 0)

  // Form Handlers
  async function handleTitleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titleForm.title || !titleForm.album_movie) {
      toast.error('Title and Album/Movie are required')
      return
    }
    setSaving(true)
    const core = {
      title: titleForm.title,
      album_movie: titleForm.album_movie,
      release_date: titleForm.release_date || null,
      artists: titleForm.artists || null,
      isrc: titleForm.isrc || null,
      notes: titleForm.notes || null,
    }
    if (editingTitle) {
      const { error } = await supabase.from('opm_records_titles').update(core).eq('id', editingTitle.id)
      if (error) { toast.error("Couldn't update title"); setSaving(false); return }
      await logAction('update', 'opm_records_titles', editingTitle.id, undefined, core)
      toast.success('Title updated')
    } else {
      const { data, error } = await supabase.from('opm_records_titles').insert(core).select().single()
      if (error) { toast.error("Couldn't add title"); setSaving(false); return }
      if (data) await logAction('create', 'opm_records_titles', data.id, undefined, data)
      toast.success('Title added')
    }
    setSaving(false)
    setTitleModal(false)
    setEditingTitle(null)
    router.refresh()
  }

  async function handleChannelSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!channelForm.name || !channelForm.url) {
      toast.error('Channel Name and URL are required')
      return
    }
    setSaving(true)
    const core = {
      name: channelForm.name,
      platform: channelForm.platform,
      handle: channelForm.handle || null,
      url: channelForm.url,
      subscriber_count: parseInt(channelForm.subscriber_count) || 0,
      views_count: parseInt(channelForm.views_count) || 0,
      status: channelForm.status,
      notes: channelForm.notes || null,
    }
    if (editingChannel) {
      const { error } = await supabase.from('opm_records_channels').update(core).eq('id', editingChannel.id)
      if (error) { toast.error("Couldn't update channel"); setSaving(false); return }
      await logAction('update', 'opm_records_channels', editingChannel.id, undefined, core)
      toast.success('Channel updated')
    } else {
      const { data, error } = await supabase.from('opm_records_channels').insert(core).select().single()
      if (error) { toast.error("Couldn't add channel"); setSaving(false); return }
      if (data) await logAction('create', 'opm_records_channels', data.id, undefined, data)
      toast.success('Channel linked')
    }
    setSaving(false)
    setChannelModal(false)
    setEditingChannel(null)
    router.refresh()
  }

  async function handleRoyaltySubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!royaltyForm.period || !royaltyForm.amount) {
      toast.error('Period and Amount are required')
      return
    }
    setSaving(true)
    let filePath: string | null = null
    
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `royalties/${Date.now()}.${ext}`
      const { error: up } = await supabase.storage.from('documents').upload(path, file)
      if (up) { toast.error("Couldn't upload statement"); setSaving(false); return }
      filePath = path
    }

    const core = {
      title_id: royaltyForm.title_id || null,
      platform: royaltyForm.platform,
      period: royaltyForm.period,
      amount: parseFloat(royaltyForm.amount) || 0,
      streams_count: parseInt(royaltyForm.streams_count) || null,
      payout_status: royaltyForm.payout_status,
      statement_file_path: filePath || (editingRoyalty ? editingRoyalty.statement_file_path : null),
      notes: royaltyForm.notes || null,
    }

    if (editingRoyalty) {
      const { error } = await supabase.from('opm_records_royalties').update(core).eq('id', editingRoyalty.id)
      if (error) { toast.error("Couldn't update royalty"); setSaving(false); return }
      await logAction('update', 'opm_records_royalties', editingRoyalty.id, undefined, core)
      toast.success('Royalty entry updated')
    } else {
      const { data, error } = await supabase.from('opm_records_royalties').insert(core).select().single()
      if (error) { toast.error("Couldn't log royalty"); setSaving(false); return }
      if (data) await logAction('create', 'opm_records_royalties', data.id, undefined, data)
      toast.success('Royalty payment logged')
    }
    setSaving(false)
    setRoyaltyModal(false)
    setEditingRoyalty(null)
    setFile(null)
    router.refresh()
  }

  // Deletions
  async function handleDelete(table: 'opm_records_titles' | 'opm_records_channels' | 'opm_records_royalties', id: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return
    
    // If it's a royalty entry and has a file, remove it from storage
    if (table === 'opm_records_royalties') {
      const item = royalties.find(r => r.id === id)
      if (item?.statement_file_path) {
        await supabase.storage.from('documents').remove([item.statement_file_path])
      }
    }

    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) {
      toast.error(`Couldn't delete ${name}`)
    } else {
      toast.success('Item deleted')
      router.refresh()
    }
  }

  async function handleViewStatement(path: string) {
    const { data } = await supabase.storage.from('documents').getPublicUrl(path)
    if (data?.publicUrl) window.open(data.publicUrl, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-1">
        <Music size={16} className="text-[#f5b301]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f5b301]">OPM Records · Separate Company</span>
      </div>
      <PageHeader
        title="OPM Records"
        subtitle="End-to-end professional record label. Proprietor: Aashiq Abu. Managed separately under OPM."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Titles" value={titles.length.toString()} icon={Disc} subtitle="Music tracks catalog" />
        <StatCard title="Total Subscriptions" value={totalSubscribers.toLocaleString()} icon={Users} subtitle={`${channels.length} channels linked`} />
        <StatCard title="Lifetime Royalties" value={formatCurrency(totalRoyalties)} icon={DollarSign} status="green" subtitle={`₹${receivedRoyalties.toLocaleString()} received`} />
        <StatCard title="Pending Royalties" value={formatCurrency(pendingRoyalties)} icon={TrendingUp} status={pendingRoyalties > 0 ? 'yellow' : 'default'} subtitle="Awaiting platform payout" />
      </div>

      {/* Tab Selectors */}
      <div className="flex gap-1 border-b border-[#2a2a3a] overflow-x-auto pb-px">
        {([
          ['dashboard', 'Dashboard', Radio],
          ['releases', 'Release Pipeline', Disc],
          ['titles', 'Music Titles', Disc],
          ['channels', 'YouTube & Channels', Link2],
          ['royalties', 'Royalties & Earnings', DollarSign]
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
              tab === id ? 'border-[#f5b301] text-white' : 'border-transparent text-[#8888aa] hover:text-white'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      
      {/* 1. Dashboard View */}
      {tab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Top Performance Channels</h3>
            <div className="space-y-3">
              {channels.slice(0, 5).map(c => (
                <div key={c.id} className="bg-[#13131a] border border-[#2a2a3a] rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-[#f5b301]">
                      {c.platform === 'youtube' ? <Youtube size={16} /> : <Link2 size={16} />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{c.name}</p>
                      <p className="text-[10px] text-[#8888aa] mt-0.5">{c.handle || c.platform}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white">{c.subscriber_count.toLocaleString()} subs</p>
                    <p className="text-[9px] text-[#5a5a7a] mt-0.5">{c.views_count.toLocaleString()} views</p>
                  </div>
                </div>
              ))}
              {channels.length === 0 && <p className="text-xs text-[#8888aa] text-center py-6">No channels linked yet.</p>}
            </div>
          </div>

          <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Recent Royalties Logs</h3>
            <div className="space-y-3">
              {royalties.slice(0, 5).map(r => (
                <div key={r.id} className="bg-[#13131a] border border-[#2a2a3a] rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {r.title?.title || 'Unknown Track'}
                    </p>
                    <p className="text-[9px] text-[#8888aa] mt-0.5">{r.platform.toUpperCase()} · {r.period}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-400">+{formatCurrency(r.amount)}</p>
                    <p className="text-[9px] mt-0.5">
                      {r.payout_status === 'received' ? (
                        <span className="text-emerald-500 font-semibold flex items-center gap-0.5 justify-end"><CheckCircle2 size={8} /> Paid</span>
                      ) : (
                        <span className="text-amber-500 font-semibold flex items-center gap-0.5 justify-end"><AlertCircle size={8} /> Pending</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
              {royalties.length === 0 && <p className="text-xs text-[#8888aa] text-center py-6">No earnings logged yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Release Pipeline Tab */}
      {tab === 'releases' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#8888aa]">End-to-end release workflow — draft → metadata → assets → QC → scheduled → submitted → live. Distribution is delivered via your distributor (Believe); track the hand-off here.</p>
            <Button icon={Plus} size="sm" onClick={() => { setEditingRel(null); setRelForm(REL_EMPTY); setRelModal(true) }}>New Release</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {REL_STAGES.filter(s => s !== 'takedown' || releases.some(r => r.stage === 'takedown')).map(stage => {
              const items = releases.filter(r => r.stage === stage)
              return (
                <div key={stage} className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-[#2a2a3a] flex items-center justify-between">
                    <StatusBadge label={RELEASE_STAGE_LABELS[stage]} variant={STAGE_VARIANT[stage]} />
                    <span className="text-xs text-[#8888aa]">{items.length}</span>
                  </div>
                  <div className="divide-y divide-[#2a2a3a] flex-1 min-h-[60px]">
                    {items.length === 0 ? <div className="py-6 text-center text-[11px] text-[#5a5a7a]">—</div> : items.map(r => {
                      const ready = [r.art_ready, r.audio_ready, r.metadata_ready, r.lyrics_ready, r.rights_cleared].filter(Boolean).length
                      return (
                        <div key={r.id} className="px-4 py-3 group">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm text-white font-medium leading-snug">{r.title}</div>
                              <div className="text-[11px] text-[#8888aa] mt-0.5">{r.release_type.toUpperCase()} · {r.track_count ?? 0} track{(r.track_count ?? 0) === 1 ? '' : 's'}{r.primary_artist ? ` · ${r.primary_artist}` : ''}</div>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <span className={`text-[10px] ${ready === 5 ? 'text-emerald-400' : 'text-[#8888aa]'}`}>QC {ready}/5</span>
                                {r.release_date && <span className="text-[10px] text-[#5a5a7a]">{formatDate(r.release_date)}</span>}
                                {r.distributor && <span className="text-[10px] text-[#5a5a7a]">· {r.distributor}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingRel(r); setRelForm(relToForm(r)); setRelModal(true) }} className="text-[#8888aa] hover:text-white"><Pencil size={13} /></button>
                              <button onClick={() => deleteRelease(r)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={13} /></button>
                            </div>
                          </div>
                          <select value={r.stage} onChange={e => advanceStage(r, e.target.value as OpmRecordRelease['stage'])}
                            className="mt-2 w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-md px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-white/40">
                            {REL_STAGES.map(s => <option key={s} value={s}>{RELEASE_STAGE_LABELS[s]}</option>)}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 2. Music Titles Tab */}
      {tab === 'titles' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button icon={Plus} size="sm" onClick={() => { setEditingTitle(null); setTitleForm({ title: '', album_movie: '', release_date: '', artists: '', isrc: '', notes: '' }); setTitleModal(true) }}>
              Add Music Title
            </Button>
          </div>
          <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#2a2a3a] text-left">
                <thead className="bg-[#13131a] text-xs text-[#8888aa] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Title / Track</th>
                    <th className="px-5 py-3">Album / Movie</th>
                    <th className="px-5 py-3">Artists</th>
                    <th className="px-5 py-3">ISRC</th>
                    <th className="px-5 py-3">Release Date</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a3a] text-xs text-white/90">
                  {titles.map(t => (
                    <tr key={t.id} className="hover:bg-[#16161f]">
                      <td className="px-5 py-4 font-semibold text-white">{t.title}</td>
                      <td className="px-5 py-4 text-[#8888aa]">{t.album_movie}</td>
                      <td className="px-5 py-4 truncate max-w-[150px]">{t.artists || '—'}</td>
                      <td className="px-5 py-4 font-mono">{t.isrc || '—'}</td>
                      <td className="px-5 py-4">{t.release_date ? formatDate(t.release_date) : '—'}</td>
                      <td className="px-5 py-4 text-right space-x-2.5">
                        <button onClick={() => { setEditingTitle(t); setTitleForm({ title: t.title, album_movie: t.album_movie, release_date: t.release_date || '', artists: t.artists || '', isrc: t.isrc || '', notes: t.notes || '' }); setTitleModal(true) }} className="text-[#8888aa] hover:text-white"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete('opm_records_titles', t.id, t.title)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  {titles.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-[#8888aa]">No music titles in catalog. Add your first title.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Channels Tab */}
      {tab === 'channels' && (
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" icon={RefreshCw} loading={refreshing} onClick={refreshYouTube}>Refresh from YouTube</Button>
            <Button icon={Plus} size="sm" onClick={() => { setEditingChannel(null); setChannelForm({ name: '', platform: 'youtube', handle: '', url: '', subscriber_count: '', views_count: '', status: 'active', notes: '' }); setChannelModal(true) }}>
              Link Channel
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map(c => (
              <div key={c.id} className="bg-[#1a1a24] border border-[#2a2a3a] hover:border-white/10 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-white/5 text-[#f5b301]">
                      {c.platform}
                    </span>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${c.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {c.status}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-0.5">{c.name}</h4>
                  <p className="text-xs text-[#8888aa] mb-4">{c.handle || 'No handle'}</p>

                  <div className="grid grid-cols-2 gap-2 border-t border-[#2a2a3a] pt-3 mb-4">
                    <div>
                      <p className="text-[10px] uppercase text-[#5a5a7a] font-semibold">Subscribers</p>
                      <p className="text-sm font-bold text-white mt-0.5">{c.subscriber_count.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-[#5a5a7a] font-semibold">Total Views</p>
                      <p className="text-sm font-bold text-white mt-0.5">{c.views_count.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-[#2a2a3a] pt-3">
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-[#f5b301] hover:underline flex items-center gap-1">
                    Open Channel <Eye size={12} />
                  </a>
                  <div className="space-x-3">
                    <button onClick={() => { setEditingChannel(c); setChannelForm({ name: c.name, platform: c.platform, handle: c.handle || '', url: c.url, subscriber_count: String(c.subscriber_count), views_count: String(c.views_count), status: c.status, notes: c.notes || '' }); setChannelModal(true) }} className="text-[#8888aa] hover:text-white"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete('opm_records_channels', c.id, c.name)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
            {channels.length === 0 && (
              <div className="col-span-3 text-center py-12 text-[#8888aa] text-xs">No channels linked. Add your YouTube or streaming page details.</div>
            )}
          </div>
        </div>
      )}

      {/* 4. Royalties Tab */}
      {tab === 'royalties' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-[#8888aa]">Import Believe quarterly statements to auto-file royalties + catalogue. Each upload is stored and re-importable.</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" icon={Upload} onClick={() => setImportOpen(true)}>Import Believe statement</Button>
              <Button icon={Plus} size="sm" onClick={() => { setEditingRoyalty(null); setRoyaltyForm({ title_id: '', platform: 'youtube', period: '', amount: '', streams_count: '', payout_status: 'pending', notes: '' }); setRoyaltyModal(true) }}>
                Log Manually
              </Button>
            </div>
          </div>
          <div className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[#2a2a3a] text-left">
                <thead className="bg-[#13131a] text-xs text-[#8888aa] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Music Title</th>
                    <th className="px-5 py-3">Period</th>
                    <th className="px-5 py-3">Platform</th>
                    <th className="px-5 py-3">Streams</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2a2a3a] text-xs text-white/90">
                  {royalties.map(r => (
                    <tr key={r.id} className="hover:bg-[#16161f]">
                      <td className="px-5 py-4 font-semibold text-white">{r.title?.title || 'Catalog-wide payout'}</td>
                      <td className="px-5 py-4">{r.period}</td>
                      <td className="px-5 py-4 uppercase font-mono">{r.platform}</td>
                      <td className="px-5 py-4 font-mono">{r.streams_count ? r.streams_count.toLocaleString() : '—'}</td>
                      <td className="px-5 py-4 font-semibold text-emerald-400">{formatCurrency(r.amount)}</td>
                      <td className="px-5 py-4">
                        {r.payout_status === 'received' ? (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Received</span>
                        ) : (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">Pending</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right space-x-2">
                        {r.statement_file_path && (
                          <button onClick={() => handleViewStatement(r.statement_file_path!)} className="text-[#8888aa] hover:text-white" title="Download Statement"><FileText size={14} /></button>
                        )}
                        <button onClick={() => { setEditingRoyalty(r); setRoyaltyForm({ title_id: r.title_id || '', platform: r.platform, period: r.period, amount: String(r.amount), streams_count: r.streams_count ? String(r.streams_count) : '', payout_status: r.payout_status, notes: r.notes || '' }); setRoyaltyModal(true) }} className="text-[#8888aa] hover:text-white"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete('opm_records_royalties', r.id, `Royalty ${r.period}`)} className="text-[#8888aa] hover:text-red-400"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  {royalties.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-[#8888aa]">No royalty records logged. Create a royalty entry to start tracking revenues.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Forms ── */}

      {/* Believe statement import */}
      <Modal open={importOpen} onClose={() => { setImportOpen(false); setImportResult(null) }} title="Import Believe statement">
        <div className="space-y-3">
          <p className="text-xs text-[#8888aa]">Upload a Believe quarterly royalty statement (CSV). It&apos;s filed for audit, the catalogue is updated (new ISRCs added), and the period&apos;s royalties are written — re-uploading the same quarter replaces it, no duplicates.</p>
          <label className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 cursor-pointer border text-white bg-[#1a1a24] border-[#2a2a3a] hover:border-white/30">
            <Upload size={15} /> {importFile ? importFile.name : 'Choose Believe CSV'}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportResult(null) }} />
          </label>
          <div className="grid grid-cols-2 gap-3 items-end">
            <Input label="EUR → INR rate" type="number" value={importRate} onChange={e => setImportRate(e.target.value)} />
            <Button onClick={runImport} loading={importing} icon={FileText} className="h-9">Import & file</Button>
          </div>
          {importResult && (
            <div className="text-xs bg-[#13131a] border border-emerald-500/25 rounded-lg p-3 space-y-1">
              <div className="text-emerald-400 font-semibold flex items-center gap-1"><CheckCircle2 size={13} /> {importResult.period} imported</div>
              <div className="text-[#c8c8da]">{importResult.lines.toLocaleString()} lines · {importResult.platforms} platforms · €{importResult.eurTotal.toLocaleString()} → ₹{importResult.inrTotal.toLocaleString()}</div>
              <div className="text-[#8888aa]">{importResult.titlesAdded} new track(s) added to the catalogue.</div>
            </div>
          )}
        </div>
      </Modal>

      {/* Release modal */}
      <Modal open={relModal} onClose={() => setRelModal(false)} title={editingRel ? 'Edit Release' : 'New Release'} size="lg">
        <div className="space-y-3">
          <Input label="Release title *" value={relForm.title} onChange={e => setRelForm({ ...relForm, title: e.target.value })} placeholder="e.g. Neelavelicham (Original Soundtrack)" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={relForm.release_type} onChange={e => setRelForm({ ...relForm, release_type: e.target.value })} options={[{ value: 'single', label: 'Single' }, { value: 'ep', label: 'EP' }, { value: 'album', label: 'Album' }, { value: 'compilation', label: 'Compilation' }]} />
            <Input label="Primary artist" value={relForm.primary_artist} onChange={e => setRelForm({ ...relForm, primary_artist: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="UPC" value={relForm.upc} onChange={e => setRelForm({ ...relForm, upc: e.target.value })} />
            <Input label="Release date" type="date" value={relForm.release_date} onChange={e => setRelForm({ ...relForm, release_date: e.target.value })} />
            <Select label="Stage" value={relForm.stage} onChange={e => setRelForm({ ...relForm, stage: e.target.value })} options={REL_STAGES.map(s => ({ value: s, label: RELEASE_STAGE_LABELS[s] }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Distributor" value={relForm.distributor} onChange={e => setRelForm({ ...relForm, distributor: e.target.value })} />
            <Input label="Territory" value={relForm.territory} onChange={e => setRelForm({ ...relForm, territory: e.target.value })} />
            <Input label="Distributor ref" value={relForm.distributor_ref} onChange={e => setRelForm({ ...relForm, distributor_ref: e.target.value })} placeholder="external release id" />
          </div>
          <div className="rounded-lg border border-[#2a2a3a] bg-[#13131a] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#f5b301] mb-2">Delivery QC checklist</p>
            <div className="grid grid-cols-2 gap-2">
              {([['art_ready', 'Cover art'], ['audio_ready', 'Masters / audio'], ['metadata_ready', 'Metadata + ISRC'], ['lyrics_ready', 'Lyrics'], ['rights_cleared', 'Rights cleared']] as const).map(([k, lbl]) => (
                <label key={k} className="flex items-center gap-2 text-sm text-white cursor-pointer">
                  <input type="checkbox" checked={relForm[k] as boolean} onChange={e => setRelForm({ ...relForm, [k]: e.target.checked })} className="h-4 w-4 accent-amber-400" /> {lbl}
                </label>
              ))}
            </div>
          </div>
          <Textarea label="Notes" value={relForm.notes} onChange={e => setRelForm({ ...relForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setRelModal(false)}>Cancel</Button><Button onClick={saveRelease}>{editingRel ? 'Save' : 'Create Release'}</Button></div>
        </div>
      </Modal>

      {/* 1. Add/Edit Title Modal */}
      <Modal open={titleModal} onClose={() => setTitleModal(false)} title={editingTitle ? 'Edit Music Title' : 'Add Music Title'}>
        <form onSubmit={handleTitleSubmit} className="space-y-4">
          <Input label="Track / Title Name *" value={titleForm.title} onChange={e => setTitleForm({ ...titleForm, title: e.target.value })} required placeholder="e.g. Neelavelicham Title Track" />
          <Input label="Album / Movie Name *" value={titleForm.album_movie} onChange={e => setTitleForm({ ...titleForm, album_movie: e.target.value })} required placeholder="e.g. Neelavelicham" />
          <Input label="Release Date" type="date" value={titleForm.release_date} onChange={e => setTitleForm({ ...titleForm, release_date: e.target.value })} />
          <Input label="Artists (comma-separated)" value={titleForm.artists} onChange={e => setTitleForm({ ...titleForm, artists: e.target.value })} placeholder="e.g. Bijibal, Shahabaz Aman" />
          <Input label="ISRC Code" value={titleForm.isrc} onChange={e => setTitleForm({ ...titleForm, isrc: e.target.value })} placeholder="e.g. IN-A12-23-00001" />
          <Textarea label="Notes" value={titleForm.notes} onChange={e => setTitleForm({ ...titleForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setTitleModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingTitle ? 'Save' : 'Add'}</Button>
          </div>
        </form>
      </Modal>

      {/* 2. Add/Edit Channel Modal */}
      <Modal open={channelModal} onClose={() => setChannelModal(false)} title={editingChannel ? 'Edit Channel Details' : 'Link Channel'}>
        <form onSubmit={handleChannelSubmit} className="space-y-4">
          <Input label="Channel Name *" value={channelForm.name} onChange={e => setChannelForm({ ...channelForm, name: e.target.value })} required placeholder="e.g. OPM Records Official" />
          <Select
            label="Platform"
            value={channelForm.platform}
            onChange={e => setChannelForm({ ...channelForm, platform: e.target.value })}
            options={[
              { value: 'youtube', label: 'YouTube' },
              { value: 'spotify', label: 'Spotify' },
              { value: 'apple_music', label: 'Apple Music' },
              { value: 'instagram', label: 'Instagram' },
              { value: 'facebook', label: 'Facebook' },
              { value: 'other', label: 'Other' }
            ]}
          />
          <Input label="Handle" value={channelForm.handle} onChange={e => setChannelForm({ ...channelForm, handle: e.target.value })} placeholder="e.g. @opmrecords" />
          <Input label="URL *" value={channelForm.url} onChange={e => setChannelForm({ ...channelForm, url: e.target.value })} required placeholder="e.g. https://youtube.com/@opmrecords" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Subscriber Count" type="number" value={channelForm.subscriber_count} onChange={e => setChannelForm({ ...channelForm, subscriber_count: e.target.value })} />
            <Input label="Views Count" type="number" value={channelForm.views_count} onChange={e => setChannelForm({ ...channelForm, views_count: e.target.value })} />
          </div>
          <Select label="Status" value={channelForm.status} onChange={e => setChannelForm({ ...channelForm, status: e.target.value })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          <Textarea label="Notes" value={channelForm.notes} onChange={e => setChannelForm({ ...channelForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setChannelModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingChannel ? 'Save' : 'Link'}</Button>
          </div>
        </form>
      </Modal>

      {/* 3. Add/Edit Royalty Modal */}
      <Modal open={royaltyModal} onClose={() => setRoyaltyModal(false)} title={editingRoyalty ? 'Edit Royalty Record' : 'Log Royalty Payment'}>
        <form onSubmit={handleRoyaltySubmit} className="space-y-4">
          <Select
            label="Associate Music Title (Optional)"
            value={royaltyForm.title_id}
            onChange={e => setRoyaltyForm({ ...royaltyForm, title_id: e.target.value })}
            options={[
              { value: '', label: 'General / Catalog-wide Payout' },
              ...titles.map(t => ({ value: t.id, label: `${t.title} (${t.album_movie})` }))
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Platform *"
              value={royaltyForm.platform}
              onChange={e => setRoyaltyForm({ ...royaltyForm, platform: e.target.value })}
              options={[
                { value: 'youtube', label: 'YouTube ContentID' },
                { value: 'spotify', label: 'Spotify' },
                { value: 'apple_music', label: 'Apple Music' },
                { value: 'distrokid', label: 'DistroKid' },
                { value: 'other', label: 'Other Platform' }
              ]}
            />
            <Input label="Period (YYYY-MM) *" value={royaltyForm.period} onChange={e => setRoyaltyForm({ ...royaltyForm, period: e.target.value })} placeholder="e.g. 2026-05" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Royalty Amount (₹) *" value={royaltyForm.amount} onChange={v => setRoyaltyForm({ ...royaltyForm, amount: v })} required />
            <Input label="Streams Count (optional)" type="number" value={royaltyForm.streams_count} onChange={e => setRoyaltyForm({ ...royaltyForm, streams_count: e.target.value })} placeholder="e.g. 450000" />
          </div>
          <Select
            label="Payout Status"
            value={royaltyForm.payout_status}
            onChange={e => setRoyaltyForm({ ...royaltyForm, payout_status: e.target.value })}
            options={[{ value: 'pending', label: 'Pending / Receivable' }, { value: 'received', label: 'Received in Bank' }]}
          />
          
          <label className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 cursor-pointer border text-white bg-[#13131a] border-[#2a2a3a] hover:border-white/30">
            <Upload size={14} /> {file ? file.name : 'Upload PDF Statement (Optional)'}
            <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>

          <Textarea label="Notes" value={royaltyForm.notes} onChange={e => setRoyaltyForm({ ...royaltyForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setRoyaltyModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingRoyalty ? 'Save Changes' : 'Log Earnings'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
