'use client'

import { useState } from 'react'
import { Plus, Clapperboard } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { formatDate, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { Project } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  projects: Project[]
  userId: string
  role: string
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'development', label: 'Development' },
  { value: 'post_production', label: 'Post Production' },
  { value: 'released', label: 'Released' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_CONFIG: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray'; dot: string }> = {
  active: { label: 'Active', variant: 'green', dot: 'bg-emerald-400' },
  development: { label: 'Development', variant: 'blue', dot: 'bg-blue-400' },
  post_production: { label: 'Post Production', variant: 'purple', dot: 'bg-violet-400' },
  released: { label: 'Released', variant: 'gray', dot: 'bg-gray-400' },
  on_hold: { label: 'On Hold', variant: 'yellow', dot: 'bg-amber-400' },
  cancelled: { label: 'Cancelled', variant: 'red', dot: 'bg-red-400' },
}

const INITIAL_FORM = {
  name: '',
  status: 'development',
  description: '',
  start_date: '',
  end_date: '',
  budget: '',
}

export function ProjectsClient({ projects, userId, role }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(INITIAL_FORM)

  const canCreate = role === 'founder'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const slug = form.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    const { data, error } = await supabase.from('projects').insert({
      name: form.name,
      slug,
      status: form.status,
      description: form.description || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: parseFloat(form.budget) || null,
      created_by: userId,
    }).select().single()

    if (!error && data) await logAction('create', 'projects', data.id, undefined, data)
    setSaving(false)
    setOpen(false)
    setForm(INITIAL_FORM)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="OPM Cinemas film projects"
        action={canCreate ? <Button icon={Plus} onClick={() => setOpen(true)}>New Project</Button> : undefined}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project) => {
          const cfg = STATUS_CONFIG[project.status] ?? { label: project.status, variant: 'gray' as const, dot: 'bg-gray-400' }
          return (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 hover:border-violet-500/30 hover:bg-[#16161f] transition-all cursor-pointer group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center group-hover:bg-violet-600/30 transition-colors">
                    <Clapperboard size={20} className="text-violet-400" />
                  </div>
                  <StatusBadge label={cfg.label} variant={cfg.variant} />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">{project.name}</h3>
                {project.description && (
                  <p className="text-xs text-[#8888aa] line-clamp-2 mb-3">{project.description}</p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-[#5a5a7a]">
                  {project.start_date && <span>From {formatDate(project.start_date)}</span>}
                </div>
              </div>
            </Link>
          )
        })}

        {projects.length === 0 && (
          <div className="col-span-3 py-16 text-center text-[#8888aa] text-sm">
            No projects yet. {canCreate && 'Create your first project.'}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Project">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Project Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Rifle Club 2" />
          <Select label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} options={STATUS_OPTIONS} />
          <Textarea label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            <Input label="End Date" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <Input label="Budget (₹)" type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Project</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
