import type { SVGProps } from 'react'

// The non-vegetarian mark, in the same square as VegMarkIcon but with a filled
// triangle standing on its base. India switched to the triangle from a filled
// circle, which is still on plenty of older packets — the triangle is the one a
// guest will meet on a menu today, so it's the one worth learning here.
export const NonVegMarkIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
    <rect x="2.75" y="2.75" width="18.5" height="18.5" stroke="currentColor" strokeWidth={2} />
    <path d="M12 6.23 18.66 17.77H5.34Z" fill="currentColor" />
  </svg>
)
