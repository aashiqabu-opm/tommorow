import { PublicInquiryForm } from '../PublicInquiryForm'

export const dynamic = 'force-dynamic'

export default function ContactPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Contact OPM</h1>
      <p className="text-sm text-[#8888aa] mt-2 mb-6">General enquiries reach the OPM team directly.</p>
      <PublicInquiryForm kind="contact" source="contact" />
    </div>
  )
}
