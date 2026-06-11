'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'

interface ToastItem {
  id: number
  type: 'success' | 'error'
  message: string
}

interface ToastAPI {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastAPI>({ success: () => {}, error: () => {} })

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const push = useCallback((type: 'success' | 'error', message: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const api: ToastAPI = {
    success: (m) => push('success', m),
    error: (m) => push('error', m),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 px-4 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium w-full animate-[toast-in_0.2s_ease-out] ${
              t.type === 'success'
                ? 'bg-[#0e1f17] border-emerald-500/30 text-emerald-300'
                : 'bg-[#251114] border-red-500/30 text-red-300'
            }`}
          >
            {t.type === 'success' ? <CheckCircle size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
