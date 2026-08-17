import type { SVGProps } from 'react'

/**
 * Marks for the three ways guests have sent money.
 *
 * Drawn here rather than fetched: the page is served behind a passphrase and
 * pulls in nothing from anyone else's origin, and three small glyphs are not
 * worth breaking that for.
 *
 * They are our own letterforms in each service's colour, not copies of the
 * logos — recognisable at 14px by colour and shape, which is all a table cell
 * needs, without reproducing marks that belong to someone else. Every one is
 * `aria-hidden`; the cell beside it carries the words.
 */
const MARKS = {
  zelle: { fill: '#6d1ed4', path: 'M7 5h10v2.6L11.2 16H17v3H7v-2.6L12.8 8H7z', bar: true },
  venmo: { fill: '#008cff', path: 'M6.5 5h3.7l1.9 8.4L15 5h3.5l-4.6 14h-4z', bar: false },
  paypal: {
    fill: '#0070ba',
    path: 'M9 5h4.6c2.7 0 4.2 1.4 3.8 3.9-.4 2.6-2.3 4-5 4h-2L9.8 19H6.8zm1.9 2.4-.5 3.2h1.5c1.3 0 2.1-.6 2.3-1.7.2-1-.3-1.5-1.5-1.5z',
    bar: false,
  },
} as const

export type PaymentMethod = keyof typeof MARKS

export const PaymentIcon = ({
  method,
  ...props
}: { method: PaymentMethod } & SVGProps<SVGSVGElement>) => {
  const mark = MARKS[method]
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <rect width="24" height="24" rx="6" fill={mark.fill} />
      <path d={mark.path} fill="#fff" />
      {/* Zelle's Z carries a stroke through it, which is most of what tells the
          glyph apart from a plain letter at this size. */}
      {mark.bar && <rect x="11.2" y="2.5" width="1.6" height="19" rx="0.8" fill="#fff" />}
    </svg>
  )
}
