import { getSessionProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export default async function SocialDashboardPage() {
  const profile = await getSessionProfile()
  if (!profile || !['founder', 'accountant', 'general_manager', 'executive_producer', 'staff'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Fetch connected accounts from Prisma
  const connectedAccounts = await prisma.socialAccount.findMany({
    orderBy: { createdAt: 'asc' }
  })

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Social Media Management</h1>
        <div className="space-x-4">
          <Link href="/social/publish">
            <Button>Create Post</Button>
          </Link>
          <Link href="/social/inbox">
            <Button variant="secondary">Inbox</Button>
          </Link>
        </div>
      </div>
      
      {connectedAccounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg bg-gray-50">
          <h2 className="text-xl font-semibold mb-2">No Accounts Connected</h2>
          <p className="text-gray-500 mb-6 text-center max-w-md">
            To publish posts, reply to comments, and view deep analytics, you need to connect your Meta Business account.
          </p>
          <a href="/api/auth/facebook">
            <Button size="md" className="bg-blue-600 hover:bg-blue-700">
              Connect with Facebook / Instagram
            </Button>
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {connectedAccounts.map(account => (
            <div key={account.id} className="p-6 border rounded-lg bg-white shadow-sm flex flex-col justify-between h-40">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg capitalize">{account.platform}</h3>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">Connected</span>
                </div>
                <p className="text-gray-500 font-medium">@{account.handle}</p>
              </div>
              <div className="text-sm text-gray-400">
                Connected via API
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
