import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Public list of OPEN job positions for the careers page. Service-role read,
// returns only open positions and only public-safe fields (no created_by etc.).
export async function GET(req: Request) {
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ positions: [] })
  // IP rate limit: 60 reads per minute (generous — read-only listing).
  if (await rateLimit(admin, `pub:positions:${clientIp(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  const { data } = await admin.from('job_positions')
    .select('id, title, department, type, description')
    .eq('status', 'open').order('created_at', { ascending: false })
  return NextResponse.json({ positions: data ?? [] })
}
