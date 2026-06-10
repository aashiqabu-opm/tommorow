import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '_')
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-[#8888aa]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#5a5a7a]',
          'focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-red-500/50 focus:ring-red-500/40',
          className
        )}
        {...props}
      />
      {hint && !error && <p className="text-[11px] text-[#8888aa]">{hint}</p>}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '_')
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-[#8888aa]">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={3}
        className={cn(
          'w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#5a5a7a] resize-none',
          'focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40',
          error && 'border-red-500/50',
          className
        )}
        {...props}
      />
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export function Select({ label, error, options, placeholder, className, id, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '_')
  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-[#8888aa]">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={cn(
          'w-full bg-[#1a1a24] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white',
          'focus:outline-none focus:ring-1 focus:ring-white/40 focus:border-white/40',
          'disabled:opacity-50',
          error && 'border-red-500/50',
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#1a1a24]">
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  )
}
