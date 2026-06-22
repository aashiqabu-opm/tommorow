// Expense auto-categorizer (Phase 4.2).
// Pure, deterministic merchant → suggestion. This is a SUGGESTION tool for Shimon's
// review only — it never auto-approves. `needs_review` is ALWAYS true, no exceptions.
// Writes to `ai_category` (the AI suggestion); the human-confirmed `category` column
// is separate and untouched by this function.

export interface ExpenseSuggestion {
  ai_category: string
  is_business_expense: boolean
  needs_review: boolean
}

const RULES: { match: string[]; ai_category: string; is_business_expense: boolean }[] = [
  { match: ['swiggy', 'zomato'], ai_category: 'Working Meals - Creative Dev', is_business_expense: true },
  { match: ['amazon', 'flipkart'], ai_category: 'Office Consumables', is_business_expense: true },
  { match: ['uber', 'ola'], ai_category: 'Production Logistics', is_business_expense: true },
  { match: ['netflix', 'apple', 'vercel', 'anthropic', 'github'], ai_category: 'Software & R&D', is_business_expense: true },
  { match: ['aster', 'hospital'], ai_category: 'Medical', is_business_expense: false },
]

export function autoCategorizeExpense(merchant: string): ExpenseSuggestion {
  const m = (merchant || '').toLowerCase()
  for (const rule of RULES) {
    if (rule.match.some(k => m.includes(k))) {
      return { ai_category: rule.ai_category, is_business_expense: rule.is_business_expense, needs_review: true }
    }
  }
  return { ai_category: 'Uncategorized', is_business_expense: false, needs_review: true }
}
