'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff } from 'lucide-react'
import { OPMLogo } from '@/components/ui/OPMLogo'
import { APP_VERSION } from '@/lib/version'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <OPMLogo width={171} className="text-white mb-7" />
          <h1 className="text-xl font-semibold text-white tracking-tight">OPM Flash</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-[#8888aa]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@opmcinemas.com"
              className="w-full bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[#8888aa]">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-[#13131a] border border-[#2a2a3a] rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8888aa] hover:text-white"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white hover:bg-gray-200 disabled:opacity-60 text-black font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-[11px] text-[#5a5a7a] mt-8">
          Access OPM Cinemas staffs only
        </p>
        <p className="text-center text-[10px] text-[#3a3a4a] mt-2">{APP_VERSION}</p>
      </div>
    </div>
  )
}
