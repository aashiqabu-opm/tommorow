import { getSessionProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getYoutubeFinancials } from '@/lib/youtube'
import { getDriveData } from '@/lib/drive'
import { getFacebookData } from '@/lib/facebook'
import { getInstagramData } from '@/lib/instagram'

export const dynamic = 'force-dynamic'

export default async function CommandCenterPage() {
  const profile = await getSessionProfile()
  if (!profile || !['founder', 'accountant', 'general_manager', 'executive_producer', 'legal_viewer', 'staff'].includes(profile.role)) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const { data: pipelines } = await supabase.from('pipelines').select('*').order('createdAt', { ascending: false })

  const youtubeData = await getYoutubeFinancials()
  const isYoutubeConnected = youtubeData.status === 'success'

  const driveData = await getDriveData()
  const isDriveConnected = driveData.status === 'success'

  const facebookData = await getFacebookData()
  const isFacebookConnected = facebookData.status === 'success'

  const aashiqInsta = await getInstagramData('aashiqabu')
  const isAashiqInstaConnected = aashiqInsta.status === 'success'

  const opmInsta = await getInstagramData('opmrecords')
  const isOpmInstaConnected = opmInsta.status === 'success'

  const opmCinemasInsta = await getInstagramData('opmcinemas')
  const isOpmCinemasInstaConnected = opmCinemasInsta.status === 'success'

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">OPM Control Center</h1>
      
      {/* System Status row */}
      <section>
        <h2 className="text-xl font-semibold mb-4">System Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
          <div className="p-4 border rounded-lg bg-white shadow-sm flex flex-col justify-center items-center text-center">
            <h3 className="font-medium text-gray-500">Google Drive</h3>
            {isDriveConnected ? (
              <p className="text-xl font-bold mt-2 text-green-600">
                {driveData.folderFound ? `Synced (${driveData.filesCount} files)` : 'No OPM Folder'}
              </p>
            ) : (
              <p className="text-2xl font-bold mt-2 text-orange-500">Awaiting Auth</p>
            )}
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm flex flex-col justify-center items-center text-center">
            <h3 className="font-medium text-gray-500">Gmail</h3>
            <p className="text-2xl font-bold mt-2 text-green-600">Synced</p>
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm flex flex-col justify-center items-center text-center">
            <h3 className="font-medium text-gray-500">Meta (AashiqAbu)</h3>
            {isFacebookConnected ? (
              <p className="text-xl font-bold mt-2 text-blue-600">
                {facebookData.followers} Followers
              </p>
            ) : (
              <p className="text-2xl font-bold mt-2 text-orange-500">Awaiting Auth</p>
            )}
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm flex flex-col justify-center items-center text-center">
            <h3 className="font-medium text-gray-500">IG (@aashiqabu)</h3>
            {isAashiqInstaConnected ? (
              <p className="text-xl font-bold mt-2 text-fuchsia-600">
                {aashiqInsta.followers} Followers
              </p>
            ) : (
              <p className="text-2xl font-bold mt-2 text-orange-500">Awaiting Auth</p>
            )}
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm flex flex-col justify-center items-center text-center">
            <h3 className="font-medium text-gray-500">IG (@opmrecords)</h3>
            {isOpmInstaConnected ? (
              <p className="text-xl font-bold mt-2 text-fuchsia-600">
                {opmInsta.followers} Followers
              </p>
            ) : (
              <p className="text-2xl font-bold mt-2 text-orange-500">Awaiting Auth</p>
            )}
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm flex flex-col justify-center items-center text-center">
            <h3 className="font-medium text-gray-500">IG (@opmcinemas)</h3>
            {isOpmCinemasInstaConnected ? (
              <p className="text-xl font-bold mt-2 text-fuchsia-600">
                {opmCinemasInsta.followers} Followers
              </p>
            ) : (
              <p className="text-2xl font-bold mt-2 text-orange-500">Awaiting Auth</p>
            )}
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm flex flex-col justify-center items-center text-center">
            <h3 className="font-medium text-gray-500">YouTube CMS</h3>
            {isYoutubeConnected ? (
              <p className="text-2xl font-bold mt-2 text-green-600">Connected</p>
            ) : (
              <p className="text-2xl font-bold mt-2 text-orange-500">Awaiting Auth</p>
            )}
          </div>
        </div>
      </section>

      {/* Live Pipelines section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Live Pipelines</h2>
        <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 font-medium text-gray-900">Stage</th>
                <th className="px-6 py-3 font-medium text-gray-900">Milestone</th>
                <th className="px-6 py-3 font-medium text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pipelines && pipelines.length > 0 ? pipelines.map((p) => (
                <tr key={p.id}>
                  <td className="px-6 py-4">{p.stage}</td>
                  <td className="px-6 py-4">{p.milestone || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-gray-500">No active pipelines found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Financial section */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Financial Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg bg-white shadow-sm flex flex-col justify-center items-center">
            <h3 className="font-medium text-gray-500">Live Revenue Flow</h3>
            {isYoutubeConnected ? (
              <p className="text-2xl font-bold mt-2 text-emerald-600">₹ {youtubeData.revenue}</p>
            ) : (
              <p className="text-xl font-bold mt-2 text-orange-500">Awaiting Auth</p>
            )}
          </div>
          <div className="p-4 border rounded-lg bg-white shadow-sm flex flex-col justify-center items-center">
            <h3 className="font-medium text-gray-500">Run Rate</h3>
            {isYoutubeConnected ? (
              <p className="text-2xl font-bold mt-2 text-indigo-600">₹ {youtubeData.runRate} / mo</p>
            ) : (
              <p className="text-xl font-bold mt-2 text-orange-500">Awaiting Auth</p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
