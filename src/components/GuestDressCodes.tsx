import React from 'react'
import { Link } from 'react-router-dom'
import GuestGateNotice from './GuestGateNotice'
import { HangerIcon } from '../icons/HangerIcon'
import { formatEventDate, groupByDate } from '../data/scheduleEvents'
import { useGuestScheduleContext } from '../lib/GuestScheduleProvider'

/**
 * The dress code for each of an identified guest's events, grouped by day,
 * with the prompt that gets an anonymous one there.
 *
 * /what-to-wear is the only page that renders this. The FAQ and Travel Tips
 * used to show a shorter version of the same list, and answered the clothing
 * question in their own words on top of it; both now carry a button here
 * instead, so there is one place a dress code is written down.
 *
 * Renders nothing but the gate prompt until a guest identifies themselves:
 * the event list is exactly what the gate protects. That holds even for the
 * universal events, which /schedule does prerender for everyone — no event is
 * named here before a name is entered.
 */
const GuestDressCodes: React.FC<{
  /**
   * Scroll-margin for the per-event anchors, so a deep link from the schedule
   * lands below the fixed bars rather than under them. Passed in because only
   * the caller knows what is pinned above it.
   */
  anchorScrollMt?: string
}> = ({ anchorScrollMt = '' }) => {
  const { status, events } = useGuestScheduleContext()

  // Kept grouped rather than flattened: a guest with two events on the wedding
  // day would otherwise read the same date twice, and the date is the loudest
  // line in each row while carrying the least new information.
  const days = groupByDate(events.filter((event) => event.attire || event.indianWear))
  const identified = status === 'identified'

  return (
    <>
      <GuestGateNotice
        lockedBlurb="Each event has its own dress code. Add your name and we’ll show you what to wear for every event on your schedule, and what to reach for if you’d like to wear Indian clothing."
        unlockLabel="Unlock Your Events"
        unlockCopy={{
          heading: 'Outfits for your events',
          blurb:
            'Add your name as it appears on your invitation and we’ll show you the dress code for each event on your schedule.',
          submitLabel: 'Show My Events',
        }}
      />

      {identified &&
        (days.length > 0 ? (
          // Wrapped so the list's internal spacing is ours: the surrounding
          // Disclosure body is space-y-3, whose `> * + *` margin-top lands on
          // the same property any mt-* here would set, and the two don't add up.
          <div>
            <h3 className="flex items-center gap-1.5 font-display text-base text-rosewood">
              {/* Once, on the heading. Per row it repeated for every event to
                  label things that were all already dress codes, and its indent
                  applied only to the first line — wrapped attire text started
                  back at the margin, left of the line above it. */}
              <HangerIcon aria-hidden="true" className="h-5 w-5 shrink-0" />
              For your events
            </h3>

            <div className="mt-3 flex flex-col gap-5">
              {days.map((day) => (
                <div key={day.date}>
                  {/* Serif and rosewood come from the unlayered h1–h6 rule in
                      globals.css, which beats any utility class here — every
                      other sub-heading on the site goes with it rather than
                      against it. Only the tracking is worth overriding: that
                      rule sets tracking-tight, and negative letter-spacing on
                      12px uppercase is what makes small caps hard to read. */}
                  <h4 className="text-xs uppercase tracking-wide!">{formatEventDate(day.date)}</h4>
                  <ul className="mt-2 flex flex-col gap-3 border-l-2 border-rosewood/20 pl-4">
                    {day.events.map((event) => (
                      // The id is what a schedule card's What to Wear Guide button
                      // deep-links to, e.g. /what-to-wear#muhurtham.
                      <li key={event.id} id={event.id} className={anchorScrollMt}>
                        <p className="font-body text-sm font-medium text-zeus">{event.title}</p>
                        <p className="mt-0.5 font-body text-sm leading-relaxed text-zeus/80">
                          {/* Without this the title and the attire read as two
                              unrelated lines aloud — the icon carried this
                              meaning visually and no longer sits here. */}
                          <span className="sr-only">Attire: </span>
                          {event.attire}
                        </p>

                        {event.indianWear && (
                          <div className="mt-2 rounded-md bg-lily/15 px-3 py-2">
                            <p className="font-body text-xs font-semibold uppercase tracking-wide text-rosewood/80">
                              If you’d like to wear Indian clothing
                            </p>
                            {event.indianWear.note && (
                              <p className="mt-1 font-body text-sm italic leading-relaxed text-soyabean">
                                {event.indianWear.note}
                              </p>
                            )}
                            {/* Labelled inline rather than as a definition list:
                                these are two sentences, and a <dl> reads them
                                out as terms with the label repeated each time. */}
                            <p className="mt-1.5 font-body text-sm leading-relaxed text-zeus/80">
                              <span className="font-medium text-zeus">Women: </span>
                              {event.indianWear.women}
                            </p>
                            <p className="mt-1 font-body text-sm leading-relaxed text-zeus/80">
                              <span className="font-medium text-zeus">Men: </span>
                              {event.indianWear.men}
                            </p>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Deliberately says nothing about surrounding copy: Travel Tips has
          // everyday packing advice above this, the FAQ answer does not.
          <p className="text-sm leading-relaxed text-zeus/80">
            None of your events have a specific dress code. Your full{' '}
            <Link to="/schedule" className="underline hover:text-rosewood">
              Schedule
            </Link>{' '}
            has the rest of the details.
          </p>
        ))}
    </>
  )
}

export default GuestDressCodes
