'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'

interface Props {
  initialValue?: string
}

export function SearchInput({ initialValue = '' }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(initialValue)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (value.trim().length >= 2) {
      router.push(`/search?q=${encodeURIComponent(value.trim())}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8888aa]" />
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Search payments, vendors, liabilities, documents..."
          autoFocus
          className="w-full bg-[#13131a] border border-[#2a2a3a] rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-[#5a5a7a] focus:outline-none focus:ring-1 focus:ring-white/30 focus:border-white/30"
        />
      </div>
      <button type="submit"
        className="px-5 py-3 bg-white text-black text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40"
        disabled={value.trim().length < 2}
      >
        Search
      </button>
    </form>
  )
}
