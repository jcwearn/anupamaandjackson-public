import type { SVGProps } from 'react'

/**
 * Solid rather than stroked, unlike the rest of this folder. A gear outlined at
 * the same 1.5 weight as the others reads as a smudge at the 20px it renders at
 * in the nav bar — the teeth and the centre hole are too fine to survive.
 */
export const CogIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    {/* One path, two subpaths: the toothed body and the centre bore. evenodd is
        what punches the second out of the first. */}
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M13.9 2.2h-3.8l-.42 2.32a7.8 7.8 0 0 0-1.9.79L5.72 3.94 3.03 6.63l1.37 2.06a7.8 7.8 0 0 0-.79 1.9L1.29 11v3.8l2.32.42c.19.67.46 1.3.79 1.9l-1.37 2.06 2.69 2.69 2.06-1.37c.6.33 1.23.6 1.9.79l.42 2.32h3.8l.42-2.32a7.8 7.8 0 0 0 1.9-.79l2.06 1.37 2.69-2.69-1.37-2.06c.33-.6.6-1.23.79-1.9l2.32-.42V11l-2.32-.42a7.8 7.8 0 0 0-.79-1.9l1.37-2.06-2.69-2.69-2.06 1.37a7.8 7.8 0 0 0-1.9-.79Zm-1.9 6.3a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
    />
  </svg>
)
