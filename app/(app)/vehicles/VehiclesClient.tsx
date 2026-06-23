'use client'

import { useMemo, useState } from 'react'
import { Plus, Car, Pencil, Trash2, ChevronDown, ChevronRight, Fuel, Route, Wrench, FileText, Paperclip, ShieldCheck, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { FilePicker } from '@/components/ui/FilePicker'
import { VehicleDocumentVault } from '@/components/vehicles/VehicleDocumentVault'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { compressImage } from '@/lib/compressImage'
import { VEHICLE_TYPE_LABELS, VEHICLE_DOC_LABELS } from '@/lib/types'
import type { Vehicle, VehicleLog, VehicleType, VehicleLogType, VehicleDocType } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { openDoc as openSignedDoc } from '@/lib/storage'
import { logAction } from '@/lib/audit'
import { useRouter } from 'next/navigation'

const TODAY = new Date().toISOString().slice(0, 10)
const IN30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
function expiryStatus(d?: string | null): 'expired' | 'soon' | 'ok' | 'none' {
  if (!d) return 'none'
  if (d < TODAY) return 'expired'
  if (d <= IN30) return 'soon'
  return 'ok'
}
function compliance(v: Vehicle): { variant: 'green' | 'yellow' | 'red' | 'gray'; label: string } {
  const exps = [...(v.documents ?? []).map(d => d.expiry_date), v.driver_license_expiry]
  if (exps.some(e => e && e < TODAY)) return { variant: 'red', label: 'Docs expired' }
  if (exps.some(e => e && e >= TODAY && e <= IN30)) return { variant: 'yellow', label: 'Expiring soon' }
  if ((v.documents ?? []).length > 0) return { variant: 'green', label: 'Docs OK' }
  return { variant: 'gray', label: 'No docs' }
}

interface Props {
  vehicles: Vehicle[]
  projects: { id: string; name: string }[]
  userId: string
  canDelete: boolean
}

const LOG_META: Record<VehicleLogType, { label: string; icon: typeof Route }> = {
  trip: { label: 'Trip', icon: Route }, fuel: { label: 'Fuel', icon: Fuel }, service: { label: 'Service', icon: Wrench },
}

function tripKm(l: VehicleLog): number {
  if (l.odometer_start != null && l.odometer_end != null && l.odometer_end >= l.odometer_start) return Number(l.odometer_end) - Number(l.odometer_start)
  return Number(l.km || 0)
}

function metrics(v: Vehicle) {
  const logs = v.logs ?? []
  const km = logs.filter(l => l.type === 'trip').reduce((s, l) => s + tripKm(l), 0)
  const fuelLitres = logs.filter(l => l.type === 'fuel').reduce((s, l) => s + Number(l.fuel_litres || 0), 0)
  const fuelCost = logs.filter(l => l.type === 'fuel').reduce((s, l) => s + Number(l.amount || 0), 0)
  const serviceCost = logs.filter(l => l.type === 'service').reduce((s, l) => s + Number(l.amount || 0), 0)
  return { km, fuelLitres, fuelCost, serviceCost, perKm: km > 0 ? fuelCost / km : 0 }
}

const V_EMPTY = { reg_number: '', name: '', vehicle_type: 'car' as VehicleType, ownership: 'owned', owner_name: '', owner_phone: '', hire_rate: '', hire_basis: 'day', driver_name: '', driver_phone: '', driver_union_id: '', driver_license_no: '', driver_license_expiry: '', project_id: '', status: 'active', notes: '' }
const LOG_EMPTY = { log_date: new Date().toISOString().split('T')[0], type: 'trip' as VehicleLogType, odometer_start: '', odometer_end: '', fuel_litres: '', amount: '', purpose: '', driver_name: '', project_id: '' }
const DOC_EMPTY = { doc_type: 'insurance' as VehicleDocType, doc_number: '', issue_date: '', expiry_date: '', notes: '' }

export function VehiclesClient({ vehicles, projects, userId, canDelete }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [form, setForm] = useState(V_EMPTY)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [logVehicle, setLogVehicle] = useState<Vehicle | null>(null)
  const [logForm, setLogForm] = useState(LOG_EMPTY)
  const [savingLog, setSavingLog] = useState(false)
  const [docVehicle, setDocVehicle] = useState<Vehicle | null>(null)
  const [vaultVehicle, setVaultVehicle] = useState<Vehicle | null>(null)
  const [docForm, setDocForm] = useState(DOC_EMPTY)
  const [docFile, setDocFile] = useState<File | null>(null)
  const [savingDoc, setSavingDoc] = useState(false)
  const [extractingDoc, setExtractingDoc] = useState(false)
  const [ownerFilter, setOwnerFilter] = useState('')

  const docsAttention = useMemo(() => vehicles.flatMap(v => v.documents ?? []).filter(d => { const s = expiryStatus(d.expiry_date); return s === 'expired' || s === 'soon' }).length, [vehicles])

  const shown = useMemo(() => vehicles.filter(v => !ownerFilter || v.ownership === ownerFilter), [vehicles, ownerFilter])
  const totals = useMemo(() => vehicles.reduce((acc, v) => {
    const m = metrics(v)
    acc.km += m.km; acc.fuel += m.fuelCost + m.serviceCost
    return acc
  }, { km: 0, fuel: 0 }), [vehicles])
  const activeCount = vehicles.filter(v => v.status === 'active').length

  function openNew() { setEditing(null); setForm(V_EMPTY); setOpen(true) }
  function openEdit(v: Vehicle) {
    setEditing(v)
    setForm({
      reg_number: v.reg_number ?? '', name: v.name ?? '', vehicle_type: v.vehicle_type ?? 'car',
      ownership: v.ownership ?? 'owned', owner_name: v.owner_name ?? '', owner_phone: v.owner_phone ?? '',
      hire_rate: v.hire_rate != null ? String(v.hire_rate) : '', hire_basis: v.hire_basis ?? 'day',
      driver_name: v.driver_name ?? '', driver_phone: v.driver_phone ?? '',
      driver_union_id: v.driver_union_id ?? '', driver_license_no: v.driver_license_no ?? '', driver_license_expiry: v.driver_license_expiry ?? '',
      project_id: v.project_id ?? '', status: v.status ?? 'active', notes: v.notes ?? '',
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.reg_number.trim()) return toast.error('Enter the registration number')
    setSaving(true)
    const supabase = createClient()
    const payload = {
      reg_number: form.reg_number.trim().toUpperCase(), name: form.name || null, vehicle_type: form.vehicle_type,
      ownership: form.ownership, owner_name: form.ownership === 'hired' ? (form.owner_name || null) : null,
      owner_phone: form.ownership === 'hired' ? (form.owner_phone || null) : null,
      hire_rate: form.ownership === 'hired' && form.hire_rate ? parseFloat(form.hire_rate) : null,
      hire_basis: form.ownership === 'hired' ? form.hire_basis : null,
      driver_name: form.driver_name || null, driver_phone: form.driver_phone || null,
      driver_union_id: form.driver_union_id || null, driver_license_no: form.driver_license_no || null,
      driver_license_expiry: form.driver_license_expiry || null,
      project_id: form.project_id || null, status: form.status, notes: form.notes || null,
    }
    if (editing) {
      const { data, error } = await supabase.from('vehicles').update(payload).eq('id', editing.id).select().single()
      if (error) { toast.error("Couldn't update — try again"); setSaving(false); return }
      if (data) await logAction('update', 'vehicles', editing.id, editing as unknown as Record<string, unknown>, data)
      toast.success('Vehicle updated')
    } else {
      const { data, error } = await supabase.from('vehicles').insert({ ...payload, created_by: userId }).select().single()
      if (error) {
        const hint = /relation .*vehicles.* does not exist/i.test(error.message) ? 'run migration-vehicles.sql first' : error.message
        toast.error(`Couldn't save — ${String(hint).slice(0, 80)}`); setSaving(false); return
      }
      if (data) await logAction('create', 'vehicles', data.id, undefined, data)
      toast.success('Vehicle added')
    }
    setSaving(false); setOpen(false); setEditing(null); router.refresh()
  }

  async function handleDelete() {
    if (!editing) return
    if (!window.confirm(`Delete ${editing.reg_number} and all its logs?`)) return
    const supabase = createClient()
    const { error } = await supabase.from('vehicles').delete().eq('id', editing.id)
    if (error) { toast.error("Couldn't delete — try again"); return }
    await logAction('delete', 'vehicles', editing.id, editing as unknown as Record<string, unknown>, undefined)
    toast.success('Vehicle deleted'); setOpen(false); setEditing(null); router.refresh()
  }

  function openLog(v: Vehicle) {
    const lastOdo = (v.logs ?? []).filter(l => l.odometer_end != null).sort((a, b) => b.log_date.localeCompare(a.log_date))[0]?.odometer_end
    setLogVehicle(v)
    setLogForm({ ...LOG_EMPTY, odometer_start: lastOdo != null ? String(lastOdo) : '', driver_name: v.driver_name ?? '', project_id: v.project_id ?? '' })
  }

  async function saveLog(e: React.FormEvent) {
    e.preventDefault()
    if (!logVehicle) return
    setSavingLog(true)
    const supabase = createClient()
    const num = (s: string) => (s === '' ? null : parseFloat(s))
    const payload = {
      vehicle_id: logVehicle.id, log_date: logForm.log_date, type: logForm.type,
      odometer_start: logForm.type === 'trip' ? num(logForm.odometer_start) : null,
      odometer_end: logForm.type === 'trip' ? num(logForm.odometer_end) : null,
      fuel_litres: logForm.type === 'fuel' ? num(logForm.fuel_litres) : null,
      amount: parseFloat(logForm.amount) || 0,
      purpose: logForm.purpose || null, driver_name: logForm.driver_name || null,
      project_id: logForm.project_id || null, created_by: userId,
    }
    const { data, error } = await supabase.from('vehicle_logs').insert(payload).select().single()
    if (error) { toast.error("Couldn't save log — try again"); setSavingLog(false); return }
    if (data) await logAction('create', 'vehicle_logs', data.id, undefined, data)
    toast.success('Log entry added')
    setSavingLog(false); setLogVehicle(null); setExpanded(logVehicle.id); router.refresh()
  }

  async function deleteLog(id: string) {
    if (!window.confirm('Delete this log entry?')) return
    const supabase = createClient()
    const { error } = await supabase.from('vehicle_logs').delete().eq('id', id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'vehicle_logs', id, undefined, undefined)
    router.refresh()
  }

  function openDoc(v: Vehicle) { setDocVehicle(v); setDocForm(DOC_EMPTY); setDocFile(null) }

  // Attach a scan → AI reads the doc number + dates and pre-fills empty fields
  async function handleDocFile(file: File | null) {
    setDocFile(file)
    if (!file) return
    if (!/^image\/(png|jpe?g|gif|webp)$|^application\/pdf$/.test(file.type) || file.size > 6_000_000) return
    setExtractingDoc(true)
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = rej; r.readAsDataURL(file)
      })
      const resp = await fetch('/api/analyze-vehicle-doc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType: file.type, docType: docForm.doc_type }),
      })
      if (!resp.ok) {
        if (resp.status !== 503) { const b = await resp.json().catch(() => ({})); toast.error(b?.detail ? `Read failed: ${String(b.detail).slice(0, 80)}` : "Couldn't read it — fill manually") }
        return
      }
      const { extracted } = await resp.json()
      if (!extracted) return
      setDocForm(prev => ({
        ...prev,
        doc_number: prev.doc_number || (extracted.doc_number ?? ''),
        issue_date: prev.issue_date || (extracted.issue_date ?? ''),
        expiry_date: prev.expiry_date || (extracted.expiry_date ?? ''),
      }))
      toast.success('Read by AI — review the dates')
    } catch { /* network/parse — fill manually */ } finally {
      setExtractingDoc(false)
    }
  }

  async function saveDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!docVehicle) return
    setSavingDoc(true)
    const supabase = createClient()
    let fileUrl: string | undefined
    let fileName: string | undefined
    if (docFile) {
      const upload = docFile.type.startsWith('image/') ? await compressImage(docFile) : docFile
      const ext = upload.name.split('.').pop()
      const path = `vehicles/${docVehicle.id}/${Date.now()}.${ext}`
      const { data: up, error: upErr } = await supabase.storage.from('documents').upload(path, upload)
      if (upErr) { toast.error('File upload failed — check storage bucket'); setSavingDoc(false); return }
      if (up) { fileUrl = supabase.storage.from('documents').getPublicUrl(path).data.publicUrl; fileName = upload.name }
    }
    const { data, error } = await supabase.from('vehicle_documents').insert({
      vehicle_id: docVehicle.id, doc_type: docForm.doc_type, doc_number: docForm.doc_number || null,
      issue_date: docForm.issue_date || null, expiry_date: docForm.expiry_date || null,
      file_url: fileUrl, file_name: fileName, notes: docForm.notes || null, created_by: userId,
    }).select().single()
    if (error) {
      const hint = /relation .*vehicle_documents.* does not exist/i.test(error.message) ? 'run migration-vehicle-docs.sql first' : error.message
      toast.error(`Couldn't save — ${String(hint).slice(0, 80)}`); setSavingDoc(false); return
    }
    if (data) await logAction('create', 'vehicle_documents', data.id, undefined, data)
    toast.success('Document added')
    setSavingDoc(false); setDocVehicle(null); setExpanded(docVehicle.id); router.refresh()
  }

  async function deleteDoc(id: string) {
    if (!window.confirm('Delete this document?')) return
    const supabase = createClient()
    const { error } = await supabase.from('vehicle_documents').delete().eq('id', id)
    if (error) { toast.error("Couldn't delete"); return }
    await logAction('delete', 'vehicle_documents', id, undefined, undefined)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Vehicles" subtitle="Owned & hired production vehicles — trips, fuel & running costs"
        action={<Button icon={Plus} onClick={openNew}>Add Vehicle</Button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Active Vehicles" value={activeCount} status="default" icon={Car} subtitle={`${vehicles.length} total`} />
        <StatCard title="Total KM Logged" value={`${Math.round(totals.km).toLocaleString('en-IN')} km`} status="default" icon={Route} />
        <StatCard title="Fuel & Service Cost" value={formatCurrency(totals.fuel)} status="red" icon={Fuel} />
        <StatCard title="Docs Attention" value={docsAttention} status={docsAttention > 0 ? 'red' : 'green'} icon={ShieldCheck} subtitle="Expired / expiring 30d" />
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-3">
        <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/40">
          <option value="">All vehicles</option>
          <option value="owned">Owned</option>
          <option value="hired">Hired</option>
        </select>
        <span className="text-xs text-[#5a5a7a] ml-auto">{shown.length} shown</span>
      </div>

      {shown.length === 0 ? (
        <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl py-10 text-center text-sm text-[#8888aa]">No vehicles yet. Add your owned and hired vehicles to start logging.</div>
      ) : (
        <div className="space-y-3">
          {shown.map(v => {
            const m = metrics(v)
            const isOpen = expanded === v.id
            const logs = (v.logs ?? []).slice().sort((a, b) => b.log_date.localeCompare(a.log_date))
            return (
              <div key={v.id} className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Car size={15} className="text-white/70 shrink-0" />
                        <span className="text-sm font-semibold text-white">{v.reg_number}</span>
                        {v.name && <span className="text-xs text-[#8888aa]">{v.name}</span>}
                        <StatusBadge label={VEHICLE_TYPE_LABELS[v.vehicle_type]} variant="gray" />
                        <StatusBadge label={v.ownership === 'hired' ? 'Hired' : 'Owned'} variant={v.ownership === 'hired' ? 'yellow' : 'green'} />
                        {(() => { const c = compliance(v); return <StatusBadge label={c.label} variant={c.variant} /> })()}
                        {v.status === 'inactive' && <StatusBadge label="Inactive" variant="gray" />}
                      </div>
                      <div className="text-xs text-[#8888aa] flex flex-wrap gap-x-3 gap-y-0.5">
                        {v.driver_name && <span>Driver: {v.driver_name}{v.driver_phone ? ` · ${v.driver_phone}` : ''}</span>}
                        {v.driver_union_id && <span>Union ID: {v.driver_union_id}</span>}
                        {v.project?.name && <span>📁 {v.project.name}</span>}
                        {v.ownership === 'hired' && v.owner_name && <span>Hired from {v.owner_name}{v.owner_phone ? ` · ${v.owner_phone}` : ''}{v.hire_rate ? ` · ${formatCurrency(v.hire_rate)}/${v.hire_basis}` : ''}</span>}
                      </div>
                    </div>
                    <button onClick={() => openEdit(v)} className="text-[11px] text-[#8888aa] hover:text-white inline-flex items-center gap-1 shrink-0"><Pencil size={11} /> Edit</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    {[['KM run', `${Math.round(m.km).toLocaleString('en-IN')} km`], ['Fuel', `${m.fuelLitres.toFixed(0)} L · ${formatCurrency(m.fuelCost)}`], ['Service', formatCurrency(m.serviceCost)], ['₹ / km', m.perKm ? `₹${m.perKm.toFixed(1)}` : '—']].map(([l, val]) => (
                      <div key={l} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2">
                        <div className="text-[10px] text-[#8888aa] uppercase tracking-wide">{l}</div>
                        <div className="text-sm font-semibold text-white tabular-nums mt-0.5">{val}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-4 flex-wrap">
                    <button onClick={() => { setExpanded(isOpen ? null : v.id) }} className="text-xs text-[#8888aa] hover:text-white inline-flex items-center gap-1">
                      {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Logs ({(v.logs ?? []).length}) · Docs ({(v.documents ?? []).length})
                    </button>
                    <button onClick={() => openLog(v)} className="text-xs text-white/80 hover:text-white inline-flex items-center gap-1"><Plus size={12} /> Add Log</button>
                    <button onClick={() => openDoc(v)} className="text-xs text-white/80 hover:text-white inline-flex items-center gap-1"><FileText size={12} /> Add Document</button>
                    <button onClick={() => setVaultVehicle(v)} className="text-xs text-amber-400/90 hover:text-amber-300 inline-flex items-center gap-1"><ShieldCheck size={12} /> Document Vault</button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[#2a2a3a] bg-[#0f0f16] px-5 py-3 space-y-3">
                    {/* Documents */}
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-[#8888aa] mb-1.5">Documents &amp; Legality</div>
                      {(v.documents ?? []).length === 0 ? (
                        <p className="text-xs text-[#5a5a7a]">No documents — add RC, insurance, PUC, permit, fitness.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {(v.documents ?? []).slice().sort((a, b) => (a.expiry_date ?? '9999').localeCompare(b.expiry_date ?? '9999')).map(d => {
                            const st = expiryStatus(d.expiry_date)
                            const cls = st === 'expired' ? 'text-red-400' : st === 'soon' ? 'text-amber-400' : 'text-[#c8c8da]'
                            return (
                              <div key={d.id} className="flex items-center justify-between gap-3 text-xs">
                                <div className="min-w-0 flex items-center gap-2">
                                  <span className="text-white">{VEHICLE_DOC_LABELS[d.doc_type]}</span>
                                  {d.doc_number && <span className="text-[#8888aa] font-mono">{d.doc_number}</span>}
                                  {d.file_url && <button type="button" onClick={() => openSignedDoc(d.file_url)} className="text-white/60 hover:text-white"><Paperclip size={11} /></button>}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {d.expiry_date && <span className={`tabular-nums ${cls}`}>exp {formatDate(d.expiry_date)}{st === 'expired' ? ' · expired' : st === 'soon' ? ' · soon' : ''}</span>}
                                  <button onClick={() => deleteDoc(d.id)} className="text-[#5a5a7a] hover:text-red-400"><Trash2 size={11} /></button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {v.driver_license_expiry && (
                        <div className="text-xs mt-1.5">
                          <span className="text-[#8888aa]">Driver licence{v.driver_license_no ? ` ${v.driver_license_no}` : ''}: </span>
                          <span className={expiryStatus(v.driver_license_expiry) === 'expired' ? 'text-red-400' : expiryStatus(v.driver_license_expiry) === 'soon' ? 'text-amber-400' : 'text-[#c8c8da]'}>exp {formatDate(v.driver_license_expiry)}</span>
                        </div>
                      )}
                    </div>

                    {/* Logs */}
                    <div className="text-[10px] uppercase tracking-wide text-[#8888aa]">Trip / Fuel / Service Logs</div>
                    {logs.length === 0 ? <p className="text-xs text-[#5a5a7a]">No logs yet.</p> : (
                      <div className="divide-y divide-[#2a2a3a]">
                        {logs.map(l => {
                          const meta = LOG_META[l.type]
                          return (
                            <div key={l.id} className="py-2 flex items-center justify-between gap-3">
                              <div className="min-w-0 flex items-center gap-2">
                                <meta.icon size={13} className="text-[#8888aa] shrink-0" />
                                <div className="min-w-0">
                                  <div className="text-xs text-white">
                                    {meta.label}
                                    {l.type === 'trip' && <span className="text-[#8888aa]"> · {Math.round(tripKm(l))} km{l.odometer_start != null && l.odometer_end != null ? ` (${l.odometer_start}→${l.odometer_end})` : ''}</span>}
                                    {l.type === 'fuel' && l.fuel_litres != null && <span className="text-[#8888aa]"> · {l.fuel_litres} L</span>}
                                    {l.purpose && <span className="text-[#8888aa]"> · {l.purpose}</span>}
                                  </div>
                                  <div className="text-[11px] text-[#5a5a7a]">{formatDate(l.log_date)}{l.driver_name ? ` · ${l.driver_name}` : ''}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {l.amount > 0 && <span className="text-xs font-semibold tabular-nums text-red-400">{formatCurrency(l.amount)}</span>}
                                <button onClick={() => deleteLog(l.id)} className="text-[#5a5a7a] hover:text-red-400"><Trash2 size={12} /></button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add / edit vehicle */}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Vehicle' : 'Add Vehicle'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Registration No. *" value={form.reg_number} onChange={e => setForm({ ...form, reg_number: e.target.value })} required placeholder="e.g. KL 07 AB 1234" />
            <Input label="Model / Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Toyota Innova" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select label="Type" value={form.vehicle_type} onChange={e => setForm({ ...form, vehicle_type: e.target.value as VehicleType })}
              options={(Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[]).map(t => ({ value: t, label: VEHICLE_TYPE_LABELS[t] }))} />
            <Select label="Ownership" value={form.ownership} onChange={e => setForm({ ...form, ownership: e.target.value })}
              options={[{ value: 'owned', label: 'Owned' }, { value: 'hired', label: 'Hired' }]} />
            <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
              options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          </div>
          {form.ownership === 'hired' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Input label="Hired From" value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} placeholder="Owner / vendor" />
              <Input label="Owner Phone" value={form.owner_phone} onChange={e => setForm({ ...form, owner_phone: e.target.value })} />
              <MoneyInput label="Hire Rate (₹)" value={form.hire_rate} onChange={v => setForm({ ...form, hire_rate: v })} />
              <Select label="Per" value={form.hire_basis} onChange={e => setForm({ ...form, hire_basis: e.target.value })}
                options={[{ value: 'day', label: 'Day' }, { value: 'km', label: 'KM' }, { value: 'month', label: 'Month' }, { value: 'trip', label: 'Trip' }]} />
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Input label="Driver Name" value={form.driver_name} onChange={e => setForm({ ...form, driver_name: e.target.value })} />
            <Input label="Driver Phone" value={form.driver_phone} onChange={e => setForm({ ...form, driver_phone: e.target.value })} />
            <Select label="Assigned Project" value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}
              options={[{ value: '', label: '— None —' }, ...projects.map(p => ({ value: p.id, label: p.name }))]} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Driver Union ID" value={form.driver_union_id} onChange={e => setForm({ ...form, driver_union_id: e.target.value })} placeholder="Cinema drivers' union ID" />
            <Input label="Driver Licence No." value={form.driver_license_no} onChange={e => setForm({ ...form, driver_license_no: e.target.value })} />
            <Input label="Licence Expiry" type="date" value={form.driver_license_expiry} onChange={e => setForm({ ...form, driver_license_expiry: e.target.value })} />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex items-center justify-between gap-2 pt-2">
            {editing && canDelete ? (
              <Button variant="ghost" type="button" icon={Trash2} onClick={handleDelete} className="text-red-400 hover:text-red-300">Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={saving}>{editing ? 'Save Changes' : 'Add Vehicle'}</Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Add log */}
      <Modal open={!!logVehicle} onClose={() => setLogVehicle(null)} title={`Log — ${logVehicle?.reg_number ?? ''}`}>
        <form onSubmit={saveLog} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={logForm.type} onChange={e => setLogForm({ ...logForm, type: e.target.value as VehicleLogType })}
              options={[{ value: 'trip', label: 'Trip' }, { value: 'fuel', label: 'Fuel' }, { value: 'service', label: 'Service' }]} />
            <Input label="Date" type="date" value={logForm.log_date} onChange={e => setLogForm({ ...logForm, log_date: e.target.value })} required />
          </div>
          {logForm.type === 'trip' && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Odometer Start" inputMode="decimal" value={logForm.odometer_start} onChange={e => setLogForm({ ...logForm, odometer_start: e.target.value })} />
              <Input label="Odometer End" inputMode="decimal" value={logForm.odometer_end} onChange={e => setLogForm({ ...logForm, odometer_end: e.target.value })} />
            </div>
          )}
          {logForm.type === 'fuel' && (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Litres" inputMode="decimal" value={logForm.fuel_litres} onChange={e => setLogForm({ ...logForm, fuel_litres: e.target.value })} />
              <MoneyInput label="Fuel Cost (₹)" value={logForm.amount} onChange={v => setLogForm({ ...logForm, amount: v })} />
            </div>
          )}
          {logForm.type === 'service' && (
            <MoneyInput label="Service Cost (₹)" value={logForm.amount} onChange={v => setLogForm({ ...logForm, amount: v })} />
          )}
          <Input label={logForm.type === 'trip' ? 'Route / Purpose' : 'Description'} value={logForm.purpose} onChange={e => setLogForm({ ...logForm, purpose: e.target.value })} placeholder={logForm.type === 'trip' ? 'e.g. Kochi → Munnar location' : 'e.g. HP pump / tyre change'} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Driver" value={logForm.driver_name} onChange={e => setLogForm({ ...logForm, driver_name: e.target.value })} />
            <Select label="Project" value={logForm.project_id} onChange={e => setLogForm({ ...logForm, project_id: e.target.value })}
              options={[{ value: '', label: '— None —' }, ...projects.map(p => ({ value: p.id, label: p.name }))]} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setLogVehicle(null)}>Cancel</Button>
            <Button type="submit" loading={savingLog}>Save Log</Button>
          </div>
        </form>
      </Modal>

      {/* Add document */}
      <Modal open={!!docVehicle} onClose={() => setDocVehicle(null)} title={`Document — ${docVehicle?.reg_number ?? ''}`}>
        <form onSubmit={saveDoc} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Document Type" value={docForm.doc_type} onChange={e => setDocForm({ ...docForm, doc_type: e.target.value as VehicleDocType })}
              options={(Object.keys(VEHICLE_DOC_LABELS) as VehicleDocType[]).map(t => ({ value: t, label: VEHICLE_DOC_LABELS[t] }))} />
            <Input label="Document No." value={docForm.doc_number} onChange={e => setDocForm({ ...docForm, doc_number: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Issue Date" type="date" value={docForm.issue_date} onChange={e => setDocForm({ ...docForm, issue_date: e.target.value })} />
            <Input label="Expiry Date" type="date" value={docForm.expiry_date} onChange={e => setDocForm({ ...docForm, expiry_date: e.target.value })} />
          </div>
          <div className="space-y-1">
            <FilePicker label="Scan / Photo" file={docFile} onChange={handleDocFile} accept=".pdf,image/*" />
            {extractingDoc
              ? <p className="text-[11px] text-emerald-400 flex items-center gap-1.5"><Sparkles size={11} className="animate-pulse" /> Reading the document with AI…</p>
              : <p className="text-[11px] text-[#5a5a7a]">Attach the scan — AI fills the number &amp; dates from it.</p>}
          </div>
          <Textarea label="Notes" value={docForm.notes} onChange={e => setDocForm({ ...docForm, notes: e.target.value })} rows={2} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setDocVehicle(null)}>Cancel</Button>
            <Button type="submit" loading={savingDoc}>Save Document</Button>
          </div>
        </form>
      </Modal>

      {/* Document Vault — tabbed, AI-extracted, expiry-tracked */}
      <Modal open={!!vaultVehicle} onClose={() => setVaultVehicle(null)} title={`Document Vault — ${vaultVehicle?.reg_number ?? ''}`} size="lg">
        {vaultVehicle && (
          <VehicleDocumentVault
            vehicleId={vaultVehicle.id}
            vehicleName={vaultVehicle.reg_number ?? vaultVehicle.name ?? ''}
            canDelete={canDelete}
            onChange={() => router.refresh()}
          />
        )}
      </Modal>
    </div>
  )
}
