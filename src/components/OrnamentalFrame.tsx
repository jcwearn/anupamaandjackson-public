import React from 'react'
import clsx from 'clsx'

// Petal drawn along the +x axis (base at r=31, tip at r=43), rotated about the
// corner origin. Plain transform attributes keep the SVG free of defs/ids so
// four instances can prerender without hydration-sensitive unique ids.
const PETAL_D = 'M31 0 C33.5 -3.4 40.5 -3.4 43 0 C40.5 3.4 33.5 3.4 31 0 Z'
const PETAL_ANGLES = [15, 30, 45, 60, 75]

const DOT_ANGLES = [22.5, 45, 67.5]
const DOT_RADIUS = 51.5

const polar = (radius: number, degrees: number): [number, number] => {
  const rad = (degrees * Math.PI) / 180
  return [radius * Math.cos(rad), radius * Math.sin(rad)]
}

// Quarter-mandala anchored at the top-left corner (SVG origin). The other
// corners reuse it rotated in 90° steps.
const CornerOrnament: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
    {/* Concentric quarter arcs radiating from the corner */}
    <path d="M0 28 A28 28 0 0 0 28 0" fill="none" stroke="currentColor" strokeWidth="1.25" />
    <path d="M0 46 A46 46 0 0 0 46 0" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.6" />
    {/* Lotus-petal fan between the arcs */}
    {PETAL_ANGLES.map((angle) => (
      <path
        key={angle}
        d={PETAL_D}
        transform={`rotate(${angle})`}
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="0.75"
      />
    ))}
    {/* Paisley teardrop hugging the corner */}
    <path
      d="M7 7 C19 2 26 9 23 17 C20.5 24 11 24 9 16.5 C8 12 9 9.5 7 7 Z"
      fill="#ffcadb"
      fillOpacity="0.5"
      stroke="currentColor"
      strokeWidth="1"
    />
    <circle cx="15.5" cy="14" r="1.5" fill="#69313e" />
    {/* Accent dots beyond the petal tips, alternating gold and maroon */}
    {DOT_ANGLES.map((angle, i) => {
      const [cx, cy] = polar(DOT_RADIUS, angle)
      return (
        <circle
          key={angle}
          cx={cx.toFixed(2)}
          cy={cy.toFixed(2)}
          r="1.8"
          fill={i % 2 === 0 ? 'currentColor' : '#69313e'}
        />
      )
    })}
  </svg>
)

const CORNER_SIZE = 'h-14 w-14 sm:h-20 sm:w-20'
const CONTENT_PADDING = 'p-8 sm:p-12 md:p-16'

// `contentClassName` and `cornerClassName` exist for the place cards, which want
// the same frame at a much smaller scale than the landing hero it was built for.
// Both default to the hero's own values, so Landing.tsx is unaffected.
export const OrnamentalFrame: React.FC<{
  children: React.ReactNode
  className?: string
  contentClassName?: string
  cornerClassName?: string
}> = ({ children, className, contentClassName = CONTENT_PADDING, cornerClassName = CORNER_SIZE }) => (
  <div className={clsx('relative', className)}>
    {/* Double hairline border, echoed by the corner arcs */}
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-sm border border-gold/40" />
    <div aria-hidden="true" className="pointer-events-none absolute inset-1.5 rounded-sm border border-gold/60" />
    <CornerOrnament className={clsx('pointer-events-none absolute left-1.5 top-1.5', cornerClassName)} />
    <CornerOrnament className={clsx('pointer-events-none absolute right-1.5 top-1.5 rotate-90', cornerClassName)} />
    <CornerOrnament className={clsx('pointer-events-none absolute bottom-1.5 right-1.5 rotate-180', cornerClassName)} />
    <CornerOrnament className={clsx('pointer-events-none absolute bottom-1.5 left-1.5 -rotate-90', cornerClassName)} />
    <div className={contentClassName}>{children}</div>
  </div>
)

// Small circular motif flanked by fading rules, for separating headings.
export const MandalaDivider: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 160 24" aria-hidden="true" className={clsx('h-6 w-40', className)}>
    <line x1="6" y1="12" x2="60" y2="12" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.5" />
    <line x1="100" y1="12" x2="154" y2="12" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.5" />
    <circle cx="6" cy="12" r="1.4" fill="currentColor" fillOpacity="0.6" />
    <circle cx="154" cy="12" r="1.4" fill="currentColor" fillOpacity="0.6" />
    <circle cx="80" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="0.9" />
    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
      <path
        key={angle}
        d="M87 12 C88.5 10.6 91 10.6 92.5 12 C91 13.4 88.5 13.4 87 12 Z"
        transform={`rotate(${angle} 80 12)`}
        fill="currentColor"
        fillOpacity="0.35"
        stroke="currentColor"
        strokeWidth="0.6"
      />
    ))}
    <circle cx="80" cy="12" r="2" fill="#69313e" />
  </svg>
)

export default OrnamentalFrame
