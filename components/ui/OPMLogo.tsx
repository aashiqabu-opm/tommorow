// OPM Cinemas logo — geometric O P M wordmark
export function OPMLogo({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const scales = { sm: 0.45, md: 0.7, lg: 1 }
  const s = scales[size]

  return (
    <svg
      viewBox="0 0 320 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ width: 320 * s, height: 110 * s }}
      aria-label="OPM Cinemas"
    >
      {/* O — circle */}
      <circle cx="47" cy="47" r="44" fill="currentColor" />

      {/* P — speech-bubble shape */}
      <path
        d="M112 6 C112 6 164 6 164 6 C186 6 192 18 192 34
           L192 60 C192 76 180 86 164 86
           L138 86 L126 103 L126 86
           C112 86 112 72 112 60 Z"
        fill="currentColor"
      />

      {/* M — left rectangle + right-pointing triangle */}
      <rect x="208" y="6" width="38" height="94" rx="4" fill="currentColor" />
      <path d="M250 6 L318 50 L250 100 Z" fill="currentColor" opacity="0.55" />
      <path d="M250 6 L310 6 L310 100 L250 100 Z" fill="currentColor" opacity="0.55" />
      <path d="M250 6 L318 50 L250 100 Z" fill="currentColor" />

      {/* CINEMAS label under M */}
      <text
        x="208"
        y="106"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontSize="11"
        letterSpacing="5"
        fill="currentColor"
        opacity="0.7"
      >
        CINEMAS
      </text>
    </svg>
  )
}

// Compact mark for sidebar (just the O)
export function OPMMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} width={32} height={32}>
      <circle cx="16" cy="16" r="13" fill="currentColor" />
    </svg>
  )
}
