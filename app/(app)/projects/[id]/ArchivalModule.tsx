'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Upload, ExternalLink, Trophy, Image as ImageIcon, Disc, FileBadge, Archive, Eye } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
import type { ProjectArchival } from '@/lib/types'

const CATEGORIES = [
  { value: 'censor_certificate', label: 'Censor Certificates', icon: FileBadge, desc: 'Official CBFC censor certificates and release permissions.' },
  { value: 'master_copy_log', label: 'Master Copy Logs', icon: Disc, desc: 'Log of high-resolution master drives, audio mixes, and archive tracks.' },
  { value: 'poster', label: 'Posters & Stills', icon: ImageIcon, desc: 'High-resolution official posters, designs, and key movie stills.' },
  { value: 'award', label: 'Awards & Accolades', icon: Trophy, desc: 'Festival screenings, awards, nominations, and laurels.' },
  { value: 'other', label: 'Other Archival Details', icon: Archive, desc: 'Miscellaneous agreements, scripts, and production logs.' }
] as const

export function ArchivalModule({ projectId, canEdit, userId }: { projectId: string; canEdit: boolean; userId: string }) {
  const toast = useToast()
  const supabase = createClient()
  const [items, setItems] = useState<ProjectArchival[]>([])
  const [loading, setLoading] = useState(true)
  
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [f, setF] = useState({ category: 'censor_certificate', title: '', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('project_archival')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      
    if (error) {
      toast.error("Couldn't load archival vault")
    } else {
      setItems((data ?? []) as ProjectArchival[])
    }
    setLoading(false)
  }, [projectId, supabase, toast])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave() {
    if (!f.title) {
      toast.error('Title is required')
      return
    }
    
    setSaving(true)
    let filePath: string | null = null
    let fileName: string | null = null
    
    if (file) {
      const ext = file.name.split('.').pop()
      const path = `archival/${projectId}/${Date.now()}.${ext}`
      const { error: up } = await supabase.storage.from('documents').upload(path, file)
      if (up) {
        toast.error("File upload failed")
        setSaving(false)
        return
      }
      filePath = path
      fileName = file.name
    }

    const { error } = await supabase.from('project_archival').insert({
      project_id: projectId,
      category: f.category,
      title: f.title,
      file_path: filePath,
      file_name: fileName,
      notes: f.notes || null,
      uploaded_by: userId
    })

    setSaving(false)
    if (error) {
      toast.error("Couldn't add archival record")
    } else {
      toast.success('Archival record added')
      setOpen(false)
      setFile(null)
      setF({ category: 'censor_certificate', title: '', notes: '' })
      load()
    }
  }

  async function handleView(item: ProjectArchival) {
    if (!item.file_path) return
    const { data } = await supabase.storage.from('documents').getPublicUrl(item.file_path)
    if (data?.publicUrl) {
      window.open(data.publicUrl, '_blank')
    }
  }

  async function handleDelete(item: ProjectArchival) {
    if (!confirm('Are you sure you want to delete this archival record? This cannot be undone.')) return
    
    if (item.file_path) {
      await supabase.storage.from('documents').remove([item.file_path])
    }
    
    const { error } = await supabase.from('project_archival').delete().eq('id', item.id)
    if (error) {
      toast.error("Failed to delete record")
    } else {
      toast.success('Record deleted')
      load()
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-[#2a2a3a] pb-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Archival Vault & Master Logs</h2>
          <p className="text-xs text-[#8888aa]">Censor certificates, digital master copy logs, posters, and awards archive.</p>
        </div>
        {canEdit && (
          <Button icon={Plus} size="sm" onClick={() => setOpen(true)}>
            Add Archival Record
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-[#8888aa] text-xs">Loading archival vault...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon
            const catItems = items.filter(item => item.category === cat.value)
            
            return (
              <div key={cat.value} className="bg-[#1a1a24] border border-[#2a2a3a] rounded-xl p-4 flex flex-col h-full">
                <div className="flex items-center gap-2 mb-2 border-b border-[#2a2a3a]/40 pb-2">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[#f5b301]">
                    <Icon size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">{cat.label}</h3>
                    <p className="text-[10px] text-[#5a5a7a] line-clamp-1">{cat.desc}</p>
                  </div>
                </div>

                <div className="flex-grow space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {catItems.length === 0 ? (
                    <div className="text-[11px] text-[#5a5a7a] py-6 text-center border border-dashed border-[#2a2a3a] rounded-lg">
                      No records in this category
                    </div>
                  ) : (
                    catItems.map(item => (
                      <div key={item.id} className="bg-[#13131a] border border-[#2c2c3e]/50 rounded-lg p-2.5 flex items-start justify-between gap-3 group">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white/90 truncate">{item.title}</p>
                          {item.notes && (
                            <p className="text-[10px] text-[#8888aa] mt-1 whitespace-pre-wrap line-clamp-2 leading-relaxed">
                              {item.notes}
                            </p>
                          )}
                          {item.file_name && (
                            <p className="text-[9px] text-[#5a5a7a] mt-1 font-mono truncate">
                              Attachment: {item.file_name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.file_path && (
                            <button
                              onClick={() => handleView(item)}
                              className="w-7 h-7 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[#8888aa] hover:text-white transition-all cursor-pointer"
                              title="View Document"
                            >
                              <Eye size={12} />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleDelete(item)}
                              className="w-7 h-7 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Archival Record Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="Add Archival Record">
        <div className="space-y-3">
          <Select
            label="Category *"
            value={f.category}
            onChange={e => setF({ ...f, category: e.target.value })}
            options={CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
          />
          <Input
            label="Record / Asset Title *"
            value={f.title}
            onChange={e => setF({ ...f, title: e.target.value })}
            placeholder="e.g. CBFC Censor Certificate (U/A), Master HDD Vault Log"
            required
          />
          <label className="flex items-center gap-2 text-xs rounded-lg px-3 py-2 cursor-pointer border text-white bg-[#13131a] border-[#2a2a3a] hover:border-white/30">
            <Upload size={14} /> {file ? file.name : 'Upload file (PDF, Image, Video, Log file)'}
            <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Textarea
            label="Description / Master Logs details"
            value={f.notes}
            onChange={e => setF({ ...f, notes: e.target.value })}
            placeholder="e.g. HDD serial, LTO tape backup logs, box office awards, censor certificate details."
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Add to Vault</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
