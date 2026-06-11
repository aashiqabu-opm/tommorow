'use client'

import { useRef } from 'react'
import { Camera, Paperclip, X } from 'lucide-react'

interface Props {
  label: string
  file: File | null
  onChange: (file: File | null) => void
  accept?: string
}

export function FilePicker({ label, file, onChange, accept = 'image/*,.pdf' }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] ?? null)
    e.target.value = ''
  }

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[#8888aa]">{label}</label>
      {/* capture forces the camera app on phones; a mixed-accept input only opens the file browser */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleSelect} className="hidden" />
      <input ref={fileRef} type="file" accept={accept} onChange={handleSelect} className="hidden" />

      {file ? (
        <div className="flex items-center gap-2 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl px-3 py-2.5">
          <Paperclip size={14} className="text-white/60 shrink-0" />
          <span className="flex-1 text-xs text-white truncate">{file.name}</span>
          <button type="button" onClick={() => onChange(null)} className="text-[#8888aa] hover:text-white shrink-0">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl px-3 py-2.5 text-xs font-medium text-white hover:bg-[#2a2a3a] transition-colors"
          >
            <Camera size={14} /> Take Photo
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-[#1a1a24] border border-[#2a2a3a] rounded-xl px-3 py-2.5 text-xs font-medium text-white hover:bg-[#2a2a3a] transition-colors"
          >
            <Paperclip size={14} /> Choose File
          </button>
        </div>
      )}
    </div>
  )
}
