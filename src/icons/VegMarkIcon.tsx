import type { SVGProps } from 'react'

// The vegetarian mark India prints on menus and packets: a filled circle inside a
// square outline. The geometry follows FSSAI's own drawing — square corners, and a
// circle a third of the square across. The colour comes from the consumer.
export const VegMarkIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <rect x="2.75" y="2.75" width="18.5" height="18.5" stroke="currentColor" strokeWidth={2} />
    <circle cx="12" cy="12" r="6.15" fill="currentColor" />
  </svg>
)
