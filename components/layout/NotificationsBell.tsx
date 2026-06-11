'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bell, CheckCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types'

const ENTITY_ROUTES: Record<string, string> = {
  payment_requests: '/payments',
  liabilities: '/liabilities',
  documents: '/documents',
  cash_entries: '/cash',
  projects: '/projects',
  profiles: '/users',
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function NotificationsBell() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  const fetchNotifications = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15)
    setNotifications(data ?? [])
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const unread = notifications.filter((n) => !n.is_read)

  async function markAllRead() {
    if (unread.length === 0) return
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  function handleNotificationClick(n: Notification) {
    // Mark read in the background — don't block navigation on the network
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
    const supabase = createClient()
    supabase.from('notifications').update({ is_read: true }).eq('id', n.id).then()
    setOpen(false)
    const route = n.entity_type ? ENTITY_ROUTES[n.entity_type] : undefined
    if (!route) return
    if (pathname === route) router.refresh()
    else router.push(route)
  }

  function toggle() {
    if (!open) fetchNotifications()
    setOpen(!open)
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="p-2 text-[#8888aa] hover:text-white rounded-lg hover:bg-[#1a1a24] relative"
      >
        <Bell size={18} />
        {unread.length > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-80 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a3a]">
              <span className="text-sm font-semibold text-white">Notifications</span>
              {unread.length > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-[#8888aa] hover:text-white"
                >
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-[#2a2a3a]">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-[#8888aa] text-sm">No notifications yet</div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-[#2a2a3a]/50 transition-colors ${
                      n.is_read ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-white mt-1.5 shrink-0" />}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white">{n.title}</div>
                        {n.body && <div className="text-[11px] text-[#8888aa] mt-0.5 line-clamp-2">{n.body}</div>}
                        <div className="text-[10px] text-[#5a5a7a] mt-1">{timeAgo(n.created_at)}</div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
