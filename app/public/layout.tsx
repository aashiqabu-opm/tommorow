import type { ReactNode } from 'react'
import Link from 'next/link'

export const metadata = { title: 'OPM Cinemas' }

// Standalone public layout — no app shell, no auth, no Toast context.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      <header className="border-b border-[#2a2a3a]">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/public" className="text-lg font-bold tracking-tight">OPM Cinemas</Link>
          <nav className="flex items-center gap-4 text-sm text-[#8888aa]">
            <Link href="/public/careers" className="hover:text-white">Careers</Link>
            <Link href="/public/line-production" className="hover:text-white">Line Production</Link>
            <Link href="/public/contact" className="hover:text-white">Contact</Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-10">{children}</main>
      <footer className="border-t border-[#2a2a3a] py-6 text-center text-xs text-[#5a5a7a]">
        © {new Date().getFullYear()} OPM Cinemas
      </footer>
    </div>
  )
}
