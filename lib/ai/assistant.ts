import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fundingMetrics } from '@/lib/funding'
import type { ProjectFunding, DocumentAnalysisData } from '@/lib/types'
import { PROJECT_ROLE_LABELS } from '@/lib/utils'

// ─── "Ask OPM" engine: read-only tools + agentic loop, shared by the web
//     widget (/api/assistant) and the WhatsApp channel. Every query is a SELECT
//     through the caller-supplied Supabase client. ───

const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'financial_overview',
    description: "Company-wide money position right now: cash in hand, bank balances, total & overdue liabilities, pending approvals, approved-but-unpaid payments, outstanding receivables, and monthly payroll. Use for 'how are we doing', 'what's our cash position', 'what do we owe'.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'search_payments',
    description: 'Search payment requests (money going out). Filter by free-text on payee/purpose, project name, approval status, payment status, minimum amount, or date range.',
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        query: { type: 'string', description: 'Text to match in payee or purpose' },
        project: { type: 'string', description: 'Project name (partial match)' },
        approval_status: { type: 'string', description: 'pending | approved | rejected' },
        payment_status: { type: 'string', description: 'paid | unpaid' },
        min_amount: { type: 'number' },
        from: { type: 'string', description: 'YYYY-MM-DD' },
        to: { type: 'string', description: 'YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'list_liabilities',
    description: 'Outstanding dues the company owes. Filter to overdue only, or by party name.',
    input_schema: { type: 'object', additionalProperties: false, properties: { overdue_only: { type: 'boolean' }, party: { type: 'string', description: 'Party name (partial match)' } } },
  },
  {
    name: 'list_receivables',
    description: 'Money owed TO the company (revenue receivables not yet collected). Filter to overdue only.',
    input_schema: { type: 'object', additionalProperties: false, properties: { overdue_only: { type: 'boolean' } } },
  },
  {
    name: 'project_financials',
    description: "A single project's P&L: realized income vs committed spend (paid + approved-unpaid + outstanding liabilities) and net. Use for 'how is <film> doing', 'P&L for <film>'.",
    input_schema: { type: 'object', additionalProperties: false, properties: { project: { type: 'string', description: 'Project / film name (partial match)' } }, required: ['project'] },
  },
  {
    name: 'list_projects',
    description: 'List all film projects with status and priority.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'search_documents',
    description: "Search company documents and AGREEMENTS/CONTRACTS, including the AI-extracted analysis: plain-English summary, parties, key dates (renewals, expiries, payment milestones, delivery deadlines), financial terms (MG, commission, advance, penalties), and risk flags. Use for 'what does the <X> agreement say', 'which contracts renew soon', \"what's our commission on the <Y> deal\", 'any risky clauses', 'contract for <film>'.",
    input_schema: { type: 'object', additionalProperties: false, properties: { query: { type: 'string', description: 'Text to match in document title or party name' }, upcoming_dates_only: { type: 'boolean', description: 'Only documents that have a key date within the next 90 days' } } },
  },
  {
    name: 'project_budget',
    description: "A film's budget-vs-actual COST REPORT: per head — budget, committed (approved-unpaid), spent (paid payments + petty cash + crew payments), remaining and % used — plus totals and which heads are over/near budget. Use for 'cost report for <film>', 'which heads are over budget', 'how much have we spent on camera for <film>'.",
    input_schema: { type: 'object', additionalProperties: false, properties: { project: { type: 'string', description: 'Project / film name (partial match)' } }, required: ['project'] },
  },
  {
    name: 'list_funding',
    description: "Project funding / capital stack: investors (with equity %), loans/finance (with rate and monthly interest cost), and OPM's own investment. Use for 'who are the investors on <film>', \"what's our loan interest\", 'how much has OPM invested'. Omit project for all projects.",
    input_schema: { type: 'object', additionalProperties: false, properties: { project: { type: 'string', description: 'Project / film name (optional, partial match)' } } },
  },
  {
    name: 'crew_ledger',
    description: "A film's crew & cast ledger: each person's agreed fee, TDS, paid-so-far and BALANCE DUE. Use for 'what do we owe <name>', 'balance due to cast on <film>', 'who is still unpaid on <film>'.",
    input_schema: { type: 'object', additionalProperties: false, properties: { project: { type: 'string', description: 'Project / film name (partial match)' } }, required: ['project'] },
  },
  {
    name: 'shoot_progress',
    description: "A film's shoot progress from Daily Production Reports (DPR): total shoot days logged, scenes completed vs planned, how many days ran behind, and the most recent days (date, day number, location, scenes done, status). Use for 'how is the <film> shoot going', 'how many shoot days on <film>', 'are we behind schedule'.",
    input_schema: { type: 'object', additionalProperties: false, properties: { project: { type: 'string', description: 'Project / film name (partial match)' } }, required: ['project'] },
  },
  {
    name: 'team_checkins',
    description: "Recent DAILY CHECK-INS from a film's core team (Chief AD, production managers, cashier, location managers, drivers, etc.) — what each person did that day and any blockers/needs they flagged. Use for 'what did the team report on <film> today', 'any blockers on <film>', 'daily update from the <film> crew', 'what's pending for the producer on <film>'. Also returns the core team roster.",
    input_schema: { type: 'object', additionalProperties: false, properties: { project: { type: 'string', description: 'Project / film name (partial match)' } }, required: ['project'] },
  },
]

// Tools every role may use (the rest are finance-only). RLS still scopes rows.
export const ALL_ROLE_TOOLS = ['list_projects', 'search_payments', 'search_documents', 'shoot_progress', 'team_checkins']

type Json = Record<string, unknown>

async function findProject(sb: SupabaseClient, term: string) {
  const { data } = await sb.from('projects').select('id, name').ilike('name', `%${term}%`).limit(1)
  return data?.[0] as { id: string; name: string } | undefined
}

export async function runTool(name: string, input: Json, sb: SupabaseClient): Promise<unknown> {
  const today = new Date().toISOString().slice(0, 10)

  if (name === 'financial_overview') {
    const [banks, cash, payroll, pay, liab, recv] = await Promise.all([
      sb.from('bank_accounts').select('name, current_balance').eq('is_active', true),
      sb.from('cash_entries').select('closing_cash').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(1),
      sb.from('staff_salaries').select('monthly_salary').eq('is_active', true),
      sb.from('payment_requests').select('amount, approval_status, payment_status'),
      sb.from('liabilities').select('balance_remaining, due_date, status').neq('status', 'cleared'),
      sb.from('project_income').select('amount, status').eq('status', 'receivable'),
    ])
    const payRows = pay.data ?? []
    const liabRows = liab.data ?? []
    const bankTotal = (banks.data ?? []).reduce((s, b) => s + Number(b.current_balance ?? 0), 0)
    const overdue = liabRows.filter(l => l.due_date && (l.due_date as string) < today)
    return {
      cash_in_hand: inr(cash.data?.[0]?.closing_cash ?? 0),
      bank_balance: inr(bankTotal),
      bank_accounts: (banks.data ?? []).map(b => ({ name: b.name, balance: inr(b.current_balance) })),
      total_available: inr((cash.data?.[0]?.closing_cash ?? 0) + bankTotal),
      monthly_payroll: inr((payroll.data ?? []).reduce((s, p) => s + Number(p.monthly_salary ?? 0), 0)),
      pending_approvals_count: payRows.filter(p => p.approval_status === 'pending').length,
      pending_approvals_total: inr(payRows.filter(p => p.approval_status === 'pending').reduce((s, p) => s + Number(p.amount), 0)),
      approved_unpaid_total: inr(payRows.filter(p => p.approval_status === 'approved' && p.payment_status === 'unpaid').reduce((s, p) => s + Number(p.amount), 0)),
      total_outstanding_liabilities: inr(liabRows.reduce((s, l) => s + Number(l.balance_remaining), 0)),
      overdue_liabilities_count: overdue.length,
      overdue_liabilities_total: inr(overdue.reduce((s, l) => s + Number(l.balance_remaining), 0)),
      outstanding_receivables: inr((recv.data ?? []).reduce((s, r) => s + Number(r.amount), 0)),
    }
  }

  if (name === 'search_payments') {
    let q = sb.from('payment_requests').select('payee, amount, purpose, category, approval_status, payment_status, due_date, created_at, project:projects(name)').order('created_at', { ascending: false }).limit(40)
    if (typeof input.approval_status === 'string') q = q.eq('approval_status', input.approval_status)
    if (typeof input.payment_status === 'string') q = q.eq('payment_status', input.payment_status)
    if (typeof input.min_amount === 'number') q = q.gte('amount', input.min_amount)
    if (typeof input.from === 'string') q = q.gte('created_at', input.from)
    if (typeof input.to === 'string') q = q.lte('created_at', `${input.to}T23:59:59`)
    if (typeof input.query === 'string' && input.query) q = q.or(`payee.ilike.%${input.query}%,purpose.ilike.%${input.query}%`)
    const { data } = await q
    let rows = data ?? []
    if (typeof input.project === 'string' && input.project) {
      const p = input.project.toLowerCase()
      rows = rows.filter(r => (r.project as { name?: string } | null)?.name?.toLowerCase().includes(p))
    }
    return rows.slice(0, 25).map(r => ({
      payee: r.payee, amount: inr(r.amount), purpose: r.purpose, category: r.category,
      project: (r.project as { name?: string } | null)?.name ?? null,
      approval: r.approval_status, payment: r.payment_status, due: r.due_date, date: (r.created_at as string)?.slice(0, 10),
    }))
  }

  if (name === 'list_liabilities') {
    let q = sb.from('liabilities').select('party_name, balance_remaining, amount_owed, due_date, status, priority, type, project:projects(name)').neq('status', 'cleared').order('due_date', { ascending: true }).limit(50)
    if (typeof input.party === 'string' && input.party) q = q.ilike('party_name', `%${input.party}%`)
    const { data } = await q
    let rows = data ?? []
    if (input.overdue_only) rows = rows.filter(l => l.due_date && (l.due_date as string) < today)
    return rows.map(l => ({ party: l.party_name, balance: inr(l.balance_remaining), due: l.due_date, status: l.status, priority: l.priority, type: l.type, project: (l.project as { name?: string } | null)?.name ?? null }))
  }

  if (name === 'list_receivables') {
    const { data } = await sb.from('project_income').select('amount, party, source, expected_date, income_date, project:projects(name)').eq('status', 'receivable').order('expected_date', { ascending: true }).limit(50)
    let rows = data ?? []
    if (input.overdue_only) rows = rows.filter(r => r.expected_date && (r.expected_date as string) < today)
    return rows.map(r => ({ party: r.party, amount: inr(r.amount), type: r.source, project: (r.project as { name?: string } | null)?.name ?? null, expected: r.expected_date }))
  }

  if (name === 'project_financials') {
    const project = await findProject(sb, String(input.project ?? ''))
    if (!project) return { error: `No project matching "${input.project}"` }
    const [income, payments, liabilities] = await Promise.all([
      sb.from('project_income').select('amount, status').eq('project_id', project.id),
      sb.from('payment_requests').select('amount, approval_status, payment_status').eq('project_id', project.id),
      sb.from('liabilities').select('amount_paid, balance_remaining, status').eq('project_id', project.id),
    ])
    const realized = (income.data ?? []).filter(i => (i.status ?? 'received') === 'received').reduce((s, i) => s + Number(i.amount), 0)
    const receivable = (income.data ?? []).filter(i => i.status === 'receivable').reduce((s, i) => s + Number(i.amount), 0)
    const spent = (payments.data ?? []).filter(p => ['approved', 'paid'].includes(p.approval_status) || p.payment_status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
    const liabPaid = (liabilities.data ?? []).reduce((s, l) => s + Number(l.amount_paid ?? 0), 0)
    const liabOutstanding = (liabilities.data ?? []).filter(l => l.status !== 'cleared').reduce((s, l) => s + Number(l.balance_remaining ?? 0), 0)
    const committed = spent + liabPaid + liabOutstanding
    return {
      project: project.name, realized_income: inr(realized), receivable_income: inr(receivable),
      committed_spend: inr(committed), net_pnl: inr(realized - committed), net_with_receivables: inr(realized + receivable - committed),
    }
  }

  if (name === 'list_projects') {
    const { data } = await sb.from('projects').select('name, status, is_priority').order('is_priority', { ascending: false }).order('name')
    return (data ?? []).map(p => ({ name: p.name, status: p.status, priority: !!p.is_priority }))
  }

  if (name === 'search_documents') {
    let q = sb.from('documents').select('title, document_type, party_name, expiry_date, ai_summary, ai_analysis, project:projects(name)').order('created_at', { ascending: false }).limit(40)
    if (typeof input.query === 'string' && input.query) q = q.or(`title.ilike.%${input.query}%,party_name.ilike.%${input.query}%`)
    const { data } = await q
    let rows = (data ?? []) as { title: string; document_type: string; party_name: string | null; expiry_date: string | null; ai_summary: string | null; ai_analysis: DocumentAnalysisData | null; project: { name?: string } | null }[]
    const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
    if (input.upcoming_dates_only) rows = rows.filter(d => (d.ai_analysis?.key_dates ?? []).some(k => k.date >= today && k.date <= in90))
    return rows.slice(0, 12).map(d => {
      const a = d.ai_analysis
      return {
        title: d.title, type: d.document_type, party: d.party_name, project: d.project?.name ?? null, expiry: d.expiry_date,
        summary: d.ai_summary ?? null,
        key_dates: a?.key_dates?.map(k => ({ label: k.label, date: k.date })) ?? null,
        financial_terms: a?.financial_terms?.map(f => ({ label: f.label, amount: f.amount != null ? inr(f.amount) : null, note: f.note })) ?? null,
        risk_flags: a?.flags?.map(f => `${f.severity}: ${f.note}`) ?? null,
        ai_analyzed: !!a,
      }
    })
  }

  if (name === 'project_budget') {
    const project = await findProject(sb, String(input.project ?? ''))
    if (!project) return { error: `No project matching "${input.project}"` }
    const [lines, pays, floats, crew] = await Promise.all([
      sb.from('budget_lines').select('id, head, section, estimated').eq('project_id', project.id),
      sb.from('payment_requests').select('amount, net_payable, payment_status, approval_status, budget_line_id').eq('project_id', project.id).not('budget_line_id', 'is', null),
      sb.from('petty_cash_floats').select('txns:petty_cash_txns(type, amount, budget_line_id)').eq('project_id', project.id),
      sb.from('project_crew').select('budget_line_id, payments:crew_payments(amount)').eq('project_id', project.id).not('budget_line_id', 'is', null),
    ])
    const lineRows = (lines.data ?? []) as { id: string; head: string; section: string; estimated: number }[]
    if (!lineRows.length) return { project: project.name, note: 'No budget has been set for this project yet.' }
    const spent: Record<string, number> = {}
    const committed: Record<string, number> = {}
    for (const p of (pays.data ?? []) as { amount: number; net_payable: number | null; payment_status: string; approval_status: string; budget_line_id: string }[]) {
      const v = Number(p.net_payable ?? p.amount ?? 0)
      if (p.payment_status === 'paid') spent[p.budget_line_id] = (spent[p.budget_line_id] ?? 0) + v
      else if (p.approval_status === 'approved') committed[p.budget_line_id] = (committed[p.budget_line_id] ?? 0) + v
    }
    for (const f of (floats.data ?? []) as { txns: { type: string; amount: number; budget_line_id: string | null }[] }[]) {
      for (const t of f.txns ?? []) if (t.type === 'expense' && t.budget_line_id) spent[t.budget_line_id] = (spent[t.budget_line_id] ?? 0) + Number(t.amount || 0)
    }
    for (const c of (crew.data ?? []) as { budget_line_id: string; payments: { amount: number }[] }[]) {
      spent[c.budget_line_id] = (spent[c.budget_line_id] ?? 0) + (c.payments ?? []).reduce((s, x) => s + Number(x.amount || 0), 0)
    }
    let tB = 0, tS = 0, tC = 0
    const heads = lineRows.map(l => {
      const b = Number(l.estimated || 0), s = spent[l.id] ?? 0, c = committed[l.id] ?? 0
      tB += b; tS += s; tC += c
      return { head: l.head, section: l.section, budget: inr(b), committed: inr(c), spent: inr(s), remaining: inr(b - s - c), pct_used: b > 0 ? Math.round((s + c) / b * 100) : 0, over_budget: b > 0 && (s + c) > b }
    })
    return { project: project.name, total_budget: inr(tB), total_spent: inr(tS), total_committed: inr(tC), total_remaining: inr(tB - tS - tC), heads }
  }

  if (name === 'list_funding') {
    const { data } = await sb.from('project_funding').select('kind, name, amount, equity_percent, interest_rate, interest_basis, start_date, status, transactions:funding_transactions(type, amount), project:projects(name)').order('created_at', { ascending: true }).limit(60)
    let rows = (data ?? []) as unknown as (ProjectFunding & { project: { name?: string } | null })[]
    if (typeof input.project === 'string' && input.project) {
      const p = input.project.toLowerCase()
      rows = rows.filter(r => r.project?.name?.toLowerCase().includes(p))
    }
    return rows.map(r => {
      const m = fundingMetrics(r)
      return {
        kind: r.kind, name: r.name, project: r.project?.name ?? null, amount: inr(r.amount),
        equity_percent: r.equity_percent ?? null,
        interest: r.kind === 'loan' && r.interest_rate ? `${r.interest_rate}% / ${r.interest_basis === 'annual' ? 'yr' : 'mo'}` : null,
        monthly_interest: r.kind === 'loan' ? inr(m.monthlyInterest) : null,
        outstanding_interest: r.kind === 'loan' ? inr(m.outstandingInterest) : null,
        status: r.status,
      }
    })
  }

  if (name === 'crew_ledger') {
    const project = await findProject(sb, String(input.project ?? ''))
    if (!project) return { error: `No project matching "${input.project}"` }
    const { data } = await sb.from('project_crew').select('name, role_title, agreed_fee, tds_percent, status, payments:crew_payments(amount)').eq('project_id', project.id)
    let totalBalance = 0
    const people = ((data ?? []) as { name: string; role_title: string | null; agreed_fee: number; tds_percent: number; status: string; payments: { amount: number }[] }[]).map(c => {
      const fee = Number(c.agreed_fee || 0), tds = fee * Number(c.tds_percent || 0) / 100, net = fee - tds
      const paid = (c.payments ?? []).reduce((s, x) => s + Number(x.amount || 0), 0)
      const bal = net - paid; totalBalance += bal
      return { name: c.name, role: c.role_title, agreed_fee: inr(fee), tds: inr(tds), net_payable: inr(net), paid: inr(paid), balance_due: inr(bal), status: c.status }
    })
    return { project: project.name, total_balance_due: inr(totalBalance), people }
  }

  if (name === 'shoot_progress') {
    const project = await findProject(sb, String(input.project ?? ''))
    if (!project) return { error: `No project matching "${input.project}"` }
    const { data } = await sb.from('production_reports').select('report_date, day_number, location, scenes_planned, scenes_completed, status, notes').eq('project_id', project.id).order('report_date', { ascending: false }).limit(60)
    const rows = (data ?? []) as { report_date: string; day_number: number | null; location: string | null; scenes_planned: number; scenes_completed: number; status: string; notes: string | null }[]
    if (!rows.length) return { project: project.name, note: 'No production reports logged for this project yet.' }
    return {
      project: project.name,
      shoot_days_logged: rows.length,
      scenes_completed: rows.reduce((s, r) => s + Number(r.scenes_completed || 0), 0),
      scenes_planned: rows.reduce((s, r) => s + Number(r.scenes_planned || 0), 0),
      days_behind: rows.filter(r => r.status === 'behind').length,
      recent: rows.slice(0, 6).map(r => ({ date: r.report_date, day: r.day_number, location: r.location, scenes: `${r.scenes_completed}/${r.scenes_planned || '—'}`, status: r.status, notes: r.notes })),
    }
  }

  if (name === 'team_checkins') {
    const project = await findProject(sb, String(input.project ?? ''))
    if (!project) return { error: `No project matching "${input.project}"` }
    const [{ data: roster }, { data: logs }] = await Promise.all([
      sb.from('project_members').select('project_role, title, profile:profiles!user_id(full_name)').eq('project_id', project.id),
      sb.from('project_checkins').select('checkin_date, summary, blockers, author:profiles!author_id(full_name)').eq('project_id', project.id).order('checkin_date', { ascending: false }).order('created_at', { ascending: false }).limit(40),
    ])
    const team = ((roster ?? []) as { project_role: string; title: string | null; profile: { full_name?: string } | null }[])
      .map(m => ({ name: m.profile?.full_name ?? 'Unknown', role: m.title || PROJECT_ROLE_LABELS[m.project_role] || m.project_role }))
    const rows = ((logs ?? []) as { checkin_date: string; summary: string; blockers: string | null; author: { full_name?: string } | null }[])
    if (!team.length && !rows.length) return { project: project.name, note: 'No core team or check-ins for this project yet.' }
    return {
      project: project.name,
      core_team: team,
      recent_checkins: rows.map(r => ({ date: r.checkin_date, by: r.author?.full_name ?? 'Unknown', did: r.summary, blocker: r.blockers || null })),
      open_blockers: rows.filter(r => r.blockers).slice(0, 10).map(r => ({ date: r.checkin_date, by: r.author?.full_name ?? 'Unknown', blocker: r.blockers })),
    }
  }

  return { error: 'Unknown tool' }
}

export function assistantSystemPrompt(isFinance: boolean): string {
  const today = new Date().toISOString().slice(0, 10)
  const base = `You are "Ask OPM", an assistant for OPM Cinemas, a film-production company in India (amounts in ₹). Answer using ONLY data returned by your tools — never invent or estimate numbers. If the tools return nothing relevant, say so plainly. Be concise and specific; use ₹ formatting and name the parties/projects. You are READ-ONLY: you cannot create, edit, approve, pay, or delete anything. If asked to take such an action, explain that you can only look things up, and point them to the relevant page. Today's date is ${today}.`
  if (isFinance) {
    return `${base} The user is on the finance team (founder/accountant). You can answer about: cash & bank balances, payroll, liabilities, payments, revenue & project P&L; film BUDGETS & cost reports (budget vs actual per head, over-budget heads); project FUNDING (investors, loans with interest, OPM investment); the CREW & CAST ledger (fees, advances, balance due); SHOOT progress from daily production reports; the per-project CORE TEAM roster and their DAILY CHECK-INS (what each crew member did and any blockers they flagged for the producer); and company DOCUMENTS/CONTRACTS — including AI-extracted summaries, key dates, financial terms and risk flags. Reach for the right tool; you can call several to answer one question.`
  }
  return `${base} The user is a non-finance team member. You can help with projects, payment requests, shoot progress, the project core team and their daily check-ins/blockers, and company documents/contracts they're permitted to see. You do NOT have access to company cash, bank balances, payroll, liabilities, revenue/P&L, budgets, funding or crew pay — if asked about those, say that information is restricted to the finance team and you can't see it. Do not guess.`
}

// Run the full read-only agentic loop and return the answer text.
export async function askOpm(
  history: { role: 'user' | 'assistant'; content: string }[],
  sb: SupabaseClient,
  isFinance: boolean,
): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const tools = isFinance ? ASSISTANT_TOOLS : ASSISTANT_TOOLS.filter(t => ALL_ROLE_TOOLS.includes(t.name))
  const system = assistantSystemPrompt(isFinance)
  const messages: Anthropic.MessageParam[] = history.slice(-12).map(m => ({ role: m.role, content: m.content.slice(0, 4000) }))

  let response = await client.messages.create({ model: 'claude-opus-4-8', max_tokens: 1500, system, tools, messages })
  let guard = 0
  while (response.stop_reason === 'tool_use' && guard < 6) {
    guard++
    messages.push({ role: 'assistant', content: response.content })
    const results: Anthropic.ToolResultBlockParam[] = []
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        let out: unknown
        try { out = await runTool(block.name, (block.input ?? {}) as Json, sb) }
        catch { out = { error: 'query failed' } }
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out).slice(0, 12000) })
      }
    }
    messages.push({ role: 'user', content: results })
    response = await client.messages.create({ model: 'claude-opus-4-8', max_tokens: 1500, system, tools, messages })
  }
  return response.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n').trim()
}
