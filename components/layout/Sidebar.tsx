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
  LineChart,
  Receipt,
  Car,
  FileBox,
  Newspaper,
  BookText,
  NotebookPen,
  ChevronDown,
  Scale,
  Sparkles,
  Lock,
  Music,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { WEB_SEARCH_ENABLED } from '@/lib/flags'
import { APP_VERSION } from '@/lib/version'
import { OPMLogo } from '@/components/ui/OPMLogo'
import type { Role } from '@/lib/types'

interface SidebarProps {
  role: Role
  isOpen?: boolean
  onClose?: () => void
}

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; roles: string[] }
type NavSection = { section: string | null; items: NavItem[] }

const NAV: NavSection[] = [
  // Production-house order: films + the AI assistant first, finance below.
  { section: null, items: [
    // Founder-only private workspace, pinned above everything.
    { href: '/personal', label: 'Personal', icon: Lock, roles: ['founder'] },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer', 'staff'] },
    { href: '/office', label: 'OPM Office', icon: Building2, roles: ['founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer', 'staff'] },
    { href: '/assistant', label: 'Ask OPM', icon: Sparkles, roles: ['founder'] },
  ] },
  { section: 'Production', items: [
    { href: '/projects', label: 'Films & Projects', icon: Clapperboard, roles: ['founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer', 'staff'] },
    { href: '/records', label: 'OPM Records', icon: Music, roles: ['founder', 'accountant', 'general_manager'] },
    { href: '/documents', label: 'Documents', icon: FileText, roles: ['founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer'] },
    { href: '/vehicles', label: 'Vehicles', icon: Car, roles: ['founder', 'accountant', 'general_manager', 'executive_producer'] },
    { href: '/templates', label: 'Templates', icon: FileBox, roles: ['founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer'] },
  ] },
  { section: 'Finance', items: [
    { href: '/cash', label: 'Cash in Hand', icon: Wallet, roles: ['founder', 'accountant'] },
    { href: '/accounts', label: 'Accounts', icon: Landmark, roles: ['founder', 'accountant'] },
    { href: '/reconcile', label: 'Reconcile', icon: Scale, roles: ['founder', 'accountant'] },
    { href: '/payments', label: 'Payments', icon: CreditCard, roles: ['founder', 'accountant', 'general_manager', 'executive_producer'] },
    { href: '/vendors', label: 'Vendors', icon: Building2, roles: ['founder', 'accountant', 'general_manager'] },
    { href: '/liabilities', label: 'Liabilities', icon: AlertTriangle, roles: ['founder', 'accountant'] },
    { href: '/payroll', label: 'Payroll', icon: HandCoins, roles: ['founder', 'accountant'] },
    { href: '/revenue', label: 'Revenue', icon: TrendingUp, roles: ['founder', 'accountant'] },
    { href: '/forecast', label: 'Forecast', icon: LineChart, roles: ['founder', 'accountant'] },
    { href: '/compliance', label: 'Tax & Compliance', icon: Receipt, roles: ['founder', 'accountant'] },
  ] },
  { section: 'Accounting', items: [
    { href: '/vouchers', label: 'Vouchers', icon: NotebookPen, roles: ['founder', 'accountant'] },
    { href: '/statements', label: 'Statements', icon: BarChart3, roles: ['founder', 'accountant'] },
    { href: '/tally', label: 'Tally Export', icon: BookText, roles: ['founder', 'accountant'] },
    { href: '/gst-inputs', label: 'GST Inputs', icon: Receipt, roles: ['founder', 'accountant'] },
  ] },
  { section: 'Intelligence', items: [
    // Market (other-films tracker) is web-search powered — hidden while that's off
    ...(WEB_SEARCH_ENABLED ? [{ href: '/market', label: 'Market', icon: Newspaper, roles: ['founder', 'accountant', 'general_manager', 'executive_producer'] }] : []),
    { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['founder', 'accountant', 'general_manager', 'legal_viewer'] },
  ] },
  { section: 'Admin', items: [
    { href: '/users', label: 'Users', icon: Users, roles: ['founder'] },
    { href: '/audit', label: 'Audit Log', icon: ScrollText, roles: ['founder'] },
    { href: '/settings', label: 'Settings', icon: Settings, roles: ['founder', 'accountant'] },
  ] },
]

export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try { const s = localStorage.getItem('opm-sidebar-collapsed'); if (s) setCollapsed(JSON.parse(s)) } catch { /* noop */ }
  }, [])

  function toggle(section: string) {
    setCollapsed(prev => {
      const next = { ...prev, [section]: !prev[section] }
      try { localStorage.setItem('opm-sidebar-collapsed', JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // Sections with at least one item this role may see
  const sections = NAV
    .map(s => ({ ...s, items: s.items.filter(i => i.roles.includes(role as string)) }))
    .filter(s => s.items.length > 0)

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
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {sections.map((s, si) => {
            const hasActive = s.items.some(i => isActive(i.href))
            // A section is open unless collapsed — but always open if it holds the active page
            const open = s.section === null || !collapsed[s.section] || hasActive
            return (
              <div key={s.section ?? `top-${si}`} className={s.section ? 'pt-1' : ''}>
                {s.section && (
                  <button
                    onClick={() => toggle(s.section as string)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5a5a7a] hover:text-[#8888aa]"
                  >
                    {s.section}
                    <ChevronDown size={13} className={cn('transition-transform', open ? '' : '-rotate-90')} />
                  </button>
                )}
                {open && (
                  <div className="space-y-0.5">
                    {s.items.map((item) => {
                      const active = isActive(item.href)
                      const isPersonal = item.href === '/personal'
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            isPersonal && 'border',
                            active
                              ? (isPersonal
                                  ? 'bg-[#f5b301]/15 text-[#f5b301] border-[#f5b301]/40'
                                  : 'bg-white/10 text-white border border-white/15')
                              : (isPersonal
                                  ? 'text-[#f5b301] border-[#f5b301]/25 hover:bg-[#f5b301]/10'
                                  : 'text-[#8888aa] hover:text-white hover:bg-[#1a1a24]')
                          )}
                        >
                          <item.icon size={17} className={active && !isPersonal ? 'text-white/70' : ''} />
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
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
