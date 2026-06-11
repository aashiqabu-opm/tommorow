export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-6 w-48 bg-[#1a1a24] rounded-lg" />
        <div className="h-3.5 w-72 bg-[#16161f] rounded-lg" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[#13131a] border border-[#2a2a3a] rounded-2xl" />
        ))}
      </div>
      <div className="bg-[#13131a] border border-[#2a2a3a] rounded-2xl p-5 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-[#1a1a24] rounded-xl" />
        ))}
      </div>
    </div>
  )
}
