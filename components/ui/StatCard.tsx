import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  status?: 'green' | 'yellow' | 'red' | 'default'
  className?: string
  onClick?: () => void
}

const statusStyles = {
  green: 'border-emerald-500/20 bg-emerald-500/5',
  yellow: 'border-amber-500/20 bg-amber-500/5',
  red: 'border-red-500/20 bg-red-500/5',
  default: 'border-[#2a2a3a] bg-[#13131a]',
}

const iconStyles = {
  green: 'bg-emerald-500/15 text-emerald-400',
  yellow: 'bg-amber-500/15 text-amber-400',
  red: 'bg-red-500/15 text-red-400',
  default: 'bg-white/10 text-white',
}

const valueStyles = {
  green: 'text-emerald-300',
  yellow: 'text-amber-300',
  red: 'text-red-300',
  default: 'text-white',
}

export function StatCard({ title, value, subtitle, icon: Icon, status = 'default', className, onClick }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-5 transition-all duration-200',
        statusStyles[status],
        onClick && 'cursor-pointer hover:scale-[1.02] active:scale-[0.99]',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-[#8888aa] uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', iconStyles[status])}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className={cn('text-2xl font-bold tabular-nums leading-none', valueStyles[status])}>
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-[#8888aa] mt-1.5">{subtitle}</div>
      )}
    </div>
  )
}
