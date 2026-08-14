import type { SVGProps } from 'react'

export const MapPinIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {/* The teardrop is one closed path so its point stays sharp: the two sides
        meet at 12,21 rather than being capped and rounded off separately. */}
    <path d="M12 21c4.4-4.6 6.6-8 6.6-10.5a6.6 6.6 0 0 0-13.2 0C5.4 13 7.6 16.4 12 21Z" />
    <circle cx="12" cy="10.3" r="2.4" />
  </svg>
)
