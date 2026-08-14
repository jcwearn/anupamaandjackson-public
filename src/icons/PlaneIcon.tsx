import type { SVGProps } from 'react'

export const PlaneIcon = (props: SVGProps<SVGSVGElement>) => (
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
    <path d="M12 2c1.1 0 2 1.7 2 3.8V9.2l7 4.2v2.2l-7-2v4l2.4 2v1.6L12 20.2l-4.4.8v-1.6l2.4-2v-4l-7 2v-2.2l7-4.2V5.8C10 3.7 10.9 2 12 2Z" />
  </svg>
)
