import React from 'react'
import type { Hotel } from '../data/hotels'
import { LinkIcon } from '../icons/LinkIcon'
import CopyLinkButton from './CopyLinkButton'

interface Props {
  hotel: Hotel
  /**
   * Renders the "Your room is reserved" badge. A prop rather than a field on
   * the hotel: it is true of one guest and not the next, so it can't live in
   * the static data the prerender bakes in.
   */
  reservedForYou?: boolean
  /** Overrides `hotel.description`, for the same per-guest reason. */
  description?: string
  /** A highlighted aside under the description, e.g. the guest's own room. */
  note?: string
}

// A deep-linked card has to clear the fixed SiteNav *and* the
// StickySectionHeading pinned directly beneath it, or it lands behind the
// heading. Measured in the browser: nav 5rem (80px) + the pinned bar's 76px
// (eyebrow + text-2xl h2 + py-3) = 156px, so 10rem leaves a 4px gap.
// Spelled out as a literal because Tailwind needs the class statically.
const SCROLL_OFFSET = 'scroll-mt-[calc(env(safe-area-inset-top,0px)+10rem)]'

const HotelCard: React.FC<Props> = ({ hotel, reservedForYou = false, description, note }) => {
  const primaryLink = hotel.trivagoUrl
    ? { url: hotel.trivagoUrl, label: 'Compare on Trivago' }
    : hotel.bookingComUrl
      ? { url: hotel.bookingComUrl, label: 'Book on Booking.com' }
      : null

  return (
    <li
      id={hotel.slug}
      className={`group/copy card flex flex-col gap-3 ${SCROLL_OFFSET} ${hotel.featured ? 'border-2 border-gold ring-2 ring-gold/30' : ''}`}
    >
      {hotel.photo && (
        <img
          src={hotel.photo.src}
          alt={hotel.photo.alt}
          loading="lazy"
          className={`aspect-[2/1] w-full rounded-lg object-cover ${
            hotel.photoPosition === 'center' ? 'object-center' : 'object-top'
          }`}
        />
      )}

      {(hotel.featured || hotel.stayingHere || reservedForYou) && (
        <div className="flex flex-wrap gap-2">
          {reservedForYou && (
            <span className="inline-block w-fit rounded-full bg-rosewood px-3 py-1 text-xs font-body font-semibold uppercase tracking-wide text-cream">
              Your room is reserved
            </span>
          )}
          {hotel.featured && (
            <span className="inline-block w-fit rounded-full bg-rosewood px-3 py-1 text-xs font-body font-semibold uppercase tracking-wide text-cream">
              Special Rate
            </span>
          )}
          {hotel.stayingHere && (
            <span className="inline-block w-fit rounded-full bg-fern px-3 py-1 text-xs font-body font-semibold uppercase tracking-wide text-cream">
              We'll be staying here
            </span>
          )}
        </div>
      )}

      <div>
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-xl text-rosewood">{hotel.name}</h3>
          <CopyLinkButton id={hotel.slug} label={hotel.name} />
        </div>
        {hotel.distance && <p className="text-sm text-zeus/90">{hotel.distance}</p>}
      </div>

      <p className="text-sm text-zeus/80">{description ?? hotel.description}</p>

      {note && <p className="rounded-md bg-peach/40 px-3 py-2 text-sm text-zeus/80">{note}</p>}

      {hotel.featuredNote && <p className="text-sm italic text-soyabean">{hotel.featuredNote}</p>}

      {hotel.priceRange && (
        <p className="text-sm text-zeus/70">
          <span className="font-semibold">Approx. rate:</span> {hotel.priceRange}
        </p>
      )}

      {(primaryLink || hotel.bookingUrl || hotel.mapUrl) && (
        <div className="mt-1 flex flex-wrap items-center gap-2 gap-y-2 text-sm">
          {primaryLink && (
            <a
              href={primaryLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-lily px-4 py-1.5 font-medium text-zeus shadow-sm transition-colors hover:bg-rosewood hover:text-cream"
            >
              {primaryLink.label} <LinkIcon className="h-3 w-3" />
            </a>
          )}
          {hotel.bookingUrl && (
            <a
              href={hotel.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-soyabean/40 px-4 py-1.5 text-soyabean transition-colors hover:bg-soyabean/10"
            >
              Hotel website <LinkIcon className="h-3 w-3" />
            </a>
          )}
          {hotel.mapUrl && (
            <a
              href={hotel.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-soyabean/40 px-4 py-1.5 text-soyabean transition-colors hover:bg-soyabean/10"
            >
              Map <LinkIcon className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </li>
  )
}

export default HotelCard
