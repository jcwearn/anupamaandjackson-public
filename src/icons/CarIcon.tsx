import type { SVGProps } from 'react'

export const CarIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <path d="M6 11.2 8 6.9a2 2 0 0 1 1.8-1.1h4.4A2 2 0 0 1 16 6.9l2 4.3" />
    <rect x="2.5" y="11.2" width="19" height="6" rx="2" />
    <circle cx="7.5" cy="17.2" r="1.9" />
    <circle cx="16.5" cy="17.2" r="1.9" />
    <path d="M5 14h2M17 14h2" />
  </svg>
)
