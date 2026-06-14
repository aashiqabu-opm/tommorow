import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp, sendEmail, emailTemplate, sleep } from '@/lib/alerts/channels'
import { escapeHtml } from '@/lib/alerts/deliver'
import { reportError } from '@/lib/monitoring'

export const dynamic = 'force-dynamic'
export const maxDuration = 90

const SCHED_EDIT = ['director', 'chief_ad', 'associate_director', 'production_controller']
const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''

// Assemble + distribute a shoot day's call sheet to the unit (WhatsApp + email).
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('role, is_active, full_name').eq('id', user.id).single()
    if (!profile?.is_active) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let payload: { dayId?: unknown; previewOnly?: unknown }
    try { payload = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
    const dayId = typeof payload.dayId === 'string' ? payload.dayId : ''
    if (!dayId) return NextResponse.json({ error: 'dayId required' }, { status: 400 })
    const previewOnly = payload.previewOnly === true

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'service key missing' }, { status: 500 })

    const { data: day } = await admin.from('project_schedule').select('*, project:projects(name)').eq('id', dayId).single()
    if (!day) return NextResponse.json({ error: 'Shoot day not found' }, { status: 404 })
    const projectId = day.project_id as string

    // Permission: founder/EP/GM, or AD-dept on this project.
    const { data: mem } = await admin.from('project_members').select('project_role').eq('project_id', projectId).eq('user_id', user.id).maybeSingle()
    const allowed = ['founder', 'general_manager', 'executive_producer'].includes(profile.role) || SCHED_EDIT.includes(mem?.project_role ?? '')
    if (!allowed) return NextResponse.json({ error: 'Only the AD department / producers can send call sheets' }, { status: 403 })

    const [{ data: loc }, { data: dayScenes }, { data: reqs }, { data: members }] = await Promise.all([
      day.location_id ? admin.from('locations').select('name, address, map_link, nearest_hospital').eq('id', day.location_id).single() : Promise.resolve({ data: null }),
      admin.from('schedule_day_scenes').select('sort_order, scene:scenes(scene_no, int_ext, day_night, synopsis, set_name)').eq('schedule_day_id', dayId).order('sort_order'),
      admin.from('day_requirements').select('category, label, qty, dept').eq('schedule_day_id', dayId),
      admin.from('project_members').select('member_name, member_email, member_phone, profile:profiles!user_id(full_name, email, whatsapp_number)').eq('project_id', projectId),
    ])

    const scenes = (dayScenes ?? []) as any[]
    const reqsArr = (reqs ?? []) as any[]
    const mArr = (members ?? []) as any[]

    // Assemble the call sheet text.
    const L: string[] = []
    L.push(`🎬 CALL SHEET — ${day.project?.name ?? 'Film'}`)
    L.push(`${day.day_number ? `Shoot Day ${day.day_number} · ` : ''}${fmt(day.shoot_date)}`)
    L.push(`Call: ${day.call_time || 'TBA'}${day.est_wrap ? ` · Est. wrap: ${day.est_wrap}` : ''}`)
    if (loc) L.push(`Location: ${loc.name}${loc.address ? `, ${loc.address}` : ''}${loc.map_link ? `\nMap: ${loc.map_link}` : ''}`)
    if (day.weather) L.push(`Weather: ${day.weather}`)
    if (day.sunrise || day.sunset) L.push(`Sunrise ${day.sunrise || '—'} · Sunset ${day.sunset || '—'}`)
    L.push('')
    L.push('SCENES:')
    if (!scenes.length) L.push('  (none assigned)')
    scenes.forEach(s => L.push(`  • Sc ${s.scene?.scene_no} — ${s.scene?.int_ext} ${s.scene?.day_night}${s.scene?.set_name ? ` · ${s.scene.set_name}` : ''}${s.scene?.synopsis ? `: ${s.scene.synopsis}` : ''}`))
    if (reqsArr.length) {
      L.push('')
      L.push('REQUIREMENTS:')
      const byCat: Record<string, string[]> = {}
      for (const r of reqsArr) { (byCat[r.category] ||= []).push(`${r.label}${r.qty > 1 ? ` ×${r.qty}` : ''}${r.dept ? ` (${r.dept})` : ''}`) }
      for (const [c, items] of Object.entries(byCat)) L.push(`  ${c.replace(/_/g, ' ')}: ${items.join(', ')}`)
    }
    if (loc?.nearest_hospital) { L.push(''); L.push(`🏥 Nearest hospital: ${loc.nearest_hospital}`) }
    if (day.notes) { L.push(''); L.push(`Notes: ${day.notes}`) }
    const text = L.join('\n')

    if (previewOnly) return NextResponse.json({ ok: true, text, recipients: mArr.length })

    // Distribute.
    const html = emailTemplate(`Call Sheet — ${day.project?.name ?? 'Film'} (${fmt(day.shoot_date)})`,
      `<pre style="white-space:pre-wrap;font-family:inherit;font-size:14px;margin:0;">${escapeHtml(text)}</pre>`)
    let wa = 0, em = 0
    const seenW = new Set<string>(), seenE = new Set<string>()
    for (const m of mArr) {
      const phone = m.member_phone || m.profile?.whatsapp_number
      const email = m.member_email || m.profile?.email
      if (phone && !seenW.has(phone)) { seenW.add(phone); if (await sendWhatsApp(phone, text)) wa++ }
      if (email && !seenE.has(email)) { seenE.add(email); if (await sendEmail(email, `Call Sheet — ${fmt(day.shoot_date)}`, html)) em++; await sleep(400) }
    }
    await admin.from('call_sheets').insert({ project_id: projectId, schedule_day_id: dayId, channels: `wa:${wa},email:${em}`, recipients: wa + em, sent_by: user.id, body: text })
    return NextResponse.json({ ok: true, text, sent: { whatsapp: wa, email: em } })
  } catch (e) {
    await reportError('callsheet/send', e)
    return NextResponse.json({ error: 'Failed to send call sheet' }, { status: 500 })
  }
}
