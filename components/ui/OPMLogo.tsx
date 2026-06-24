import Image from 'next/image'

// OPM Flash app logo — square gold mark with the "OPM FLASH" wordmark baked in.
interface OPMLogoProps {
  className?: string
  width?: number
  caption?: boolean // kept for call-site compatibility (no-op; the PNG includes the wordmark)
}

export function OPMLogo({ className = '', width = 200 }: OPMLogoProps) {
  return (
    <Image
      src="/opm-flash-logo.png"
      alt="OPM Flash"
      width={1254}
      height={1254}
      priority
      className={className}
      style={{ width, height: 'auto' }}
    />
  )
}
