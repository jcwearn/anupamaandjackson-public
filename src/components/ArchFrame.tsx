import React from 'react'
import clsx from 'clsx'

// Left half of a stepped ogee arch: a vertical rising into a small shoulder, a
// cusp, a taller lobe, another cusp, then the long sweep to a pointed apex at
// (300, 3). Traced by eye from the "Curated ways to explore" page of the
// Hyderabad guide.
//
// The right half is the same path mirrored rather than a <use href="#id">,
// because ids in prerendered SVG have to stay stable across hydration — the
// same constraint OrnamentalFrame.tsx documents.
const ARCH_HALF_D = [
  'M0 200 L0 184',
  'C0 173 7 166 19 165',
  'C31 164 41 167 47 172',
  'C51 175 55 173 57 166',
  'C63 137 80 105 102 101',
  'C120 98 134 101 143 108',
  'C150 113 155 111 158 100',
  'C172 76 196 52 232 33',
  'C259 18 283 9 300 3',
].join(' ')

// The arch's own verticals land exactly on x=0 and x=600, so the content box's
// left and right borders carry straight on from where the curve leaves off.
// `vectorEffect` keeps the stroke a hairline at any width — without it the curve
// thickens as the frame widens and stops matching the 1px border below it.
const ArchFrame: React.FC<{
  children: React.ReactNode
  id?: string
  className?: string
  contentClassName?: string
}> = ({ children, id, className, contentClassName = 'px-5 pb-10 pt-2 sm:px-8' }) => (
  <div id={id} className={clsx('relative', className)}>
    <svg viewBox="0 0 600 200" aria-hidden="true" className="block w-full">
      <path
        d={ARCH_HALF_D}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.8"
        strokeWidth="1.25"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={ARCH_HALF_D}
        transform="translate(600,0) scale(-1,1)"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.8"
        strokeWidth="1.25"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
    {/* -mt-px closes the hairline seam where the curve meets the borders. */}
    <div className={clsx('-mt-px border-x border-b border-gold/70', contentClassName)}>
      {children}
    </div>
  </div>
)

export default ArchFrame
