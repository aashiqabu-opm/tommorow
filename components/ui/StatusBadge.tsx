import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  label: string
  variant: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray'
  size?: 'sm' | 'md'
}

const variants = {
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  yellow: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  red: 'bg-red-500/15 text-red-400 border-red-500/20',
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  purple: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
  gray: 'bg-[#2a2a3a] text-[#8888aa] border-[#3a3a4a]',
}

export function StatusBadge({ label, variant, size = 'sm' }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        variants[variant],
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      )}
    >
      {label}
    </span>
  )
}

export function getPaymentStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray' }> = {
    draft: { label: 'Draft', variant: 'gray' },
    pending_verification: { label: 'Pending Verify', variant: 'yellow' },
    verified: { label: 'Verified', variant: 'blue' },
    pending_approval: { label: 'Pending Approval', variant: 'yellow' },
    approved: { label: 'Approved', variant: 'green' },
    rejected: { label: 'Rejected', variant: 'red' },
    paid: { label: 'Paid', variant: 'green' },
    unpaid: { label: 'Unpaid', variant: 'gray' },
    pending: { label: 'Pending', variant: 'yellow' },
  }
  return map[status] ?? { label: status, variant: 'gray' as const }
}

export function getLiabilityStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray' }> = {
    unpaid: { label: 'Unpaid', variant: 'red' },
    partly_paid: { label: 'Partly Paid', variant: 'yellow' },
    cleared: { label: 'Cleared', variant: 'green' },
    disputed: { label: 'Disputed', variant: 'purple' },
  }
  return map[status] ?? { label: status, variant: 'gray' as const }
}

export function getDocumentStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray' }> = {
    draft: { label: 'Draft', variant: 'gray' },
    signed: { label: 'Signed', variant: 'blue' },
    active: { label: 'Active', variant: 'green' },
    expired: { label: 'Expired', variant: 'red' },
    disputed: { label: 'Disputed', variant: 'purple' },
  }
  return map[status] ?? { label: status, variant: 'gray' as const }
}

export function getPriorityBadge(priority: string) {
  const map: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray' }> = {
    urgent: { label: 'Urgent', variant: 'red' },
    normal: { label: 'Normal', variant: 'yellow' },
    low: { label: 'Low', variant: 'gray' },
  }
  return map[priority] ?? { label: priority, variant: 'gray' as const }
}
