import type { SVGProps } from 'react'

// Two arcs meeting at the tips, plus a midrib. Stroked rather than filled so it
// sits at the same weight as the dot marks beside it in a diet badge.
export const LeafIcon = (props: SVGProps<SVGSVGElement>) => (
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
    {/* A stroked outline alone reads lighter than the solid dot beside it, so
        the blade takes the same soft fill MandalaDivider gives its petals. */}
    <path d="M5 19A14 14 0 0 1 19 5 14 14 0 0 1 5 19Z" fill="currentColor" fillOpacity={0.25} />
    <path d="M5 19 15.5 8.5" />
  </svg>
)
