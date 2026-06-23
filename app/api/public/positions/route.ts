import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Public list of OPEN job positions for the careers page. Service-role read,
// returns only open positions and only public-safe fields (no created_by etc.).
export async function GET() {
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ positions: [] })
  const { data } = await admin.from('job_positions')
    .select('id, title, department, type, description')
    .eq('status', 'open').order('created_at', { ascending: false })
  return NextResponse.json({ positions: data ?? [] })
}
