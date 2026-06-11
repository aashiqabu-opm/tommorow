'use client'

import { useState } from 'react'
import { Shield, Clock, BellRing } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatRelative } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  profile: Record<string, unknown>
  auditLogs: Record<string, unknown>[]
}

const ACTION_ICONS: Record<string, string> = {
  create: '➕',
  update: '✏️',
  delete: '🗑️',
  upload: '📎',
  approve: '✅',
  reject: '❌',
}

export function SettingsClient({ profile, auditLogs }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState((profile.full_name as string) ?? '')
  const [saved, setSaved] = useState(false)
  const [emailAlerts, setEmailAlerts] = useState(Boolean(profile.email_alerts ?? true))
  const [whatsappAlerts, setWhatsappAlerts] = useState(Boolean(profile.whatsapp_alerts ?? false))
  const [whatsappNumber, setWhatsappNumber] = useState((profile.whatsapp_number as string) ?? '')
  const [alertsSaving, setAlertsSaving] = useState(false)
  const [alertsSaved, setAlertsSaved] = useState(false)

  async function handleSaveAlerts(e: React.FormEvent) {
    e.preventDefault()
    setAlertsSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({
      email_alerts: emailAlerts,
      whatsapp_alerts: whatsappAlerts,
      whatsapp_number: whatsappNumber.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.id as string)
    setAlertsSaving(false)
    setAlertsSaved(true)
    setTimeout(() => setAlertsSaved(false), 2000)
    router.refresh()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    await supabase.from('profiles').update({ full_name: name, updated_at: new Date().toISOString() }).eq('id', profile.id as string)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Profile and system configuration" />

      {/* Profile */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Profile</h3>
        <form onSubmit={handleSave} className="space-y-4 max-w-md">
          <Input
            label="Full Name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#8888aa]">Email</label>
            <div className="text-sm text-[#5a5a7a] bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2">
              {profile.email as string}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#8888aa]">Role</label>
            <div className="text-sm text-[#5a5a7a] bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2 capitalize">
              {(profile.role as string)?.replace(/_/g, ' ')}
            </div>
          </div>
          <Button type="submit" loading={saving}>
            {saved ? '✓ Saved' : 'Save Changes'}
          </Button>
        </form>
      </div>

      {/* Alerts */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BellRing size={16} className="text-white/70" />
          <h3 className="text-sm font-semibold text-white">Alerts</h3>
        </div>
        <form onSubmit={handleSaveAlerts} className="space-y-4 max-w-md">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm text-white">Email alerts</div>
              <div className="text-xs text-[#8888aa]">Payment requests, approvals and the daily digest, sent to {profile.email as string}</div>
            </div>
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={e => setEmailAlerts(e.target.checked)}
              className="h-4 w-4 accent-white shrink-0"
            />
          </label>
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <div className="text-sm text-white">WhatsApp alerts</div>
              <div className="text-xs text-[#8888aa]">Same alerts on WhatsApp (requires number below)</div>
            </div>
            <input
              type="checkbox"
              checked={whatsappAlerts}
              onChange={e => setWhatsappAlerts(e.target.checked)}
              className="h-4 w-4 accent-white shrink-0"
            />
          </label>
          <Input
            label="WhatsApp Number"
            placeholder="+91XXXXXXXXXX"
            value={whatsappNumber}
            onChange={e => setWhatsappNumber(e.target.value)}
          />
          <Button type="submit" loading={alertsSaving}>
            {alertsSaved ? '✓ Saved' : 'Save Alert Preferences'}
          </Button>
        </form>
      </div>

      {/* Security */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={16} className="text-white/70" />
          <h3 className="text-sm font-semibold text-white">Security</h3>
        </div>
        <div className="text-xs text-[#8888aa] space-y-2">
          <p>Your account is protected by Supabase Authentication.</p>
          <p>To change your password, sign out and use the "Forgot Password" flow.</p>
        </div>
      </div>

      {/* Audit Log */}
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2a3a] flex items-center gap-2">
          <Clock size={16} className="text-white/70" />
          <h3 className="text-sm font-semibold text-white">Activity Log</h3>
          <span className="text-xs text-[#8888aa] ml-auto">Last 50 actions</span>
        </div>
        {auditLogs.length === 0 ? (
          <div className="py-8 text-center text-[#8888aa] text-sm">No activity recorded</div>
        ) : (
          <div className="divide-y divide-[#2a2a3a] max-h-96 overflow-y-auto">
            {auditLogs.map((log, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3">
                <span className="text-base mt-0.5">{ACTION_ICONS[log.action as string] ?? '•'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">
                    <span className="font-medium">{(log.profile as { full_name?: string } | null)?.full_name ?? 'System'}</span>
                    {' '}<span className="text-[#8888aa]">{log.action as string}</span>
                    {' '}<span className="text-white/70">{log.entity_type as string}</span>
                  </div>
                  <div className="text-xs text-[#5a5a7a]">{formatRelative(log.created_at as string)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
