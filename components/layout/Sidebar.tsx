'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  CreditCard,
  FileText,
  BarChart3,
  Users,
  Settings,
  AlertTriangle,
  Clapperboard,
  ScrollText,
  X,
  Building2,
  Landmark,
  HandCoins,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'
import { OPMLogo } from '@/components/ui/OPMLogo'
import type { Role } from '@/lib/types'

interface SidebarProps {
  role: Role
  isOpen?: boolean
  onClose?: () => void
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer'] },
  { href: '/cash', label: 'Cash in Hand', icon: Wallet, roles: ['founder', 'accountant'] },
  { href: '/vendors', label: 'Vendors', icon: Building2, roles: ['founder', 'accountant', 'general_manager'] },
  { href: '/accounts', label: 'Accounts', icon: Landmark, roles: ['founder', 'accountant'] },
  { href: '/liabilities', label: 'Liabilities', icon: AlertTriangle, roles: ['founder', 'accountant'] },
  { href: '/payroll', label: 'Payroll', icon: HandCoins, roles: ['founder', 'accountant'] },
  { href: '/payments', label: 'Payments', icon: CreditCard, roles: ['founder', 'accountant', 'general_manager', 'executive_producer'] },
  { href: '/revenue', label: 'Revenue', icon: TrendingUp, roles: ['founder', 'accountant'] },
  { href: '/documents', label: 'Documents', icon: FileText, roles: ['founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer'] },
  { href: '/projects', label: 'Projects', icon: Clapperboard, roles: ['founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer'] },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['founder', 'accountant', 'general_manager', 'legal_viewer'] },
  { href: '/users', label: 'Users', icon: Users, roles: ['founder'] },
  { href: '/audit', label: 'Audit Log', icon: ScrollText, roles: ['founder'] },
  { href: '/settings', label: 'Settings', icon: Settings, roles: ['founder', 'accountant'] },
]

export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  const allowed = navItems.filter((item) => item.roles.includes(role as never))

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 flex flex-col',
          'bg-[#13131a] border-r border-[#2a2a3a]',
          'transition-transform duration-200',
          'lg:translate-x-0 lg:static lg:z-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-[#2a2a3a]">
          <div className="flex items-center gap-3">
            <OPMLogo width={86} caption={false} className="text-white" />
            <div className="text-[9px] font-medium text-[#8888aa] uppercase tracking-[0.18em] leading-tight">
              Internal<br />Office
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-[#8888aa] hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {allowed.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-white/10 text-white border border-white/15'
                    : 'text-[#8888aa] hover:text-white hover:bg-[#1a1a24]'
                )}
              >
                <item.icon size={17} className={active ? 'text-white/70' : ''} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#2a2a3a]">
          <div className="text-[10px] text-[#8888aa] text-center uppercase tracking-widest">
            OPM Cinemas &copy; {new Date().getFullYear()}
          </div>
          <div className="text-[9px] text-[#5a5a7a] text-center mt-1">{APP_VERSION}</div>
        </div>
      </aside>
    </>
  )
}
