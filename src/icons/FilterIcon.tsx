import type { SVGProps } from 'react'

/**
 * The funnel on a filterable column heading, drawn as three stacked rules
 * rather than a solid hopper — the same shape a spreadsheet puts there, which
 * is the thing this is trying to look like.
 */
export const FilterIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M4 6h16" />
    <path d="M7 12h10" />
    <path d="M10 18h4" />
  </svg>
)
