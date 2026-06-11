// Alert categories. Derived from the entity an alert is about, so every
// existing notification call site is categorized without changes.

export const ALERT_CATEGORIES = ['payments', 'liabilities', 'documents', 'cash', 'payroll', 'general'] as const
export type AlertCategory = (typeof ALERT_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<AlertCategory, string> = {
  payments: 'Payments',
  liabilities: 'Liabilities',
  documents: 'Documents & Agreements',
  cash: 'Cash in Hand',
  payroll: 'Payroll',
  general: 'General',
}

const ENTITY_CATEGORY: Record<string, AlertCategory> = {
  payment_requests: 'payments',
  liabilities: 'liabilities',
  documents: 'documents',
  cash_entries: 'cash',
  staff_salaries: 'payroll',
  salary_payments: 'payroll',
}

export function categoryFor(entityType?: string | null): AlertCategory {
  if (!entityType) return 'general'
  return ENTITY_CATEGORY[entityType] ?? 'general'
}

export function isAlertCategory(value: unknown): value is AlertCategory {
  return typeof value === 'string' && (ALERT_CATEGORIES as readonly string[]).includes(value)
}
