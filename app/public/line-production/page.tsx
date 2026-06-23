import { PublicInquiryForm } from '../PublicInquiryForm'

export const dynamic = 'force-dynamic'

export default function LineProductionPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Line Production Enquiry</h1>
      <p className="text-sm text-[#8888aa] mt-2 mb-6">
        OPM provides full line-production services across Kerala — crew, equipment, locations, permits and logistics.
        Tell us about your production and we'll get back to you.
      </p>
      <PublicInquiryForm kind="line_production" source="line-production" showCompany />
    </div>
  )
}
