import Link from 'next/link'
import { Briefcase, Clapperboard, Mail } from 'lucide-react'

export const dynamic = 'force-dynamic'

const CARDS = [
  { href: '/public/careers', icon: Briefcase, title: 'Careers', desc: 'Open positions across OPM Cinemas, Records and productions.' },
  { href: '/public/line-production', icon: Clapperboard, title: 'Line Production', desc: 'Bring your shoot to Kerala — tell us about your production.' },
  { href: '/public/contact', icon: Mail, title: 'Contact', desc: 'General enquiries to the OPM team.' },
]

export default function PublicHome() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Work with OPM Cinemas</h1>
      <p className="text-sm text-[#8888aa] mt-2">Careers, line-production enquiries, and general contact.</p>
      <div className="grid sm:grid-cols-3 gap-4 mt-6">
        {CARDS.map(c => (
          <Link key={c.href} href={c.href} className="rounded-2xl border border-[#2a2a3a] bg-[#13131a] p-5 hover:border-white/30 transition-colors">
            <c.icon size={20} className="text-[#f5b301]" />
            <div className="text-sm font-semibold text-white mt-3">{c.title}</div>
            <p className="text-xs text-[#8888aa] mt-1">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
