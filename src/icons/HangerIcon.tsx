import type { SVGProps } from 'react'

export const HangerIcon = (props: SVGProps<SVGSVGElement>) => (
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
    {/* Hook curls to the left. The stem and body below are symmetric about
        x=12, so mirroring the icon only means mirroring this arc: the sweep
        flag flips and the end point reflects to the other side of the stem. */}
    <path d="M12 9.5a2.25 2.25 0 1 0-2.25-2.25" />
    <path d="M12 9.5v2" />
    <path d="M12 11.5 3.4 17.2a1.25 1.25 0 0 0 .7 2.3h15.8a1.25 1.25 0 0 0 .7-2.3L12 11.5Z" />
  </svg>
)
