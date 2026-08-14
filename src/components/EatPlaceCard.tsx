import React from 'react'
import { Link } from 'react-router-dom'
import type { EatPlace } from '../data/eats'
import { places } from '../data/places'
import { LinkIcon } from '../icons/LinkIcon'
import { AnchorScrollMt } from '../lib/anchorOffset'
import CopyLinkButton from './CopyLinkButton'
import PhotoFrame from './PhotoFrame'

const namesBySlug = new Map(places.map((place) => [place.slug, place.name]))

// Somewhere to go, deliberately built to the same plan as HotelCard: eyebrow,
// name, where it is, why we're sending you, then a filled pill for the site and
// an outlined one for the map. Two cards on the site that do the same job should
// look like they do the same job. The photo hangs beside the text rather than
// above it the way HotelCard's does, because eight of these stack in one
// column — `reverse` alternates the side so the walk down the list zigzags.
const EatPlaceCard: React.FC<{
  place: EatPlace
  reverse?: boolean
  /** Override the photo crop for portrait shots (Nimrah's Charminar). */
  photoAspect?: string
}> = ({ place, reverse = false, photoAspect }) => {
  const scrollMt = React.useContext(AnchorScrollMt)

  const body = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-rosewood/75">
            {place.kind}
          </p>
          <h3 className="mt-0.5 font-display text-xl text-rosewood">{place.name}</h3>
        </div>
        <CopyLinkButton id={place.slug} label={place.name} />
      </div>

      <p className="text-sm text-zeus/90">{place.area}</p>

      <p className="text-sm leading-relaxed text-zeus/80">{place.note}</p>

      {/* The sights live on Things to Do, so this crosses pages. PlaceCarousel
          reads window.location.hash on mount, so arriving this way opens the
          deck on the right card rather than on the first one. */}
      {place.nearbySlug && (
        <p className="text-sm text-zeus/80">
          Pairs with{' '}
          <Link
            to={`/travel/hyderabad#${place.nearbySlug}`}
            className="underline hover:text-rosewood"
          >
            {namesBySlug.get(place.nearbySlug) ?? place.nearbySlug}
          </Link>
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 gap-y-2 pt-1 text-sm">
        {place.websiteUrl && (
          <a
            href={place.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-lily px-4 py-1.5 font-medium text-zeus shadow-sm transition-colors hover:bg-rosewood hover:text-cream"
          >
            Website <LinkIcon className="h-3 w-3" />
          </a>
        )}
        <a
          href={place.mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-soyabean/40 px-4 py-1.5 text-soyabean transition-colors hover:bg-soyabean/10"
        >
          Map <LinkIcon className="h-3 w-3" />
        </a>
      </div>
    </>
  )

  return (
    <li
      id={place.slug}
      className={`group/copy card flex flex-col ${
        place.photo
          ? `gap-3 sm:gap-4 ${reverse ? 'sm:flex-row-reverse' : 'sm:flex-row'}`
          : 'gap-2'
      } ${scrollMt}`}
    >
      {place.photo && (
        <PhotoFrame
          photo={place.photo}
          aspect={photoAspect ?? 'aspect-[2/1] sm:aspect-[4/3]'}
          className="shrink-0 self-start sm:w-2/5"
        />
      )}
      {place.photo ? (
        <div className="flex min-w-0 flex-1 flex-col gap-2">{body}</div>
      ) : (
        body
      )}
    </li>
  )
}

export default EatPlaceCard
