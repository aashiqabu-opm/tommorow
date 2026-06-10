'use client'

import { useState } from 'react'
import { Menu, Bell, LogOut, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/types'

interface HeaderProps {
  profile: Profile
  onMenuClick: () => void
}

const ROLE_LABELS: Record<string, string> = {
  founder: 'Founder',
  accountant: 'Accountant',
  executive_producer: 'Executive Producer',
  production_manager: 'Production Manager',
  legal_viewer: 'Legal / CA Viewer',
}

export function Header({ profile, onMenuClick }: HeaderProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-16 border-b border-[#2a2a3a] bg-[#0a0a0f] flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-[#8888aa] hover:text-white rounded-lg hover:bg-[#1a1a24]"
        >
          <Menu size={20} />
        </button>
        <div className="hidden lg:block text-[#8888aa] text-sm">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="p-2 text-[#8888aa] hover:text-white rounded-lg hover:bg-[#1a1a24] relative">
          <Bell size={18} />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-lg hover:bg-[#1a1a24] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-xs font-bold text-black">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-white leading-none">{profile.full_name}</div>
              <div className="text-[10px] text-[#8888aa] mt-0.5">{ROLE_LABELS[profile.role]}</div>
            </div>
            <ChevronDown size={14} className="text-[#8888aa]" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl shadow-xl py-1 z-50">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-[#2a2a3a] transition-colors"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
