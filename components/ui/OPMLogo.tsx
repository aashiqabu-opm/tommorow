// OPM Cinemas logo — geometric O P M wordmark recreated as SVG
// O = solid circle · P = speech-bubble with bottom-left tail · M = block with V notch
interface OPMLogoProps {
  className?: string
  width?: number
  caption?: boolean
}

export function OPMLogo({ className = '', width = 200, caption = true }: OPMLogoProps) {
  return (
    <div className={`inline-flex flex-col ${className}`} style={{ width }} aria-label="OPM Cinemas">
      <svg viewBox="0 0 340 126" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
        {/* O */}
        <circle cx="48" cy="50" r="48" />
        {/* P — speech bubble with tail at bottom-left */}
        <path d="M118 2 H176 C206 2 222 20 222 48 C222 76 206 98 176 98 H144 L118 124 Z" />
        {/* M — block with V notch at top */}
        <path d="M242 2 L290 44 L338 2 L338 98 L242 98 Z" />
      </svg>
      {caption && (
        <div
          className="text-right font-medium opacity-70 mt-1"
          style={{ fontSize: width * 0.052, letterSpacing: '0.42em', marginRight: '-0.42em' }}
        >
          CINEMAS
        </div>
      )}
    </div>
  )
}
