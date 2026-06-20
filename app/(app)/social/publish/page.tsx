import { getSessionProfile } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/Button'

export const dynamic = 'force-dynamic'

export default async function SocialPublishPage() {
  const profile = await getSessionProfile()
  if (!profile) {
    redirect('/login')
  }

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Create Post</h1>
        <Button variant="secondary">Save Draft</Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="border rounded-lg p-4 bg-white shadow-sm space-y-4">
            <h2 className="font-semibold text-lg">Content</h2>
            <textarea 
              className="w-full min-h-[150px] p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none" 
              placeholder="What do you want to share?"
            ></textarea>
            
            <div className="border-2 border-dashed rounded-lg p-8 text-center text-gray-500 cursor-pointer hover:bg-gray-50">
              <p>Drag and drop photos/videos here</p>
              <p className="text-sm mt-1">or click to browse</p>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <h2 className="font-semibold text-lg mb-4">Publish To</h2>
            <div className="space-y-2">
              <label className="flex items-center space-x-3">
                <input type="checkbox" className="rounded" />
                <span>Facebook (AashiqAbu)</span>
              </label>
              <label className="flex items-center space-x-3">
                <input type="checkbox" className="rounded" />
                <span>Instagram (@aashiqabu)</span>
              </label>
              <label className="flex items-center space-x-3">
                <input type="checkbox" className="rounded" />
                <span>Instagram (@opmrecords)</span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <div className="border rounded-lg p-4 bg-gray-50 h-full">
            <h2 className="font-semibold text-lg mb-4">Preview</h2>
            <div className="bg-white p-4 rounded-lg shadow-sm">
               <div className="flex items-center space-x-3 mb-3">
                 <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                 <div>
                   <p className="font-semibold text-sm">Aashiq Abu</p>
                   <p className="text-xs text-gray-500">Just now</p>
                 </div>
               </div>
               <p className="text-sm text-gray-700 mb-3">Content preview will appear here...</p>
               <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                 Media Preview
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <Button variant="secondary">Schedule</Button>
        <Button>Publish Now</Button>
      </div>
    </div>
  )
}
