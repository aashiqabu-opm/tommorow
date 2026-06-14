import Anthropic from '@anthropic-ai/sdk'

// Turns a morning financial snapshot into a prioritized founder's briefing.
// Uses Claude when configured; falls back to a deterministic summary so the
// monitor always sends something useful.

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export interface BriefingSnapshot {
  dateStr: string
  cashOnHand: number
  bankBalance: number
  monthlyPayroll: number
  pendingApprovals: { payee: string; amount: number; purpose: string }[]
  approvedUnpaid: { payee: string; amount: number }[]
  overdueLiabilities: { party: string; amount: number; due: string }[]
  dueSoonLiabilities: { party: string; amount: number; due: string }[]
  overdueReceivables: { project: string; party: string; amount: number; expected: string }[]
  expiringDocs: { title: string; expiry: string }[]
  docKeyDates?: { title: string; label: string; date: string }[]
  docFlags?: { title: string; severity: string; note: string }[]
  budgetAlerts?: { project: string; head: string; budget: number; actual: number; pct: number }[]
  monthlyBurn?: number              // trailing-90d net operating outflow / month
  runwayWeeks?: number | null       // weeks of runway at current burn; null = burn ≤ 0 (cash-positive)
}

export interface Briefing {
  headline: string
  itemsHtml: string   // <li>…</li> list for the email
  whatsapp: string    // short urgent line
  hasUrgent: boolean
}

function snapshotToText(s: BriefingSnapshot): string {
  const lines: string[] = []
  lines.push(`Date: ${s.dateStr}`)
  lines.push(`Cash in hand: ${inr(s.cashOnHand)}; Bank balance: ${inr(s.bankBalance)}; Total available: ${inr(s.cashOnHand + s.bankBalance)}`)
  lines.push(`Recurring monthly payroll: ${inr(s.monthlyPayroll)}`)
  if (s.monthlyBurn !== undefined) {
    const runway = s.runwayWeeks === null ? 'cash-positive (no burn)' : s.runwayWeeks === undefined ? 'n/a' : `${s.runwayWeeks} weeks of runway`
    lines.push(`Monthly burn (trailing 90d, payroll + paid bills − income received): ${inr(s.monthlyBurn)}; cash runway: ${runway}`)
  }
  const committed = s.approvedUnpaid.reduce((a, b) => a + b.amount, 0)
  lines.push(`Approved-but-unpaid (committed outflow): ${inr(committed)} across ${s.approvedUnpaid.length}`)
  lines.push(`Pending approvals: ${s.pendingApprovals.length} totalling ${inr(s.pendingApprovals.reduce((a, b) => a + b.amount, 0))}`)
  s.pendingApprovals.slice(0, 8).forEach(p => lines.push(`  - approval pending: ${p.payee} ${inr(p.amount)} (${p.purpose})`))
  s.overdueLiabilities.forEach(l => lines.push(`  - OVERDUE liability: ${l.party} ${inr(l.amount)} (due ${l.due})`))
  s.dueSoonLiabilities.forEach(l => lines.push(`  - liability due soon: ${l.party} ${inr(l.amount)} (due ${l.due})`))
  s.overdueReceivables.forEach(r => lines.push(`  - OVERDUE receivable: ${r.party} owes ${inr(r.amount)} for ${r.project} (expected ${r.expected})`))
  s.expiringDocs.forEach(d => lines.push(`  - agreement expiring: ${d.title} (expires ${d.expiry})`))
  ;(s.docKeyDates ?? []).forEach(d => lines.push(`  - contract date approaching: "${d.title}" — ${d.label} on ${d.date}`))
  ;(s.docFlags ?? []).forEach(f => lines.push(`  - contract risk (${f.severity}) in "${f.title}": ${f.note}`))
  ;(s.budgetAlerts ?? []).forEach(b => lines.push(`  - budget watch: ${b.project} — "${b.head}" at ${b.pct}% (${inr(b.actual)} of ${inr(b.budget)})`))
  return lines.join('\n')
}

const SYSTEM = `You are the CFO assistant for OPM Cinemas, a film-production company in India (amounts in ₹). Each morning you read a financial snapshot and write the founder a short briefing: only the things that genuinely need attention today, ordered by urgency and money at risk. Be specific — names and ₹ amounts. Plain and direct, no filler, no greetings. Call out cash-flow risk when upcoming committed outflows (approved-unpaid + overdue dues + near-term payroll) approach available cash. Also surface any time-sensitive contract dates (renewals, payment milestones, delivery deadlines) and high-risk clauses flagged from documents, and any film budget heads trending over their estimate (≥90% used, urgent if over 100%). When a cash runway is given, call it out if it falls below ~8 weeks (urgent below 4) — state the runway and the monthly burn. If something is fine, don't mention it.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string', description: 'One-line summary of the day (≤ 90 chars)' },
    items: {
      type: 'array',
      description: '2–6 prioritized points that need attention',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          priority: { type: 'string', description: 'One of: urgent, watch, fyi' },
          text: { type: 'string', description: 'Specific, actionable point with names and ₹ amounts' },
        },
        required: ['priority', 'text'],
      },
    },
    whatsapp: { type: 'string', description: 'Short WhatsApp line covering only urgent/watch items (≤ 300 chars), or empty if nothing urgent' },
  },
  required: ['headline', 'items', 'whatsapp'],
}

function deterministicBriefing(s: BriefingSnapshot): Briefing {
  const items: { priority: string; text: string }[] = []
  const available = s.cashOnHand + s.bankBalance
  const committed = s.approvedUnpaid.reduce((a, b) => a + b.amount, 0) +
    s.overdueLiabilities.reduce((a, b) => a + b.amount, 0)
  if (committed > available * 0.8 && committed > 0) {
    items.push({ priority: 'urgent', text: `Cash watch: ${inr(committed)} committed/overdue vs ${inr(available)} available.` })
  }
  if (typeof s.runwayWeeks === 'number' && s.runwayWeeks <= 8) {
    items.push({ priority: s.runwayWeeks <= 4 ? 'urgent' : 'watch', text: `Cash runway ~${s.runwayWeeks} week(s) at current burn (${inr(s.monthlyBurn ?? 0)}/mo).` })
  }
  if (s.overdueLiabilities.length) items.push({ priority: 'urgent', text: `${s.overdueLiabilities.length} overdue ${s.overdueLiabilities.length === 1 ? 'liability' : 'liabilities'}: ${s.overdueLiabilities.slice(0, 3).map(l => `${l.party} ${inr(l.amount)}`).join(', ')}.` })
  if (s.pendingApprovals.length) items.push({ priority: 'watch', text: `${s.pendingApprovals.length} payment ${s.pendingApprovals.length === 1 ? 'request' : 'requests'} awaiting approval (${inr(s.pendingApprovals.reduce((a, b) => a + b.amount, 0))}).` })
  if (s.overdueReceivables.length) items.push({ priority: 'watch', text: `${s.overdueReceivables.length} overdue receivable(s): ${s.overdueReceivables.slice(0, 3).map(r => `${r.party} ${inr(r.amount)}`).join(', ')}.` })
  if (s.dueSoonLiabilities.length) items.push({ priority: 'fyi', text: `${s.dueSoonLiabilities.length} liabilit${s.dueSoonLiabilities.length === 1 ? 'y' : 'ies'} due within 2 weeks.` })
  if (s.expiringDocs.length) items.push({ priority: 'fyi', text: `${s.expiringDocs.length} agreement(s) expiring within 30 days.` })
  ;(s.docKeyDates ?? []).slice(0, 3).forEach(d => items.push({ priority: 'watch', text: `Contract date: "${d.title}" — ${d.label} on ${d.date}.` }))
  ;(s.docFlags ?? []).filter(f => f.severity === 'high').slice(0, 3).forEach(f => items.push({ priority: 'watch', text: `Contract risk in "${f.title}": ${f.note}` }))
  ;(s.budgetAlerts ?? []).slice(0, 4).forEach(b => items.push({ priority: b.pct >= 100 ? 'urgent' : 'watch', text: `Budget: ${b.project} "${b.head}" at ${b.pct}% (${inr(b.actual)} of ${inr(b.budget)}).` }))

  const urgent = items.filter(i => i.priority === 'urgent' || i.priority === 'watch')
  return {
    headline: items.length ? 'Items need your attention today' : 'All clear — nothing pressing today',
    itemsHtml: items.map(i => `<li><strong>${i.priority.toUpperCase()}:</strong> ${i.text}</li>`).join(''),
    whatsapp: urgent.slice(0, 4).map(i => `• ${i.text}`).join('\n'),
    hasUrgent: urgent.length > 0,
  }
}

export async function generateBriefing(snapshot: BriefingSnapshot): Promise<Briefing> {
  if (!process.env.ANTHROPIC_API_KEY) return deterministicBriefing(snapshot)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: `Today's snapshot:\n\n${snapshotToText(snapshot)}\n\nWrite the briefing.` }],
    })
    const block = response.content.find(b => b.type === 'text')
    if (!block || block.type !== 'text') return deterministicBriefing(snapshot)
    const parsed = JSON.parse(block.text) as { headline: string; items: { priority: string; text: string }[]; whatsapp: string }
    const items = (parsed.items ?? []).filter(i => i?.text)
    const hasUrgent = items.some(i => i.priority === 'urgent' || i.priority === 'watch')
    return {
      headline: parsed.headline || 'Morning briefing',
      itemsHtml: items.map(i => `<li><strong>${String(i.priority).toUpperCase()}:</strong> ${escapeHtml(i.text)}</li>`).join(''),
      whatsapp: (parsed.whatsapp || '').trim(),
      hasUrgent,
    }
  } catch {
    return deterministicBriefing(snapshot)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
