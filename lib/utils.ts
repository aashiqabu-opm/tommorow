import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isAfter, isBefore, addDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy')
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function isExpiringSoon(date: string | Date, days = 30): boolean {
  const target = new Date(date)
  const now = new Date()
  return isAfter(target, now) && isBefore(target, addDays(now, days))
}

export function isExpired(date: string | Date): boolean {
  return isBefore(new Date(date), new Date())
}

export function getExpiryStatus(date?: string | null): 'expired' | 'warning' | 'ok' | null {
  if (!date) return null
  if (isExpired(date)) return 'expired'
  if (isExpiringSoon(date, 30)) return 'warning'
  return 'ok'
}

export function paidPercent(paid: number, total: number): number {
  if (total === 0) return 0
  return Math.round((paid / total) * 100)
}

export function getHealthColor(health: 'green' | 'yellow' | 'red') {
  return {
    green: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
    yellow: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    red: 'text-red-400 bg-red-400/10 border-red-400/20',
  }[health]
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  movie_agreement: 'Movie Agreement',
  artist_contract: 'Artist Contract',
  technician_contract: 'Technician Contract',
  investor_agreement: 'Investor Agreement',
  distribution_agreement: 'Distribution Agreement',
  ott_agreement: 'OTT Agreement',
  music_rights: 'Music Rights',
  legal_notice: 'Legal Notice',
  gst_tds: 'GST/TDS Papers',
  invoice: 'Invoice',
  bill: 'Bill',
  censor_document: 'Censor Document',
  insurance: 'Insurance',
  loan_document: 'Loan Document',
  company_registration: 'Company Registration',
  other: 'Other',
}

export const LIABILITY_TYPE_LABELS: Record<string, string> = {
  loan: 'Loan',
  vendor: 'Vendor',
  artist: 'Artist',
  technician: 'Technician',
  rent: 'Rent',
  tax: 'Tax',
  personal: 'Personal',
  other: 'Other',
}

export const PAYMENT_CATEGORY_OPTIONS = [
  'Production Cost',
  'Equipment Rental',
  'Artist Payment',
  'Technician Payment',
  'Location Fee',
  'Post Production',
  'Marketing',
  'Distribution',
  'Legal',
  'Administrative',
  'Travel',
  'Food & Catering',
  'Other',
]

export const DEFAULT_PROJECTS = [
  'OPM Office',
  'Aja Sundari',
  'Downtrodden',
  'Mayavi',
  'Rifle Club 2',
  'TOMORROW',
  'Other',
]
