'use client'

import { useState } from 'react'
import { Users, UserCheck, UserX } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Select } from '@/components/ui/Input'
import { formatDate } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { logAction } from '@/lib/audit'
import type { Profile, Role } from '@/lib/types'
import { useRouter } from 'next/navigation'

interface Props {
  profiles: Profile[]
  currentUserId: string
}

const ROLE_OPTIONS = [
  { value: 'founder', label: 'Founder / Owner' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'executive_producer', label: 'Executive Producer' },
  { value: 'production_manager', label: 'Production Manager' },
  { value: 'legal_viewer', label: 'Legal / CA Viewer' },
]

const ROLE_LABELS: Record<Role, string> = {
  founder: 'Founder',
  accountant: 'Accountant',
  executive_producer: 'Executive Producer',
  production_manager: 'Production Manager',
  legal_viewer: 'Legal / CA Viewer',
}

const ROLE_VARIANTS: Record<Role, 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray'> = {
  founder: 'purple',
  accountant: 'blue',
  executive_producer: 'green',
  production_manager: 'yellow',
  legal_viewer: 'gray',
}

export function UsersClient({ profiles, currentUserId }: Props) {
  const router = useRouter()
  const [updating, setUpdating] = useState<string | null>(null)

  const active = profiles.filter(p => p.is_active)
  const inactive = profiles.filter(p => !p.is_active)

  async function updateRole(profileId: string, role: Role) {
    setUpdating(profileId)
    const supabase = createClient()
    const old = profiles.find(p => p.id === profileId)
    await supabase.from('profiles').update({ role, updated_at: new Date().toISOString() }).eq('id', profileId)
    await logAction('update', 'profiles', profileId, { role: old?.role }, { role })
    setUpdating(null)
    router.refresh()
  }

  async function toggleActive(profileId: string, isActive: boolean) {
    if (profileId === currentUserId) return
    setUpdating(profileId)
    const supabase = createClient()
    await supabase.from('profiles').update({ is_active: !isActive }).eq('id', profileId)
    await logAction('update', 'profiles', profileId, { is_active: isActive }, { is_active: !isActive })
    setUpdating(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" subtitle="Manage team access and roles" />

      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Total Users" value={profiles.length} icon={Users} status="default" />
        <StatCard title="Active" value={active.length} icon={UserCheck} status="green" />
        <StatCard title="Inactive" value={inactive.length} icon={UserX} status={inactive.length > 0 ? 'yellow' : 'green'} />
      </div>

      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2a3a]">
          <h3 className="text-sm font-semibold text-white">All Users</h3>
        </div>
        <div className="divide-y divide-[#2a2a3a]">
          {profiles.map((profile) => (
            <div key={profile.id} className="px-5 py-4 flex items-center gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-violet-600/30 flex items-center justify-center text-sm font-bold text-violet-300 shrink-0">
                {profile.full_name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-white">{profile.full_name}</span>
                  {profile.id === currentUserId && <StatusBadge label="You" variant="purple" />}
                  {!profile.is_active && <StatusBadge label="Inactive" variant="red" />}
                </div>
                <div className="text-xs text-[#8888aa]">{profile.email} · Joined {formatDate(profile.created_at)}</div>
              </div>

              {/* Role selector */}
              <div className="w-48 shrink-0">
                <select
                  value={profile.role}
                  onChange={e => updateRole(profile.id, e.target.value as Role)}
                  disabled={updating === profile.id || profile.id === currentUserId}
                  className="w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500/60 disabled:opacity-50"
                >
                  {ROLE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} className="bg-[#1a1a24]">{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Active toggle */}
              <button
                onClick={() => toggleActive(profile.id, profile.is_active)}
                disabled={profile.id === currentUserId || updating === profile.id}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                  profile.is_active
                    ? 'text-red-400 border-red-500/20 hover:bg-red-500/10'
                    : 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10'
                }`}
              >
                {profile.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
          {profiles.length === 0 && (
            <div className="py-8 text-center text-[#8888aa] text-sm">No users found</div>
          )}
        </div>
      </div>

      <div className="bg-[#13131a] border border-amber-500/20 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-amber-400 mb-3">Access Control Summary</h3>
        <div className="space-y-2 text-xs text-[#8888aa]">
          <p><span className="text-violet-400 font-medium">Founder</span> — Full access to all modules including finance, users, settings</p>
          <p><span className="text-blue-400 font-medium">Accountant</span> — Finance, cash, liabilities, payments, reports</p>
          <p><span className="text-green-400 font-medium">Executive Producer</span> — Assigned project documents and payment request status</p>
          <p><span className="text-amber-400 font-medium">Production Manager</span> — Upload bills, receipts, documents; create payment requests</p>
          <p><span className="text-gray-400 font-medium">Legal / CA Viewer</span> — Read-only access to selected documents and reports</p>
        </div>
      </div>
    </div>
  )
}
