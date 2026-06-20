'use client'

export default function Error({ reset }: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <p className="text-[#8888aa] text-sm">Something went wrong.</p>
      <button onClick={reset} className="text-[#f5b301] text-sm underline">
        Try again
      </button>
    </div>
  )
}
