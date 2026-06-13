import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

// ─── Read-only tools. Every query is a SELECT through the user's RLS-scoped
//     client, so the assistant can never write and can only see what the
//     signed-in user is allowed to see. ───

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'financial_overview',
    description: "Company-wide money position right now: cash in hand, bank balances, total & overdue liabilities, pending approvals, approved-but-unpaid payments, outstanding receivables, and monthly payroll. Use for 'how are we doing', 'what's our cash position', 'what do we owe'.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'search_payments',
    description: 'Search payment requests (money going out). Filter by free-text on payee/purpose, project name, approval status, payment status, minimum amount, or date range.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
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
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        overdue_only: { type: 'boolean' },
        party: { type: 'string', description: 'Party name (partial match)' },
      },
    },
  },
  {
    name: 'list_receivables',
    description: 'Money owed TO the company (revenue receivables not yet collected). Filter to overdue only.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: { overdue_only: { type: 'boolean' } },
    },
  },
  {
    name: 'project_financials',
    description: "A single project's P&L: realized income vs committed spend (paid + approved-unpaid + outstanding liabilities) and net. Use for 'how is <film> doing', 'P&L for <film>'.",
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: { project: { type: 'string', description: 'Project / film name (partial match)' } },
      required: ['project'],
    },
  },
  {
    name: 'list_projects',
    description: 'List all film projects with status and priority.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
]

type Json = Record<string, unknown>

async function runTool(name: string, input: Json, sb: SupabaseClient): Promise<unknown> {
  const today = new Date().toISOString().slice(0, 10)

  if (name === 'financial_overview') {
    const [banks, cash, payroll, pay, liab, recv] = await Promise.all([
      sb.from('bank_accounts').select('name, current_balance').eq('is_active', true),
      sb.from('cash_entries').select('closing_cash').order('entry_date', { ascending: false }).limit(1),
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
    const term = String(input.project ?? '')
    const { data: projects } = await sb.from('projects').select('id, name').ilike('name', `%${term}%`).limit(1)
    const project = projects?.[0]
    if (!project) return { error: `No project matching "${term}"` }
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
      project: project.name,
      realized_income: inr(realized),
      receivable_income: inr(receivable),
      committed_spend: inr(committed),
      net_pnl: inr(realized - committed),
      net_with_receivables: inr(realized + receivable - committed),
    }
  }

  if (name === 'list_projects') {
    const { data } = await sb.from('projects').select('name, status, is_priority').order('is_priority', { ascending: false }).order('name')
    return (data ?? []).map(p => ({ name: p.name, status: p.status, priority: !!p.is_priority }))
  }

  return { error: 'Unknown tool' }
}

const SYSTEM = `You are "Ask OPM", a financial assistant for OPM Cinemas, a film-production company in India (amounts in ₹). Answer the user's questions about the company's finances using ONLY data returned by your tools — never invent or estimate numbers. If the tools return nothing relevant, say so plainly. Be concise and specific; use ₹ formatting and name the parties/projects. You are READ-ONLY: you cannot create, edit, approve, pay, or delete anything. If asked to take such an action, explain that you can only look things up, and point them to the relevant page (Payments, Liabilities, Revenue, etc.). Today's date is ${new Date().toISOString().slice(0, 10)}.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!profile?.is_active || !['founder', 'accountant'].includes(profile.role)) {
    return NextResponse.json({ error: 'Ask OPM is available to founders and accountants.' }, { status: 403 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  }

  let body: { messages?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const incoming = Array.isArray(body.messages) ? body.messages : []
  const messages: Anthropic.MessageParam[] = incoming
    .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
      !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }))
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Send a question' }, { status: 400 })
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    let response = await client.messages.create({ model: 'claude-opus-4-8', max_tokens: 1500, system: SYSTEM, tools: TOOLS, messages })

    let guard = 0
    while (response.stop_reason === 'tool_use' && guard < 6) {
      guard++
      messages.push({ role: 'assistant', content: response.content })
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          let out: unknown
          try { out = await runTool(block.name, (block.input ?? {}) as Json, supabase) }
          catch { out = { error: 'query failed' } }
          results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out).slice(0, 12000) })
        }
      }
      messages.push({ role: 'user', content: results })
      response = await client.messages.create({ model: 'claude-opus-4-8', max_tokens: 1500, system: SYSTEM, tools: TOOLS, messages })
    }

    const answer = response.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n').trim()
    return NextResponse.json({ answer: answer || 'I could not find an answer to that.' })
  } catch {
    return NextResponse.json({ error: 'The assistant had trouble — please try again.' }, { status: 500 })
  }
}
