import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyzeCollectionTrend, fetchCollectionEstimate, scanOnline, trackCampaignAsset, intelConfigured } from '@/lib/ai/release-intel'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// On-demand release intelligence for one project. action:
//   'trend' — AI commentary over the saved day-wise collections
//   'fetch' — AI web-search a fresh box-office number (staged unconfirmed)
//   'scan'  — AI web-search for piracy + reputation threats (saves findings)
// Management only. Read-only on money — fetched numbers are unconfirmed.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single()
  if (!me?.is_active || !['founder', 'accountant', 'general_manager', 'executive_producer'].includes(me.role)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }
  if (!intelConfigured()) return NextResponse.json({ error: 'AI is not configured (ANTHROPIC_API_KEY missing).' }, { status: 503 })

  const { data: project } = await supabase.from('projects').select('id, name, status, start_date').eq('id', id).single()
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  let body: { action?: string; assetId?: string } = {}
  try { body = await request.json() } catch { /* noop */ }
  const action = body.action ?? ''
  const ctx = project.start_date ? `OPM Cinemas film, ${project.status}, started ${project.start_date}` : `OPM Cinemas film, ${project.status}`
  const admin = createAdminClient()

  if (action === 'trend') {
    const { data: rows } = await supabase.from('box_office_collections')
      .select('day_number, collection_date, india_net, worldwide_gross, occupancy')
      .eq('project_id', id).order('collection_date', { ascending: true })
    const analysis = await analyzeCollectionTrend(project.name, rows ?? [])
    if (!analysis) return NextResponse.json({ error: 'Not enough data to analyze yet.' }, { status: 422 })
    return NextResponse.json({ ok: true, analysis })
  }

  if (action === 'fetch') {
    const est = await fetchCollectionEstimate(project.name, ctx)
    if (!est || (!est.india_net && !est.worldwide_gross)) {
      return NextResponse.json({ error: est?.note || 'No reliable collection figure found right now.' }, { status: 422 })
    }
    const today = new Date().toISOString().slice(0, 10)
    const db = admin ?? supabase
    await db.from('box_office_collections').upsert({
      project_id: id, collection_date: today, day_number: est.day_number,
      india_net: est.india_net, worldwide_gross: est.worldwide_gross,
      source: est.source ?? 'AI web search', confirmed: false, notes: est.note?.slice(0, 300) ?? null,
    }, { onConflict: 'project_id,collection_date' })
    return NextResponse.json({ ok: true, estimate: est })
  }

  if (action === 'scan') {
    const findings = await scanOnline(project.name, ctx)
    const today = new Date().toISOString().slice(0, 10)
    const db = admin ?? supabase
    if (findings.length) {
      await db.from('monitoring_findings').insert(findings.map(f => ({
        project_id: id, scan_date: today, category: f.category, severity: f.severity,
        title: f.title.slice(0, 200), detail: f.detail?.slice(0, 1000) ?? null, url: f.url ?? null,
      })))
    }
    return NextResponse.json({ ok: true, count: findings.length, findings })
  }

  if (action === 'asset') {
    if (!body.assetId) return NextResponse.json({ error: 'assetId required' }, { status: 400 })
    const { data: asset } = await supabase.from('campaign_assets').select('*').eq('id', body.assetId).eq('project_id', id).single()
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    const buzz = await trackCampaignAsset(project.name, asset.asset_type, asset.title, asset.url)
    if (!buzz) return NextResponse.json({ error: 'Could not pull buzz right now.' }, { status: 422 })
    const db = admin ?? supabase
    await db.from('campaign_assets').update({
      ai_summary: buzz.summary,
      ai_metrics: { ...buzz.metrics, sentiment: buzz.sentiment },
      last_checked: new Date().toISOString(),
    }).eq('id', asset.id)
    return NextResponse.json({ ok: true, buzz })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
