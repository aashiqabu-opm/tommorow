import Image from 'next/image'

// Official OPM Cinemas logo (white version, includes CINEMAS lettering)
interface OPMLogoProps {
  className?: string
  width?: number
  caption?: boolean // kept for call-site compatibility; the PNG already includes the CINEMAS text
}

export function OPMLogo({ className = '', width = 200 }: OPMLogoProps) {
  return (
    <Image
      src="/opm-logo-white.png"
      alt="OPM Cinemas"
      width={900}
      height={326}
      priority
      className={className}
      style={{ width, height: 'auto' }}
    />
  )
}
