import React from 'react'
import clsx from 'clsx'
import type { Place } from '../data/places'
import { places } from '../data/places'
import { AnchorScrollMt } from '../lib/anchorOffset'
import CopyLinkButton from './CopyLinkButton'
import OrnamentalFrame, { MandalaDivider } from './OrnamentalFrame'

const namesBySlug = new Map(places.map((place) => [place.slug, place.name]))

// The label is a caption and the value is the answer, so they differ in colour
// as well as weight — at the same tone they read as one grey block.
const Detail: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-rosewood/75">
      {label}
    </dt>
    <dd className="mt-1 text-sm leading-snug text-zeus">{children}</dd>
  </div>
)

// Laid out the way the Hyderabad guide lays out a place: the photo in a ruled
// mat, the name and era beneath it, a divider, then the About text beside a
// column of facts. The ornament is the site's own — OrnamentalFrame's corner
// mandalas rather than the guide's copper scrollwork.
// `anchored` decides which copy of the card owns the deep-link id. The carousel
// renders two faces at once and they can hold the same place, so only the one
// facing the reader carries it — otherwise the document has the id twice, and
// the one a link scrolls to might be the face turned away.
//
// `measuring` renders the card for the carousel's invisible sizer stack, which
// exists only to give the deck one height. It swaps the photo for a box of the
// same shape so nine hidden copies cost no image loads.
const PlaceCard: React.FC<{ place: Place; anchored?: boolean; measuring?: boolean }> = ({
  place,
  anchored = true,
  measuring = false,
}) => {
  const scrollMt = React.useContext(AnchorScrollMt)

  return (
    // A live card fills the deck so every one is the same height; a measuring
    // copy must not, or the cell it is there to size would have nothing to
    // size against and collapse.
    <div
      id={anchored ? place.slug : undefined}
      className={clsx(anchored && scrollMt, !measuring && 'h-full')}
    >
      <OrnamentalFrame
        // Opaque, not bg-white/70: the face behind this one is only rotated
        // away, and a translucent card lets its mirrored text show through.
        className={clsx('group/copy bg-cream text-gold', !measuring && 'h-full')}
        contentClassName={clsx('p-5 sm:p-7', !measuring && 'h-full')}
        cornerClassName="h-10 w-10 sm:h-12 sm:w-12"
      >
        <div className={clsx('flex flex-col gap-4 text-zeus', !measuring && 'h-full')}>
          {/* The mat repeats the ruled border the guide draws around every photo. */}
          <div className="rounded-lg bg-white/70 p-1.5 ring-1 ring-gold/60">
            {measuring ? (
              <div className="aspect-[2/1] w-full rounded-md" />
            ) : (
              <img
                src={place.photo.src}
                alt={place.photo.alt}
                width={1600}
                height={902}
                loading="lazy"
                className="aspect-[2/1] w-full rounded-md object-cover"
              />
            )}
          </div>

          <div className="text-center">
            {/* The heading shrinks to its text so the copy button can hang off
                its right edge rather than the card's, and stays absolute so its
                width doesn't shift the title off centre while it's hidden —
                which is most of the time. */}
            <h3 className="relative inline-block max-w-full font-display text-2xl text-rosewood">
              {place.name}
              <span className="absolute left-full top-1/2 ml-1 -translate-y-1/2">
                <CopyLinkButton id={place.slug} label={place.name} />
              </span>
            </h3>
            <p className="text-sm text-zeus/70">{place.built}</p>
            <MandalaDivider className="mx-auto mt-3 text-gold" />
          </div>

          {/* flex-1 so the shorter entries take the slack at the foot of the
              card rather than leaving it under the deck, and the rule between
              the columns runs the full height either way. */}
          <div className="grid flex-1 gap-5 sm:grid-cols-[3fr_2fr]">
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-zeus/80">{place.about}</p>
              <p className="text-sm italic text-soyabean">
                <span className="font-semibold not-italic">Did you know?</span> {place.didYouKnow}
              </p>
            </div>

            {/* The guide splits its facts off behind a rule; below sm: there is no
                room for two columns, so the rule lies flat above them instead. */}
            <dl className="grid gap-3 border-t border-gold/40 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
              <Detail label="Best time to visit">{place.bestTime}</Detail>
              <Detail label="Suggested duration">{place.duration}</Detail>
              <Detail label="Recommended for">{place.recommendedFor}</Detail>
              <Detail label="What not to miss">{place.notToMiss}</Detail>
              {place.nearby.length > 0 && (
                <Detail label="Pairs well with">
                  {place.nearby.map((slug, i) => (
                    <React.Fragment key={slug}>
                      {i > 0 && ', '}
                      <a href={`#${slug}`} className="underline hover:text-rosewood">
                        {namesBySlug.get(slug) ?? slug}
                      </a>
                    </React.Fragment>
                  ))}
                </Detail>
              )}
            </dl>
          </div>
        </div>
      </OrnamentalFrame>
    </div>
  )
}

export default PlaceCard
