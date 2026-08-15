import React from 'react'
import { GOLKONDA_SLUG, hotels } from '../data/hotels'
import HotelCard from '../components/HotelCard'
import StickySectionHeading from '../components/StickySectionHeading'
import JumpNav, { JUMP_NAV_SCROLL_MT, type JumpTarget } from '../components/JumpNav'
import { useGuestScheduleContext } from '../lib/GuestScheduleProvider'

// Every hotel on the page is a hotel, so the word earns nothing in a chip and
// costs width on a phone.
const jumpTargets: JumpTarget[] = [
  { id: 'pre-wedding-hotels', label: 'Pre-Wedding' },
  { id: 'wedding-hotels', label: 'Wedding' },
]

// Replaces the Golkonda card's stock description for a guest who has a room.
// Its last sentence otherwise punts to the RSVP — stale for them, and the note
// below now answers it outright.
const GOLKONDA_ROOM_DESCRIPTION =
  "We're lucky to be hosting our wedding at Golkonda Resort, where many of our guests will be " +
  'staying and celebrating together throughout the weekend.'

// The two nights held at the resort are Oct 27 and 28, so a guest with a room
// still needs the pre-wedding list for Oct 26 — nothing is hidden from them.
const OFFER = 'We’ve arranged a room for you here for the nights of October 27 and 28'
const OPT_OUT = ' If you’d rather make your own arrangements, just let us know.'

const roomNote = {
  // Deliberately silent on money: a covered guest has nothing to settle, and
  // raising the subject only invites the question.
  covered: `${OFFER}.${OPT_OUT}`,
  own:
    `${OFFER}. The two nights come to roughly $350 per room, for one to three people, and you ` +
    `can settle it with the resort directly at check-in or checkout — nothing to pay in ` +
    `advance.${OPT_OUT}`,
} as const

const Hotels: React.FC = () => {
  const preWedding = hotels.filter((h) => h.section === 'pre-wedding')
  const wedding = hotels.filter((h) => h.section === 'wedding')

  // Set only for guests the generator resolved to a room at the resort: tagged,
  // attending, and taking it. Undefined on the server and on the first client
  // render, so the prerendered page and the hydrated one agree.
  const { golkonda } = useGuestScheduleContext()

  return (
    <div className="min-h-screen bg-peach/20">
      {/* Wraps the header too, so the bar sits at the very top of the page —
          pinned from the start, the way the Travel section's nav is. */}
      <JumpNav targets={jumpTargets}>
        <header className="bg-peach/60 px-4 py-16 text-center">
          <div className="mx-auto max-w-2xl">
            <h1 className="font-display text-4xl text-rosewood sm:text-5xl">Where to Stay</h1>
            <div className="mx-auto mt-4 max-w-xl text-left">
              <p className="font-body text-lg leading-relaxed text-zeus/80">
                We're lucky to be hosting our wedding at Golkonda Resort, where many of our guests
                will be staying and celebrating together throughout the week.{' '}
                {golkonda
                  ? 'We’ve arranged a room for you at the resort — the details are with the hotel below.'
                  : 'Accommodation at the resort has been arranged for a number of our guests and will be reflected in your RSVP details.'}
              </p>
              <p className="mt-6 font-body text-lg leading-relaxed text-zeus/80">
                For those making their own arrangements, there are plenty of wonderful nearby hotels
                and rentals — we've shared a few of our favorites below to help make your stay easy
                and comfortable!
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-12 py-12 font-body">
          <section id="pre-wedding-hotels" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading
              eyebrow="Banjara Hills · October 26"
              title="Pre-Wedding Hotels"
              anchorId="pre-wedding-hotels"
            />
            <ul className="mx-auto mt-6 flex w-full max-w-2xl flex-col gap-6 px-4">
              {preWedding.map((hotel) => (
                <HotelCard key={hotel.slug} hotel={hotel} />
              ))}
            </ul>
          </section>

          <section id="wedding-hotels" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading
              eyebrow="Gandipet · October 27–28"
              title="Wedding Hotels"
              anchorId="wedding-hotels"
            />
            <ul className="mx-auto mt-6 flex w-full max-w-2xl flex-col gap-6 px-4">
              {wedding.map((hotel) => {
                const yours = golkonda !== undefined && hotel.slug === GOLKONDA_SLUG
                return (
                  <HotelCard
                    key={hotel.slug}
                    hotel={hotel}
                    reservedForYou={yours}
                    description={yours ? GOLKONDA_ROOM_DESCRIPTION : undefined}
                    note={golkonda && yours ? roomNote[golkonda] : undefined}
                  />
                )
              })}
            </ul>
          </section>
        </div>
      </JumpNav>
    </div>
  )
}

export default Hotels
