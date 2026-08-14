import React from 'react'
import type { Dish } from '../data/eats'
import { LinkIcon } from '../icons/LinkIcon'
import { AnchorScrollMt } from '../lib/anchorOffset'
import CopyLinkButton from './CopyLinkButton'
import DietBadge from './DietBadge'
import PhotoFrame from './PhotoFrame'

// One dish. The eyebrow borrows PlaceCard's small-caps label and the day
// plans' gold diamond, so the section reads as part of this page rather than a
// list bolted on the end of it. Three shapes, so a section can vary its rhythm
// instead of racking fourteen identical tiles:
//   stack   — photo above the text, sized to sit two-up in a grid
//   banner  — a stack across the full grid width, for a section's main event
//   feature — full width with the photo beside the text; `reverse` mirrors it
const DishCard: React.FC<{
  dish: Dish
  layout?: 'stack' | 'banner' | 'feature'
  reverse?: boolean
  /** Override the photo crop, e.g. the arch cards further south. */
  photoAspect?: string
  photoShape?: 'rect' | 'arch'
}> = ({ dish, layout = 'stack', reverse = false, photoAspect, photoShape = 'rect' }) => {
  const scrollMt = React.useContext(AnchorScrollMt)

  const sideBySide = layout === 'feature' && Boolean(dish.photo)
  const aspect =
    photoAspect ??
    (layout === 'feature'
      ? 'aspect-[2/1] sm:aspect-[4/3]'
      : layout === 'banner'
        ? 'aspect-[2/1]'
        : 'aspect-[3/2]')

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-rosewood/75">
          <span aria-hidden className="text-[0.5rem] text-gold">
            ◆
          </span>
          {dish.kind}
        </p>
        <DietBadge diet={dish.diet} />
      </div>

      <div className="mt-1 flex items-start justify-between gap-3">
        <h3 className="font-display text-lg text-rosewood">{dish.name}</h3>
        <CopyLinkButton id={dish.slug} label={dish.name} />
      </div>

      {/* flex-1 so the link row sits on the floor of the card: the notes run to
          different lengths, and without it the rows stagger across the grid. */}
      <p className="mt-2 flex-1 text-sm leading-relaxed text-zeus/80">{dish.note}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {dish.whereSlug && (
          <a href={`#${dish.whereSlug}`} className="underline hover:text-rosewood">
            Where to try it
          </a>
        )}
        <a
          href={dish.searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-soyabean underline hover:text-rosewood"
        >
          Look it up <LinkIcon className="h-3 w-3" />
        </a>
      </div>
    </>
  )

  return (
    <li
      id={dish.slug}
      className={`group/copy card flex h-full flex-col ${layout === 'stack' ? '' : 'sm:col-span-2'} ${
        sideBySide ? `gap-3 sm:gap-4 ${reverse ? 'sm:flex-row-reverse' : 'sm:flex-row'}` : ''
      } ${scrollMt}`}
    >
      {dish.photo && (
        <PhotoFrame
          photo={dish.photo}
          aspect={aspect}
          shape={photoShape}
          className={sideBySide ? 'shrink-0 self-start sm:w-2/5' : 'mb-3'}
        />
      )}
      {sideBySide ? <div className="flex min-w-0 flex-1 flex-col">{body}</div> : body}
    </li>
  )
}

export default DishCard
