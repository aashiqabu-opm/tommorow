import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { askOpm } from '@/lib/ai/assistant'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!profile?.is_active) return NextResponse.json({ error: 'Inactive account' }, { status: 403 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  let body: { messages?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const incoming = Array.isArray(body.messages) ? body.messages : []
  const history = incoming.filter((m): m is { role: 'user' | 'assistant'; content: string } =>
    !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Send a question' }, { status: 400 })
  }

  // Finance roles get the full toolset; other roles get the all-role subset.
  // Runs through the user's RLS-scoped client, so it can only read what they may see.
  const isFinance = ['founder', 'accountant'].includes(profile.role)

  try {
    const answer = await askOpm(history, supabase, isFinance)
    return NextResponse.json({ answer: answer || 'I could not find an answer to that.' })
  } catch {
    return NextResponse.json({ error: 'The assistant had trouble — please try again.' }, { status: 500 })
  }
}
