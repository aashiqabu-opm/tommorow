import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md'
  icon?: LucideIcon
  loading?: boolean
}

const variants = {
  primary: 'bg-white hover:bg-gray-200 text-black',
  secondary: 'bg-[#1a1a24] hover:bg-[#2a2a3a] text-white border border-[#2a2a3a]',
  danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20',
  ghost: 'hover:bg-[#1a1a24] text-[#8888aa] hover:text-white',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

export function Button({ variant = 'primary', size = 'md', icon: Icon, loading, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 13 : 15} />}
      {loading ? 'Loading...' : children}
    </button>
  )
}
