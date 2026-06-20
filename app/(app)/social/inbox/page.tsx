import { getSessionProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function SocialInboxPage() {
  const profile = await getSessionProfile()
  if (!profile) {
    redirect('/login')
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] -m-8">
      {/* Sidebar / Conversations List */}
      <div className="w-1/3 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">Unified Inbox</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 text-center text-gray-500 mt-10">
            No active conversations. Connect your accounts to see messages and comments.
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-gray-50 flex flex-col">
         <div className="flex-1 flex items-center justify-center text-gray-400">
           Select a conversation to reply
         </div>
      </div>
    </div>
  )
}
