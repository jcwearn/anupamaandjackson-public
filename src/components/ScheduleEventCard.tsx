import React from 'react'
import { Link } from 'react-router-dom'
import type { ScheduleEvent } from '../data/scheduleEvents'
import { HangerIcon } from '../icons/HangerIcon'
import WhatToWearButton from './WhatToWearButton'

interface Props {
  event: ScheduleEvent
  /** The venue already named in the day's sticky heading. Matching events drop
   *  their own venue line rather than repeating it down the whole day. */
  dayVenue?: string
}

/**
 * Stacked and centred: title, time, venue, then the prose beneath.
 *
 * Separate from EventCard, whose time-in-a-side-column layout still serves the
 * 2025 engagement page but left a lot of empty space once these events grew
 * descriptions and attire notes.
 */
const ScheduleEventCard: React.FC<Props> = ({ event, dayVenue }) => {
  return (
    <li className="card text-center">
      <h3 className="font-display text-xl text-rosewood sm:text-2xl">{event.title}</h3>
      <p className="mt-1 text-zeus/80">{event.time}</p>

      {event.location !== dayVenue &&
        (event.mapUrl ? (
          <a
            href={event.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-zeus/90 underline decoration-rosewood/30 underline-offset-2 hover:text-rosewood"
          >
            {event.location}
          </a>
        ) : (
          <p className="mt-1 text-zeus/90">{event.location}</p>
        ))}

      {event.description && (
        <p className="mt-4 text-sm leading-relaxed text-zeus/80">{event.description}</p>
      )}

      {/* The list is centred as a block, but its items stay left-aligned so the
          bullets and their text line up with each other rather than each row
          floating to its own centre. Bullet styling matches Kerala, Travel Tips
          and eVisa; it must not be a flex column, which suppresses markers. */}
      {event.agenda && event.agenda.length > 0 && (
        <div className="mt-3 flex justify-center">
          <ul className="list-disc space-y-1.5 pl-5 text-left text-sm leading-relaxed text-zeus/80">
            {event.agenda.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Inline rather than a flex row: as a flex item the text would grow to
          fill the line and strand the icon against the left edge instead of
          sitting with the text. The icon carries no text, so it is named for
          screen readers. */}
      {event.attire && (
        <p className="mt-4 text-sm leading-relaxed text-zeus/80">
          <HangerIcon className="mr-1.5 inline-block h-6 w-6 -translate-y-0.5 align-middle text-rosewood" />
          <span className="sr-only">Attire: </span>
          {event.attire}
        </p>
      )}

      {/* Only where the guide has something specific to say about this event.
          Hanging one off "Casual" and "Cozy and casual!" too would put the same
          link on most of the page and mean less on every card. */}
      {event.indianWear && (
        <p className="mt-3">
          <WhatToWearButton eventId={event.id} />
        </p>
      )}

      {event.note && (
        <p className="mt-4 text-sm italic leading-relaxed text-soyabean">{event.note}</p>
      )}

      {event.linkTo && (
        <Link to={event.linkTo} className="btn-primary mt-5 inline-block">
          {event.linkLabel ?? 'Read more'}
        </Link>
      )}
    </li>
  )
}

export default ScheduleEventCard
