import React from 'react'
import type { EventItem } from '../data/events'
import { LinkIcon } from '../icons/LinkIcon'

interface Props {
  event: EventItem
}

const EventCard: React.FC<Props> = ({ event }) => {
  return (
    <li className="card flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="sm:w-1/4">
        <p className="font-semibold text-rosewood">{event.time}</p>
      </div>
      <div className="sm:flex-1">
        <h3 className="text-xl font-display">{event.title}</h3>
        <p className="text-zeus/90">{event.location}</p>
        {event.address && (
          <p className="text-sm text-soyabean">
            {event.address}
            {event.mapUrl && (
              <a
                href={event.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 inline-flex items-center gap-1 text-fern underline hover:text-rosewood"
              >
                Map <LinkIcon className="h-3 w-3" />
              </a>
            )}
          </p>
        )}
        {event.note && <p className="mt-1 text-sm italic text-soyabean">{event.note}</p>}
      </div>
    </li>
  )
}

export default EventCard
