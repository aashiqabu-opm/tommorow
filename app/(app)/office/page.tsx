import { getSessionProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function OfficeOperationsPage() {
  const profile = await getSessionProfile()
  if (!profile || !['founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer', 'staff'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Operations portal for Nabeel and Shiny
  const supabase = await createClient()
  const { data: staffClearances } = await supabase.from('StaffClearance').select('*').order('createdAt', { ascending: false })
  
  // Fetch Believe Migrations
  const { data: takeovers } = await supabase.from('BelieveCatalogTakeover').select('*, tracks:TrackMetadata(*)').order('createdAt', { ascending: false })

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">OPM Office Operations</h1>
        <p className="text-gray-500 mt-2">Primary operations portal for core team coordination.</p>
      </div>
      
      <section>
        <h2 className="text-xl font-semibold mb-4">Staff Clearances & Requisitions</h2>
        <div className="grid gap-4">
          {staffClearances && staffClearances.length > 0 ? staffClearances.map((sc) => (
            <div key={sc.id} className="p-4 border rounded-lg bg-white shadow-sm flex items-center justify-between">
              <div>
                <h3 className="font-medium">{sc.taskName}</h3>
                <p className="text-sm text-gray-500 mt-1">Assigned to: <span className="font-medium text-gray-700">{sc.assignedTo}</span></p>
                {sc.requisitionDetails && <p className="text-sm mt-2 text-gray-600 bg-gray-50 p-2 rounded">{sc.requisitionDetails}</p>}
              </div>
              <div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${sc.isCleared ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                  {sc.isCleared ? 'Cleared' : 'Pending'}
                </span>
              </div>
            </div>
          )) : (
            <div className="p-8 text-center border rounded-lg bg-gray-50 text-gray-500 shadow-sm">
              No active staff clearances found. Everything is caught up!
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Believe Catalog Migration Desk</h2>
          <button className="px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors">
            Trigger Manual Ingestion
          </button>
        </div>
        <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-900">Release</th>
                <th className="px-6 py-3 font-medium text-gray-900">Artist</th>
                <th className="px-6 py-3 font-medium text-gray-900">UPC</th>
                <th className="px-6 py-3 font-medium text-gray-900">Tracks</th>
                <th className="px-6 py-3 font-medium text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {takeovers && takeovers.length > 0 ? takeovers.map((t: any) => {
                const tracks = t.tracks || []
                const verifiedTracks = tracks.filter((tr: any) => tr.audioWavUrl && tr.isrcCode && tr.audioWavUrl.includes(tr.isrcCode))
                const complianceRate = tracks.length > 0 ? Math.round((verifiedTracks.length / tracks.length) * 100) : 0
                
                return (
                  <tr key={t.id}>
                    <td className="px-6 py-4 font-medium text-gray-900">{t.releaseTitle}</td>
                    <td className="px-6 py-4 text-gray-500">{t.artistName}</td>
                    <td className="px-6 py-4 text-gray-500">{t.upcCode || '-'}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {tracks.length} <span className="text-xs ml-1">({complianceRate}% Valid)</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        t.migrationStatus === 'Asset_Verified' || t.migrationStatus === 'Pushed_To_Distribution_Center' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {t.migrationStatus.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">No active Believe migrations staged.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
