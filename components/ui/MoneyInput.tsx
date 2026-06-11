'use client'

import { cn } from '@/lib/utils'

// Amount input that shows Indian-style comma grouping (1,50,000) as you type
// while keeping the raw numeric string in state.

interface MoneyInputProps {
  label?: string
  value: string
  onChange: (raw: string) => void
  required?: boolean
  placeholder?: string
  className?: string
}

function groupINR(raw: string): string {
  if (!raw) return ''
  const [int, dec] = raw.split('.')
  const grouped = int ? Number(int).toLocaleString('en-IN') : ''
  return dec !== undefined ? `${grouped}.${dec}` : grouped
}

export function MoneyInput({ label, value, onChange, required, placeholder, className }: MoneyInputProps) {
  const inputId = label?.toLowerCase().replace(/\s/g, '_')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/,/g, '')
    if (raw === '' || /^\d*\.?\d{0,2}$/.test(raw)) onChange(raw)
  }

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-[#8888aa]">
          {label}
        </label>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#5a5a7a]">₹</span>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={groupINR(value)}
          onChange={handleChange}
          required={required}
          placeholder={placeholder ?? '0'}
          className={cn(
            'w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder-[#5a5a7a] tabular-nums',
            'focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40',
            className
          )}
        />
      </div>
    </div>
  )
}
