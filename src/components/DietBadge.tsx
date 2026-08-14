import React from 'react'
import clsx from 'clsx'
import type { Diet } from '../data/eats'
import { LeafIcon } from '../icons/LeafIcon'
import { NonVegMarkIcon } from '../icons/NonVegMarkIcon'
import { VegMarkIcon } from '../icons/VegMarkIcon'

// Green circle, brown triangle, leaf. The first two are the marks India already
// prints on menus and packets, drawn and coloured to FSSAI's own spec rather than
// to this site's palette — the point is that a guest learns them here and reads
// them off a real menu later, which only works if they match.
// The leaf is the site's own: the green mark covers dairy, which is no help to
// anyone avoiding it, and that gap is the whole point of the note above the list.
// It takes the same green so the two vegetarian marks read as one family.
// The leaf carries less ink than the marks at the same box, so it runs a size up.
const LOOKS: Record<Diet, { label: string; tone: string; size: string; Icon: typeof LeafIcon }> = {
  vegan: { label: 'Vegan', tone: 'text-fssai-green', size: 'h-4 w-4', Icon: LeafIcon },
  veg: { label: 'Veg', tone: 'text-fssai-green', size: 'h-3.5 w-3.5', Icon: VegMarkIcon },
  'non-veg': { label: 'Non-veg', tone: 'text-fssai-brown', size: 'h-3.5 w-3.5', Icon: NonVegMarkIcon },
}

const DietBadge: React.FC<{ diet: Diet; className?: string }> = ({ diet, className }) => {
  const { label, tone, size, Icon } = LOOKS[diet]

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center gap-1 text-[0.625rem] font-semibold uppercase tracking-[0.1em]',
        tone,
        className
      )}
    >
      <Icon className={size} />
      {label}
    </span>
  )
}

export default DietBadge
