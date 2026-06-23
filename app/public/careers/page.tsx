import { CareersClient } from './CareersClient'

export const dynamic = 'force-dynamic'

export default function CareersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Careers at OPM</h1>
      <p className="text-sm text-[#8888aa] mt-2 mb-6">Open roles across OPM Cinemas, OPM Records and our productions.</p>
      <CareersClient />
    </div>
  )
}
