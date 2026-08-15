import React from 'react'
import { Link } from 'react-router-dom'
import { formatEventDate, groupByDate, type DayVenue } from '../data/scheduleEvents'
import ScheduleEventCard from '../components/ScheduleEventCard'
import StickySectionHeading from '../components/StickySectionHeading'
import { useGuestScheduleContext } from '../lib/GuestScheduleProvider'
import { MapPinIcon } from '../icons/MapPinIcon'

// The venue used to sit on every card; it rides in the day's sticky heading now
// so a day at one hotel names it once. It goes in the eyebrow, above the date,
// matching how Hotels and Kerala Itinerary head their sections. Still a link,
// because losing it would take the map off the page altogether — and the pin
// says where it goes, since an underline alone doesn't say "map" at this size.
// The icon carries no text, so it stays out of the link's accessible name.
const DayVenueEyebrow: React.FC<{ venue: DayVenue }> = ({ venue }) =>
  venue.mapUrl ? (
    <a
      href={venue.mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-rosewood"
    >
      {/* The underline sits on the words, not the anchor: a descendant can't
          cancel an ancestor's text-decoration, so on the anchor it would draw
          straight through the pin. */}
      <MapPinIcon className="mr-1 inline-block h-3.5 w-3.5 -translate-y-px align-middle text-rosewood" />
      <span className="underline decoration-rosewood/30 underline-offset-2">{venue.location}</span>
    </a>
  ) : (
    <>{venue.location}</>
  )

const WeddingSchedule: React.FC = () => {
  const { status, events, displayName, signOut, openUnlock, openJoy } = useGuestScheduleContext()

  const days = groupByDate(events)
  const identified = status === 'identified'

  return (
    <div className="min-h-screen bg-peach/20">
      <header className="bg-peach/60 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-wide text-zeus/60">
            October 28, 2026 • Hyderabad, India
          </p>
          <h1 className="mt-1 font-display text-4xl text-rosewood sm:text-5xl">Schedule</h1>

          <div className="mx-auto mt-4 max-w-xl">
            {identified ? (
              <p className="font-body text-lg leading-relaxed text-zeus/80">
                Here’s everything we have planned for you, {displayName}.{' '}
                <button
                  type="button"
                  onClick={signOut}
                  className="underline decoration-rosewood/40 underline-offset-2 hover:text-rosewood"
                >
                  Not you?
                </button>
              </p>
            ) : (
              <>
                <p className="font-body text-lg leading-relaxed text-zeus/80">
                  We have a few days of celebrations planned, and we can’t wait to share them with
                  you. Add your name to see the schedule we’ve put together for you.
                </p>

                {status === 'error' ? (
                  <p className="mt-6 font-body text-sm text-zeus/80">
                    We’re having trouble loading personalized schedules right now. The main
                    celebrations are below —{' '}
                    <button
                      type="button"
                      onClick={openJoy}
                      className="underline decoration-rosewood/40 underline-offset-2 hover:text-rosewood"
                    >
                      view your full details on Joy
                    </button>
                    .
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => openUnlock()}
                    disabled={status === 'loading'}
                    className="btn-primary mt-6"
                  >
                    Unlock Your Schedule
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-12 py-12 font-body">
        {days.map((day) => (
          <section key={day.date}>
            <StickySectionHeading
              eyebrow={day.venue && <DayVenueEyebrow venue={day.venue} />}
              title={formatEventDate(day.date)}
            />
            <ul className="mx-auto mt-6 flex w-full max-w-2xl flex-col gap-6 px-4">
              {day.events.map((event) => (
                <ScheduleEventCard key={event.id} event={event} dayVenue={day.venue?.location} />
              ))}
            </ul>
          </section>
        ))}

        {/* The dress codes above name garments — sari, kurta, sherwani — and
            this is the only page carrying them with no route to the pictures. */}
        <p className="mx-auto w-full max-w-2xl px-4 text-center text-sm text-zeus/70">
          Wondering what to wear? Our{' '}
          <Link to="/what-to-wear" className="underline hover:text-rosewood">
            What to Wear guide
          </Link>{' '}
          has a photo of every outfit, and notes for each of your events.
        </p>
      </div>
    </div>
  )
}

export default WeddingSchedule
