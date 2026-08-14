import React from 'react'
import { Link } from 'react-router-dom'
import IconHeading from '../components/IconHeading'
import { PlaneIcon } from '../icons/PlaneIcon'
import { CarIcon } from '../icons/CarIcon'
import { useHashDisclosure } from '../lib/useHashDisclosure'
import { useGuestScheduleContext } from '../lib/GuestScheduleProvider'
import { KERALA_EVENT_ID } from '../data/scheduleEvents'

const linkClass = 'underline hover:text-rosewood'

// The section root. The two long-form pages are reached from the SectionNav bar
// TravelLayout pins above this, so this page stays short on purpose: the
// practical "how do I get there" answers, and nothing that /travel/tips already
// covers in depth — it links instead.
const Travel: React.FC = () => {
  useHashDisclosure()
  // Same condition as /kerala-itinerary: the trip's flights are only news to
  // the guests on it, and telling anyone else that flights are being booked
  // gives away the trip that page is gated to keep quiet.
  const { events } = useGuestScheduleContext()
  const onKeralaTrip = events.some((event) => event.id === KERALA_EVENT_ID)

  return (
    <div className="min-h-screen bg-peach/20">
      <header className="bg-peach/60 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-4xl text-rosewood sm:text-5xl">Getting Here</h1>
          <div className="mx-auto mt-4 max-w-xl text-left">
            <p className="font-body text-lg leading-relaxed text-zeus/80">
              What to book before you fly, and how to reach the celebrations once you’ve landed.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-12 px-4 py-12 font-body text-zeus/80">
        <section className="space-y-4">
          <IconHeading icon={PlaneIcon} title="Booking your flights" anchorId="booking-your-flights" />
          <p>
            We recommend flying into{' '}
            <strong className="font-semibold text-zeus">
              Rajiv Gandhi International Airport (HYD)
            </strong>
            , about a 30-minute drive from Golkonda Resort — though Hyderabad traffic can be
            unpredictable, so plan accordingly!
          </p>
          <p>
            If you’re traveling internationally, we’d encourage you to arrive by{' '}
            <strong className="font-semibold text-zeus">Monday, October 26</strong> at the latest.
            Getting to India is a journey — many itineraries land you two days after you set off, so
            factor that in when you’re booking. The earlier you can arrive, the better your chances
            of resting and recovering before the celebrations begin.
          </p>
          {onKeralaTrip && (
            <p>
              For those joining us on the optional Kerala weekend after the wedding, a round trip to
              and from Hyderabad (HYD) is all you need. The flights between Hyderabad and Kochi
              (COK) are part of that trip and are being booked for you, so there’s nothing extra to
              arrange.
            </p>
          )}
        </section>

        <section className="space-y-4">
          <IconHeading icon={CarIcon} title="Once you land" anchorId="once-you-land" />
          <p>
            For our out-of-town guests, we’d be happy to coordinate an airport pickup to Golkonda
            Resort. Just let us know if that would be helpful.
          </p>
          <p>
            Otherwise, Uber is a great option for getting around anywhere in Hyderabad — including
            autos, which you can book through the same app. There are a few things worth knowing
            before your first ride, and we’ve written them up in{' '}
            <Link to="/travel/tips#getting-around" className={linkClass}>
              getting around
            </Link>
            .
          </p>
          <p>
            Our{' '}
            <Link to="/hotels" className={linkClass}>
              Hotels
            </Link>{' '}
            page has the places we’d recommend and how close each one is to the celebrations.
          </p>
        </section>
      </div>
    </div>
  )
}

export default Travel
