import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireProfile } from '@/lib/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { AttendanceClient, type Geofence, type AttLog, type CrewOpt } from '../AttendanceClient'

export const dynamic = 'force-dynamic'

/* eslint-disable @typescript-eslint/no-explicit-any */

// Attendance + geofences. Management roles; founder deletes.
export default async function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireProfile()
  if (!['founder', 'accountant', 'general_manager', 'executive_producer'].includes(profile.role)) redirect(`/projects/${id}`)

  const supabase = await createClient()
  const [{ data: project }, { data: geofences }, { data: logs }, { data: crewRaw }] = await Promise.all([
    supabase.from('projects').select('id, name').eq('id', id).single(),
    supabase.from('geofences').select('*').eq('project_id', id).order('name'),
    supabase.from('attendance_logs').select('*').eq('project_id', id).order('log_date', { ascending: false }).limit(200),
    supabase.from('crew_onboarding')
      .select('id, full_name, consents:crew_consents(consent_type, granted)')
      .eq('project_id', id).order('full_name'),
  ])
  if (!project) notFound()

  // crew with a derived location-tracking consent flag
  const crew: CrewOpt[] = (crewRaw ?? []).map((c: any) => ({
    id: c.id,
    full_name: c.full_name,
    location_consent: (c.consents ?? []).some((x: any) => x.consent_type === 'location_tracking' && x.granted),
  }))

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/projects/${id}`} className="inline-flex items-center gap-1.5 text-xs text-[#8888aa] hover:text-white mb-4">
        <ArrowLeft size={13} /> Back to project
      </Link>
      <PageHeader title={`${project.name} — Attendance`} subtitle="Geofenced work zones and crew attendance. Location capture only with recorded consent." />
      <AttendanceClient
        projectId={id}
        geofences={(geofences ?? []) as Geofence[]}
        logs={(logs ?? []) as AttLog[]}
        crew={crew}
        userId={profile.id}
        canManage={true}
        canDelete={profile.role === 'founder'}
      />
    </div>
  )
}
