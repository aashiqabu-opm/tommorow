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

export const PROJECT_ROLE_LABELS: Record<string, string> = {
  director: 'Director',
  executive_producer: 'Executive Producer',
  general_manager: 'General Manager',
  finance_controller: 'Finance Controller (Head of Finance)',
  production_controller: 'Production Controller (Head of Production)',
  chief_ad: 'Chief Associate Director',
  associate_director: 'Associate Director (AD)',
  screenwriter: 'Screenwriter',
  production_designer: 'Production Designer',
  music_director: 'Music Director',
  editor: 'Editor',
  assistant_editor: 'Assistant Editor',
  sound_designer: 'Sound Designer',
  vfx_director: 'VFX Director',
  colorist: 'Colorist',
  production_executive: 'Production Executive',
  production_manager: 'Production Manager',
  cashier: 'Cashier',
  purchase_manager: 'Purchase Manager',
  location_manager: 'Location Manager',
  driver: 'Driver',
  production_assistant: 'Production Assistant',
  member: 'Team Member',
}

// What each per-project role is allowed to do within a project.
// Management app-roles (founder/accountant/GM/EP) see everything regardless.
export const PROJECT_ROLE_CAPS: Record<string, { pettyCash?: boolean; payments?: boolean; dpr?: boolean; vehicles?: boolean; fullView?: boolean }> = {
  director:              { dpr: true, fullView: true },
  executive_producer:    { payments: true, dpr: true, vehicles: true, fullView: true },
  general_manager:       { payments: true, dpr: true, vehicles: true, fullView: true },
  finance_controller:    { pettyCash: true, payments: true, fullView: true },
  production_controller: { payments: true, dpr: true, vehicles: true, fullView: true },
  chief_ad:              { dpr: true, fullView: true },
  associate_director:    { dpr: true, fullView: true },
  screenwriter:          { fullView: true },
  production_designer:   { fullView: true },
  music_director:        { fullView: true },
  editor:                { fullView: true },
  assistant_editor:      { fullView: true },
  sound_designer:        { fullView: true },
  vfx_director:          { fullView: true },
  colorist:              { fullView: true },
  production_executive:  { payments: true, dpr: true, vehicles: true, fullView: true },
  production_manager:    { payments: true, dpr: true, vehicles: true, fullView: true },
  cashier:               { pettyCash: true },
  purchase_manager:      { payments: true },
  location_manager:      { dpr: true, vehicles: true },
  driver:                { vehicles: true },
  production_assistant:  {},
  member:                {},
}

export const LIABILITY_TYPE_LABELS: Record<string, string> = {
  loan: 'Loan',
  vendor: 'Vendor',
  artist: 'Artist',
  technician: 'Technician',
  rent: 'Rent',
  tax: 'Tax',
  personal: 'Personal',
  salary: 'Salary',
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

// ─── Number to Indian English Words ──────────────────────────────────────────
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  return (TENS[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ONES[n % 10] : '')).trim()
}

function threeDigits(n: number): string {
  if (n < 100) return twoDigits(n)
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  return (ONES[hundreds] + ' Hundred' + (rest > 0 ? ' ' + twoDigits(rest) : '')).trim()
}

export function numberToWordsIndian(n: number): string {
  const num = Math.floor(Math.abs(n))
  if (num === 0) return 'Zero'

  const crore = Math.floor(num / 10000000)
  const lakh = Math.floor((num % 10000000) / 100000)
  const thousand = Math.floor((num % 100000) / 1000)
  const remainder = num % 1000

  const parts: string[] = []
  if (crore > 0) parts.push(threeDigits(crore) + ' Crore')
  if (lakh > 0) parts.push(threeDigits(lakh) + ' Lakh')
  if (thousand > 0) parts.push(threeDigits(thousand) + ' Thousand')
  if (remainder > 0) parts.push(threeDigits(remainder))

  return parts.join(' ')
}
