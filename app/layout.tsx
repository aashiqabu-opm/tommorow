import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'OPM Office',
  description: 'Internal office operating system for OPM Cinemas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  )
}
