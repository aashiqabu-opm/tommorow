'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Mail, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react'
import type { GoogleUser } from '@/lib/google-workspace'

interface Props {
  initialUsers: GoogleUser[]
}

export function WorkspaceClient({ initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers)

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Google Workspace" 
        subtitle="Manage @opmrecords.com email addresses and user accounts"
        action={
          <a href="/api/auth/google/workspace">
            <Button icon={Mail}>Connect Workspace</Button>
          </a>
        }
      />

      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2a3a] flex justify-between items-center">
          <div>
            <h3 className="text-sm font-semibold text-white">Workspace Users</h3>
            <p className="text-xs text-[#8888aa] mt-0.5">All accounts registered under your Google Workspace domain.</p>
          </div>
        </div>
        
        <div className="divide-y divide-[#2a2a3a]">
          {users.map(user => (
            <div key={user.id} className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-white">
                  {user.name.givenName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{user.name.fullName}</span>
                    {user.suspended ? (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                        <XCircle size={10} /> Suspended
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#8888aa]">{user.primaryEmail}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {user.suspended ? (
                  <Button variant="secondary" size="sm">Activate</Button>
                ) : (
                  <Button variant="danger" size="sm">Suspend</Button>
                )}
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="px-5 py-8 text-center">
              <ShieldAlert className="mx-auto h-8 w-8 text-[#8888aa] mb-3" />
              <p className="text-sm text-white font-medium">No connection established</p>
              <p className="text-xs text-[#8888aa] mt-1 max-w-sm mx-auto">
                Connect your Google Workspace admin account to view and manage users.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
