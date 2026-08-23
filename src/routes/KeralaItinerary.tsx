import React from 'react'
import { usd } from '../lib/inr'
import { pricing, keralaPrice } from '../lib/keralaPricing'
import { flights } from '../lib/keralaFlights'
import { Link } from 'react-router-dom'
import StickySectionHeading from '../components/StickySectionHeading'
import JumpNav, { JUMP_NAV_SCROLL_MT, type JumpTarget } from '../components/JumpNav'
import { type GuestScheduleState } from '../lib/useGuestSchedule'
import { useGuestScheduleContext } from '../lib/guestScheduleContext'
import { KERALA_EVENT_ID } from '../data/scheduleEvents'
import kathakaliImg from '../assets/kerala/kathakali.jpg'
import houseboatImg from '../assets/kerala/houseboat.jpg'
import fishingNetsImg from '../assets/kerala/chinese-fishing-nets.jpg'
import mattancherryImg from '../assets/kerala/mattancherry-palace.jpg'
import synagogueImg from '../assets/kerala/paradesi-synagogue.jpg'

type Photo = {
  src: string
  width: number
  height: number
  alt: string
}

const photos: Record<string, Photo> = {
  kathakali: {
    src: kathakaliImg,
    width: 1600,
    height: 1066,
    alt: 'A Kathakali performer in full costume and green face makeup',
  },
  houseboat: {
    src: houseboatImg,
    width: 1600,
    height: 1066,
    alt: 'A traditional kettuvallam houseboat reflected in the still backwaters of Kerala',
  },
  fishingNets: {
    src: fishingNetsImg,
    width: 1600,
    height: 1066,
    alt: 'A Chinese fishing net over the water at Fort Kochi',
  },
  mattancherry: {
    src: mattancherryImg,
    width: 1920,
    height: 1080,
    alt: 'The exterior of Mattancherry Palace, also known as the Dutch Palace',
  },
  synagogue: {
    src: synagogueImg,
    width: 1200,
    height: 781,
    alt: 'The chandelier-filled interior of the Paradesi Synagogue in Jew Town, Kochi',
  },
}

const Figure: React.FC<{ photo: Photo }> = ({ photo }) => (
  <figure className="mt-4">
    <img
      src={photo.src}
      alt={photo.alt}
      width={photo.width}
      height={photo.height}
      loading="lazy"
      className="w-full rounded-lg"
    />
  </figure>
)

const culturalEvening = [
  'Watch a live Kathakali makeup demonstration highlighting the intricate transformation using natural pigments',
  'Enjoy a captivating Kathakali dance performance based on stories from the Ramayana and Mahabharata',
  'Experience the mystical Theyyam ritual dance, known as the “Dance of the Gods,” with dramatic costumes and powerful drum rhythms — an expressive form of storytelling through hand gestures, facial expressions, elaborate costumes, and live percussion',
  'Be amazed by Kalaripayattu, Kerala’s ancient martial art, featuring high-energy combat, weapon skills, and acrobatics',
]

const sights: { title: string; paragraphs: string[]; photo?: Photo }[] = [
  {
    title: 'Chinese Fishing Nets',
    paragraphs: [
      'We start our tour with the iconic Chinese fishing nets along the shoreline, a symbol of Kochi’s maritime history, and trade connections.',
    ],
    photo: photos.fishingNets,
  },
  {
    title: 'St. Francis Church',
    paragraphs: [
      'Visit the oldest European church in India, known for its colonial history and connection to Vasco Da Gama. The St. Francis Church is one of the most distinguished monuments in Kochi with a history that dates back to the 16th century. The church has great historical relevance as it was a silent witness of the European colonization in this region.',
      'The St. Francis Church, dedicated to St. Bartholomew, was built around 1503 by the Portuguese traders who reached the Kingdom of Kochi with their Admiral Pedro Alvarez de Cabral.',
      'The St. Francis Church Kerala is the oldest existing European church in India. The legendary Portuguese explorer Vasco Da Gama was buried in the St. Francis Church in the year 1524. Even though his remains were later taken to Portugal, the church still has the burial spot and tombstone inside. A war memorial exists in front of the church in memory of those soldiers from Kochi who lost their lives during World War I.',
    ],
  },
  {
    title: 'Santa Cruz Cathedral Basilica',
    paragraphs: [
      'The Santa Cruz Cathedral Basilica, also known as Kotta Palli or Kottepalli, is located in Fort Kochi. It is one of the 34 basilicas in India and one of 9 in Kerala. This heritage edifice of Kerala is renowned for its Indo-European and Gothic architectural style. It serves as the cathedral church of the Diocese of Cochin.',
      'Originally built by the Portuguese in 1505, it was elevated to a cathedral by Pope Paul IV in 1558. A new structure was commissioned in 1887 by the then bishop of Cochin, João Gomes Ferreira. The new building was consecrated in 1905 and proclaimed a basilica by Pope John Paul II in 1984.',
      'The Santa Cruz Cathedral Basilica is one of the finest and most impressive churches in India, attracting tourists year-round. You will get to admire this grand basilica with beautiful interiors, frescoes, and impressive architecture.',
    ],
  },
  {
    title: 'Mattancherry Palace',
    paragraphs: [
      'Explore the Dutch Palace, famous for its murals depicting Hindu epics and royal history.',
      'The Mattancherry Palace is a palace popularly known as the Dutch Palace, in Mattancherry, Kochi, and features Kerala murals depicting portraits and exhibits of the Rajas of Kochi. Despite the name Dutch Palace, the palace was built by the Portuguese Empire as a gift to the Kingdom of Cochin.',
    ],
    photo: photos.mattancherry,
  },
  {
    title: 'Paradesi Synagogue & Jew Town',
    paragraphs: [
      'Walk through the historic Jewish quarter, visit the synagogue, and browse spice shops and antiques.',
      'The Paradesi Synagogue or the Mattancherry Synagogue is located in Mattancherry Jew Town, a suburb of the city of Kochi, Kerala, in India. It was built in 1568 A.D. by Samuel Castiel, David Belila, and Joseph Levi for the flourishing Paradesi Jewish community in Kochi. It is the oldest active synagogue in the Commonwealth of Nations. Paradesi is a word used in several Indian languages, and the literal meaning of the term is “foreigners”, applied to the synagogue because it was built by Sephardic or Portuguese-speaking Jews, some of them from families exiled in Aleppo, Safed, and other West Asian localities.',
      'The synagogue is located in the quarter of Old Cochin known as Jew Town, and is the only one of the seven synagogues in the area still in use. The complex has four buildings. It was built adjacent to the Mattancherry Palace temple on the land given to the community by the Raja of Kochi, Rama Varma. The Mattancherry Palace temple and the synagogue share a common wall.',
    ],
    photo: photos.synagogue,
  },
]

// Which trip a guest is on, and whether they fly home from Kochi or back to
// Hyderabad. `all` is the unfiltered page — what anyone without a form
// response sees until they pick.
type Trip = 'all' | 'full' | 'short'
type FlightChoice = 'all' | 'rt' | 'ow'

// FilterToggle hands back plain strings; these narrow them for the state.
const parseTrip = (value: string | null): Trip =>
  value === 'full' || value === 'short' ? value : 'all'

const parseFlights = (value: string | null): FlightChoice =>
  value === 'rt' || value === 'ow' ? value : 'all'

const dayLabel = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  // Built from the parts rather than parsed: `new Date('2026-10-29')` is read as
  // UTC and slips to the previous day for anyone west of Greenwich.
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

const minutesInto = (time: string) => {
  const [hours, mins] = time.split(':').map(Number)
  return hours * 60 + mins
}

const clock = (time: string) => {
  const [hours, mins] = time.split(':').map(Number)
  return `${hours % 12 || 12}:${String(mins).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`
}

// Both legs take off and land the same afternoon, so there's no midnight to cross.
const duration = (from: string, to: string) => {
  const total = minutesInto(to) - minutesInto(from)
  return `${Math.floor(total / 60)}h ${total % 60}m`
}

// Two of these depend on what the guest picked: the shortened option skips the
// final hotel night, and only a round-trip fare covers the flight home. The
// `all` wording has to cover both cases at once.
const hotelNights: Record<Trip, string> = {
  full: '2 night hotel accommodation in Kochi on a double-occupancy basis, including breakfast',
  short: '1 night hotel accommodation in Kochi on a double-occupancy basis, including breakfast',
  all: '2 night hotel accommodation in Kochi on a double-occupancy basis, including breakfast — 1 night on the shortened option, which skips the final night',
}

const airfare: Record<FlightChoice, string> = {
  rt: 'Round trip airfare between Hyderabad and Kochi',
  ow: 'One way airfare from Hyderabad to Kochi',
  all: 'Airfare from Hyderabad to Kochi — round trip, or one way if you’re flying onward from Kochi',
}

const inclusionsFor = (trip: Trip, flightChoice: FlightChoice) => [
  airfare[flightChoice],
  hotelNights[trip],
  '1 night accommodation on houseboat (includes all meals; please note there are no twin beds on houseboats)',
  'Transfers to/from Kochi Airport, hotel, and houseboat',
  'Transportation and entry tickets to all sightseeing places mentioned in the itinerary.',
  'Guide on day 1 and day 3.',
]

// What the summary card says about each choice — a headline value plus a
// supporting detail, matching the flight cards' at-a-glance hierarchy. The
// price is still derived from the `pricing` table, so the two can never
// quote different numbers.
const tripStat: Record<Exclude<Trip, 'all'>, { value: string; detail: string }> = {
  full: { value: 'Full', detail: 'Oct 29 – Nov 1' },
  short: { value: 'Shortened', detail: 'Oct 29 – 31' },
}

const flightStat: Record<Exclude<FlightChoice, 'all'>, { value: string; detail: string }> = {
  rt: { value: 'Round trip', detail: 'HYD ⇄ COK' },
  ow: { value: 'One way', detail: 'HYD → COK' },
}

// The last day differs by trip, so the section swaps its contents rather than
// disappearing — shortened guests still need to know when and how they leave.
const departures: Record<Exclude<Trip, 'all'>, { eyebrow: string; body: string }> = {
  full: {
    eyebrow: 'Day 4 · Sunday, November 1',
    body: 'Enjoy one last breakfast at the hotel before checking out. From there, head to Kochi airport for your flight home — or onward to your next adventure. Safe travels, and thank you for celebrating with us!',
  },
  short: {
    eyebrow: 'Day 3 · Saturday, October 31',
    body: 'On the shortened option there’s no final night at the hotel. After the Fort Kochi tour you head straight to the airport that afternoon for your flight home — or onward to your next adventure. Safe travels, and thank you for celebrating with us!',
  },
}

// Every section is still deep-linkable by id; these are just the ones worth a
// chip. Guests with a form response get a "Your Trip" chip prepended — the bar
// scrolls sideways on a phone rather than wrapping, so five still fit.
const jumpTargets: JumpTarget[] = [
  { id: 'day-1', label: 'Itinerary' },
  { id: 'flights', label: 'Flights' },
  { id: 'inclusions', label: 'Inclusions' },
  { id: 'pricing', label: 'Pricing' },
]

const yourTripTarget: JumpTarget = { id: 'your-trip', label: 'Your Trip' }

// Toggles rather than radios: "haven't chosen yet" is a real state here, so
// clicking the selected option clears the filter instead of being a no-op.
const FilterToggle: React.FC<{
  legend: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}> = ({ legend, options, value, onChange }) => (
  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
    <span className="text-xs uppercase tracking-wide text-zeus/60">{legend}</span>
    <div className="flex gap-1.5">
      {options.map((option) => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? 'all' : option.value)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 ${
              selected
                ? 'bg-rosewood text-cream shadow-sm'
                : 'border border-soyabean/40 text-soyabean hover:bg-soyabean/10'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  </div>
)

const KeralaItineraryContent: React.FC = () => {
  const [hydrated, setHydrated] = React.useState(false)
  // Only mounted once the guest is identified, so their trip-form payload (if
  // they filled one out) is already in context by the time this renders.
  const { kerala, displayName } = useGuestScheduleContext()

  React.useEffect(() => {
    // The prerendered HTML has no guest, so anything keyed on one has to wait
    // for the client. Flipping a flag in a mount effect is how you say "we are
    // past hydration" -- the render it costs is the point, not a mistake.
    // oxlint-disable-next-line react/set-state-in-effect
    setHydrated(true)
  }, [])

  // Plain page state, seeded from the guest's own form choices — deliberately
  // not the URL, so nobody can link anyone else into a pre-filtered view.
  // Seeding at mount rather than syncing means clearing a pill stays cleared.
  const [trip, setTrip] = React.useState<Trip>(kerala?.trip ?? 'all')
  const [flightChoice, setFlightChoice] = React.useState<FlightChoice>(kerala?.flight ?? 'all')
  const filtered = trip !== 'all' || flightChoice !== 'all'

  // Sorted, not just filtered: unfiltered, the two returns belong to different
  // itineraries, and listing them in declaration order puts November 1 above
  // October 31.
  const visibleFlights = flights
    .filter(
      (flight) =>
        (trip === 'all' || flight.trips.includes(trip)) &&
        (flightChoice !== 'ow' || flight.leg === 'out'),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
  const visiblePricing = pricing.filter((option) => trip === 'all' || option.trip === trip)
  const showRoundTrip = flightChoice !== 'ow'
  const showOneWay = flightChoice !== 'rt'
  const departure = departures[trip === 'short' ? 'short' : 'full']

  // The guest's own price, read straight out of the pricing table so the card
  // and the table can never quote different numbers — unless their record
  // carries an override (a stay the table's rows don't describe).
  const summaryInr = kerala ? keralaPrice(kerala) : null

  return (
    <div className="min-h-screen bg-peach/20">
      {/* Wraps the header too, so the bar sits at the very top of the page —
          pinned from the start, the way the Travel section’s nav is. */}
      <JumpNav targets={kerala ? [yourTripTarget, ...jumpTargets] : jumpTargets} ready={hydrated}>
        <header className="bg-peach/60 px-4 py-16 text-center">
          <div className="mx-auto max-w-2xl">
            <p className="text-xs uppercase tracking-wide text-zeus/60">
              October 29 – November 1, 2026 • Kochi & Alleppey, Kerala
            </p>
            <h1 className="mt-1 font-display text-4xl text-rosewood sm:text-5xl">
              A Lush Kerala Weekend
            </h1>
            <div className="mx-auto mt-4 max-w-xl text-left">
              <p className="font-body text-lg leading-relaxed text-zeus/80">
                After the wedding, join us in enjoying one of South India’s most beautiful states —
                Kerala. We will explore Kochi’s historic streets, a cultural evening of Kathakali,
                and a night on a houseboat in the Alleppey backwaters.
              </p>
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 font-body">
              <p className="text-sm text-zeus/80">
                Doing a different version of the trip? Pick yours and the page will follow.
              </p>
              <FilterToggle
                legend="Itinerary"
                value={trip}
                onChange={(value) => setTrip(parseTrip(value))}
                options={[
                  { value: 'full', label: 'Full' },
                  { value: 'short', label: 'Shortened' },
                ]}
              />
              <FilterToggle
                legend="Airfare"
                value={flightChoice}
                onChange={(value) => setFlightChoice(parseFlights(value))}
                options={[
                  { value: 'rt', label: 'Round trip' },
                  { value: 'ow', label: 'One way' },
                ]}
              />
              {filtered && (
                <button
                  type="button"
                  onClick={() => {
                    setTrip('all')
                    setFlightChoice('all')
                  }}
                  className="cursor-pointer text-sm text-rosewood underline underline-offset-4 hover:text-buccaneer focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
                >
                  Show everything
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-12 py-12 font-body">
          {/* Deliberately driven by the form payload, not the toggles above —
              this is the guest's confirmation of what they told us, and playing
              with the filters must not change what it says. */}
          {kerala && (
            <section id="your-trip" className={JUMP_NAV_SCROLL_MT}>
              <StickySectionHeading
                eyebrow={displayName ? `For ${displayName}` : undefined}
                title="Your Trip"
                anchorId="your-trip"
              />
              <div className="mx-auto w-full max-w-2xl px-4">
                <div className="card mt-4 border border-gold/40">
                  <h3 className="font-display text-lg text-rosewood">
                    Here’s what we have down for you
                  </h3>
                  {/* Same visual language as the flight cards — muted eyebrows
                      over big serif values — in a 2×2 grid: four full-width
                      rows left the panel mostly empty space. The two grid rows
                      are separate elements so the rule between them can run
                      unbroken across the column gutter. */}
                  <dl className="mt-3 rounded-lg border border-gold/40 bg-lily/20 px-4 py-4">
                    <div className="grid grid-cols-2 gap-x-4">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-zeus/60">Itinerary</dt>
                        <dd>
                          <p className="mt-1.5 font-display text-2xl leading-none text-rosewood">
                            {tripStat[kerala.trip].value}
                          </p>
                          <p className="mt-1.5 text-sm text-zeus/80">
                            {tripStat[kerala.trip].detail}
                          </p>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-zeus/60">Flights</dt>
                        <dd>
                          <p className="mt-1.5 font-display text-2xl leading-none text-rosewood">
                            {flightStat[kerala.flight].value}
                          </p>
                          <p className="mt-1.5 text-sm text-zeus/80">
                            {flightStat[kerala.flight].detail}
                          </p>
                        </dd>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-x-4 border-t border-gold/30 pt-4">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-zeus/60">Room</dt>
                        <dd>
                          <p className="mt-1.5 font-display text-2xl leading-none text-rosewood">
                            {kerala.occupancy === 'double' ? 'Double' : 'Single'}
                          </p>
                          {/* Who they wake up next to is the fact guests scan
                              for — full ink, not the muted detail shade. */}
                          <p className="mt-1.5 text-sm font-medium text-zeus">
                            {kerala.occupancy === 'single'
                              ? 'a room of your own'
                              : `with ${kerala.roommates.join(' and ')}`}
                          </p>
                        </dd>
                      </div>
                      {summaryInr !== null && (
                        <div>
                          <dt className="text-xs uppercase tracking-wide text-zeus/60">
                            Your price
                          </dt>
                          <dd>
                            <p className="mt-1.5 font-display text-2xl leading-none text-rosewood">
                              {usd(summaryInr)}
                            </p>
                            <p className="mt-1.5 text-sm text-zeus/80">per person</p>
                          </dd>
                        </div>
                      )}
                    </div>
                  </dl>
                  {kerala.priceNote && (
                    <p className="mt-3 rounded-md bg-peach/40 px-3 py-2 text-sm text-zeus/80">
                      {kerala.priceNote}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-zeus/60">
                    Does anything here look wrong? Let us know and we’ll fix it.
                  </p>
                </div>
              </div>
            </section>
          )}

          <section id="day-1" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading
              eyebrow="Day 1 · Thursday, October 29"
              title="Arrive in Kochi (also known as Cochin)"
              anchorId="day-1"
            />
            <div className="mx-auto w-full max-w-2xl px-4">
              <div className="card mt-4">
                <p className="text-sm text-zeus/80">
                  After breakfast at Golkonda, take your flight from Hyderabad to Cochin. On arrival
                  transfer to the{' '}
                  <a
                    href="https://share.google/4e3cmevDZLquhnbYf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-rosewood"
                  >
                    Grand Hyatt Kochi Bolgatty Hotel
                  </a>
                  . Check in, refresh, and prepare for an evening of live entertainment.
                </p>
              </div>
              <div className="card mt-4">
                <h3 className="font-display text-lg text-rosewood">
                  An immersive cultural evening
                </h3>
                <p className="mt-1 text-sm text-zeus/80">
                  Experience three of Kerala’s most iconic traditional art forms in one immersive
                  cultural evening:
                </p>
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-zeus/80">
                  {culturalEvening.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                <Figure photo={photos.kathakali} />
              </div>
            </div>
          </section>

          <section id="day-2" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading
              eyebrow="Day 2 · Friday, October 30"
              title="Alleppey & the Backwaters"
              anchorId="day-2"
            />
            <div className="mx-auto w-full max-w-2xl px-4">
              <div className="card mt-4">
                <p className="text-sm leading-relaxed text-zeus/80">
                  Today after breakfast depart to Alleppey. Alappuzha, often referred to as
                  Alleppey, is a picturesque city in the state of Kerala, known for its intricate
                  network of canals, backwaters, beaches, and lagoons. Often dubbed the ‘Venice of
                  the East,’ Alappuzha is a popular tourist destination, especially famed for its
                  houseboat cruises that offer an immersive experience of Kerala’s enchanting
                  backwaters. This coastal city provides a perfect blend of natural beauty, cultural
                  heritage, and serene water-based activities.
                </p>
                <h3 className="mt-4 font-display text-lg text-rosewood">
                  Backwaters and Houseboat Cruises
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-zeus/80">
                  The backwaters of Alappuzha are a labyrinthine network of interconnected canals,
                  rivers, lakes, and inlets, stretching over 900 kilometers. These tranquil
                  waterways are fringed with lush greenery, coconut palms, paddy fields, and quaint
                  villages, creating a charming landscape. Exploring these backwaters on a
                  traditional houseboat, known as a ‘kettuvallam,’ is a quintessential Kerala
                  experience.
                </p>
                <Figure photo={photos.houseboat} />
              </div>
            </div>
          </section>

          <section id="day-3" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading
              eyebrow="Day 3 · Saturday, October 31"
              title="Fort Kochi Sightseeing"
              anchorId="day-3"
            />
            <div className="mx-auto w-full max-w-2xl px-4">
              <p className="mt-4 text-zeus/80">
                After your breakfast disembark from you house boat and head back to Kochi. Discover
                the cultural charm of Kochi.
              </p>
              <ol className="mt-4 space-y-4">
                {sights.map((sight, i) => (
                  <li key={sight.title} className="card flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lily font-medium text-zeus">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-lg text-rosewood">{sight.title}</h3>
                      {sight.paragraphs.map((para, j) => (
                        <p
                          key={j}
                          className={
                            j === 0
                              ? 'mt-1 text-sm text-zeus'
                              : 'mt-3 text-sm leading-relaxed text-zeus/70'
                          }
                        >
                          {para}
                        </p>
                      ))}
                      {sight.photo && <Figure photo={sight.photo} />}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section id="departure" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading
              eyebrow={departure.eyebrow}
              title="Departure"
              anchorId="departure"
            />
            <div className="mx-auto w-full max-w-2xl px-4">
              <div className="card mt-4">
                <p className="text-sm text-zeus/80">{departure.body}</p>
                {trip === 'all' && (
                  <p className="mt-3 text-xs text-zeus/70">
                    On the shortened option there’s no final night at the hotel — you head to the
                    airport on the afternoon of October 31 instead, straight after the Fort Kochi
                    tour.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section id="flights" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading title="Flights" anchorId="flights" />
            <div className="mx-auto w-full max-w-2xl px-4">
              <div className="card mt-4 space-y-3">
                {visibleFlights.map((flight) => (
                  <div
                    key={`${flight.date}-${flight.from.code}`}
                    className="rounded-lg border border-gold/40 bg-lily/20 px-4 py-3"
                  >
                    {/* The codes, times and cities below carry the route visually, so the
                      heading is for the outline and for screen readers only. */}
                    <h3 className="sr-only">
                      {flight.from.city} ({flight.from.code}) → {flight.to.city} ({flight.to.code})
                    </h3>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <p className="text-xs uppercase tracking-wide text-zeus/60">
                        {dayLabel(flight.date)}
                      </p>
                      {/* text-xs until sm: the longer flight number otherwise wraps on a
                        narrow phone while the shorter one doesn't, and the two cards
                        sitting side by side stop matching. */}
                      <p className="text-xs text-zeus/80 sm:text-sm">
                        {flight.number ?? 'Flight to be confirmed'}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div>
                        <p className="font-display text-2xl leading-none text-rosewood">
                          {flight.from.code}
                        </p>
                        <p className="mt-1.5 text-lg font-medium leading-none text-zeus">
                          <span className="sr-only">Departs </span>
                          {flight.from.time ? clock(flight.from.time) : '—'}
                        </p>
                        <p className="mt-1 text-xs text-zeus/60">{flight.from.city}</p>
                      </div>
                      <div className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-xs text-zeus/60">
                          {flight.from.time && flight.to.time
                            ? duration(flight.from.time, flight.to.time)
                            : ''}
                        </span>
                        <span aria-hidden className="h-px w-full bg-gold/60" />
                      </div>
                      <div className="text-right">
                        <p className="font-display text-2xl leading-none text-rosewood">
                          {flight.to.code}
                        </p>
                        <p className="mt-1.5 text-lg font-medium leading-none text-zeus">
                          <span className="sr-only">Arrives </span>
                          {flight.to.time ? clock(flight.to.time) : '—'}
                        </p>
                        <p className="mt-1 text-xs text-zeus/60">{flight.to.city}</p>
                      </div>
                    </div>
                    {/* Which trip this leg belongs to only needs saying while both are
                      on screen; once filtered, every card shown is the guest's own. */}
                    {trip === 'all' && flight.leg === 'return' && (
                      <p className="mt-2 text-xs text-zeus/60">{flight.scope}</p>
                    )}
                    {!flight.number && (
                      <p className="mt-2 text-xs text-zeus/70">
                        Your fare covers this leg, but we haven’t booked it yet — we’ll send the
                        details once it’s confirmed.
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {/* Once filtered, every card on screen is the guest's own and needs no
                caveat — except the one-way case, where what's missing is the point. */}
              {flightChoice === 'ow' ? (
                <p className="mt-4 text-xs text-zeus/70">
                  Your fare covers the flight out to Kochi only — you’ll book your own departure
                  from there.
                </p>
              ) : trip === 'all' ? (
                <p className="mt-4 text-xs text-zeus/70">
                  The November 1 return is for guests on the full itinerary flying back to
                  Hyderabad. On the shortened option you leave Kochi on the afternoon of October 31,
                  and anyone flying onward from Kochi books their own departure.
                </p>
              ) : null}
            </div>
          </section>

          <section id="inclusions" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading title="Inclusions" anchorId="inclusions" />
            <div className="mx-auto w-full max-w-2xl px-4">
              <div className="card mt-4">
                <ul className="list-disc space-y-1.5 pl-4 text-sm text-zeus/80">
                  {inclusionsFor(trip, flightChoice).map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section id="pricing" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading title="Pricing" anchorId="pricing" />
            <div className="mx-auto w-full max-w-2xl px-4">
              <p className="mt-4 text-sm leading-relaxed text-zeus/80">
                Prices are per person and cover everything in the Inclusions list above.
                {!filtered && (
                  <>
                    {' '}
                    Choose <em>round trip</em> if you’re flying back to Hyderabad, or{' '}
                    <em>one way</em> if you’re heading onward or home from Kochi. The shortened
                    option skips the final night at the hotel — you do everything through the Fort
                    Kochi tour on October 31, then head straight to the airport that afternoon.
                  </>
                )}
              </p>
              {visiblePricing.map((option) => {
                // Their row lights up only inside their own trip's card; the
                // other card (if shown) stays neutral.
                const highlightOcc =
                  kerala !== undefined && option.trip === kerala.trip ? kerala.occupancy : null
                return (
                  <div key={option.title} className="card mt-4">
                    <h3 className="font-display text-lg text-rosewood">{option.title}</h3>
                    <p className="text-xs uppercase tracking-wide text-zeus/60">{option.dates}</p>
                    {/* border-separate, not collapse: collapse discards the cell
                    border-radius the "Your rate" highlight needs, so the row
                    borders live on the cells here. The table bleeds px-3 past
                    the text columns (and pads them back) so the highlight can
                    enclose the text instead of stopping at its edge. The line
                    ABOVE the highlighted row is the highlight's own: an inset
                    shadow that follows its rounded corners, where a border or
                    a straight rule would overhang them — so whichever straight
                    line would normally sit there (the header's underline or a
                    row separator) is dropped. Below the highlight the corners
                    curve down into the ordinary full-width separator. */}
                    <table className="-mx-3 mt-3 w-[calc(100%+1.5rem)] border-separate border-spacing-0 text-sm">
                      <thead>
                        <tr>
                          <th
                            scope="col"
                            className={`${
                              highlightOcc === option.rows[0].occ ? '' : 'border-b border-gold/40 '
                            }py-2 pl-3 text-left text-xs font-normal uppercase tracking-wide text-zeus/60`}
                          >
                            Occupancy
                          </th>
                          {showRoundTrip && (
                            <th
                              scope="col"
                              className={`${
                                highlightOcc === option.rows[0].occ
                                  ? ''
                                  : 'border-b border-gold/40 '
                              }py-2 text-right text-xs font-normal uppercase tracking-wide text-zeus/60 ${
                                showOneWay ? '' : 'pr-3'
                              }`}
                            >
                              Round trip
                            </th>
                          )}
                          {showOneWay && (
                            <th
                              scope="col"
                              className={`${
                                highlightOcc === option.rows[0].occ
                                  ? ''
                                  : 'border-b border-gold/40 '
                              }py-2 pr-3 text-right text-xs font-normal uppercase tracking-wide text-zeus/60`}
                            >
                              One way <span className="whitespace-nowrap">HYD→COK</span>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {option.rows.map((row, rowIndex) => {
                          const yourRate = row.occ === highlightOcc
                          const dimmed = highlightOcc !== null && !yourRate
                          const nextHighlighted =
                            option.rows[rowIndex + 1] !== undefined &&
                            option.rows[rowIndex + 1].occ === highlightOcc
                          // The gold hex is the theme's `gold` at 40%/20% — inlined
                          // because the shadow utility can't take a theme opacity.
                          const tintLine =
                            rowIndex === 0
                              ? 'shadow-[inset_0_1px_0_0_#c8a25e66] '
                              : 'shadow-[inset_0_1px_0_0_#c8a25e33] '
                          const cell = `py-2 ${
                            rowIndex < option.rows.length - 1 && !nextHighlighted
                              ? 'border-b border-gold/20 '
                              : ''
                          }${yourRate ? `bg-gold/10 ${tintLine}` : ''}`
                          return (
                            <tr key={row.occupancy} className={dimmed ? 'opacity-60' : ''}>
                              <th
                                scope="row"
                                className={`${cell}rounded-l-lg pl-3 pr-3 text-left font-normal text-zeus/80`}
                              >
                                {row.occupancy}
                                {yourRate && (
                                  <span className="ml-2 rounded-full bg-rosewood px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cream">
                                    Your rate
                                  </span>
                                )}
                              </th>
                              {showRoundTrip && (
                                <td
                                  className={`${cell}text-right font-medium text-zeus ${
                                    showOneWay ? '' : 'rounded-r-lg pr-3'
                                  }`}
                                >
                                  {usd(row.roundTrip)}
                                </td>
                              )}
                              {showOneWay && (
                                <td
                                  className={`${cell}rounded-r-lg pr-3 text-right font-medium text-zeus`}
                                >
                                  {usd(row.oneWay)}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </JumpNav>
    </div>
  )
}

/**
 * Shown to anyone the roster doesn't place on the trip.
 *
 * Worth being plain about what this is: the itinerary still ships in the JS
 * bundle, so this keeps the page from being stumbled into, not from being
 * read by anyone who looks. It does keep the copy out of the prerendered
 * HTML, since the server renders this branch.
 */
const KeralaGate: React.FC<{
  status: GuestScheduleState['status']
  displayName?: string
  onSignOut: GuestScheduleState['signOut']
  onUnlock: () => void
  onViewOnJoy: () => void
}> = ({ status, displayName, onSignOut, onUnlock, onViewOnJoy }) => {
  return (
    <div className="min-h-screen bg-peach/20">
      <header className="bg-peach/60 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs uppercase tracking-wide text-zeus/60">
            October 29 – November 1, 2026 • Kochi & Alleppey, Kerala
          </p>
          <h1 className="mt-1 font-display text-4xl text-rosewood sm:text-5xl">
            A Lush Kerala Weekend
          </h1>

          <div className="mx-auto mt-4 max-w-xl">
            {status === 'error' ? (
              <p className="font-body text-lg leading-relaxed text-zeus/80">
                We’re having trouble loading personalized schedules right now —{' '}
                <button
                  type="button"
                  onClick={onViewOnJoy}
                  className="underline decoration-rosewood/40 underline-offset-2 hover:text-rosewood"
                >
                  view your full details on Joy
                </button>
                .
              </p>
            ) : status === 'identified' ? (
              // We recognised them and they're still here, so the lookup worked
              // and the trip simply isn't theirs. Say both parts: silence reads
              // as the name having failed to match.
              <>
                <p className="font-body text-lg leading-relaxed text-zeus/80">
                  We found you, {displayName}!
                </p>
                <p className="mt-3 font-body text-lg leading-relaxed text-zeus/80">
                  The Kerala trip is a smaller group staying on after the wedding, and it looks like
                  it isn’t part of your invitation. If you think that’s a mistake, reach out to us
                  and we’ll take another look.
                </p>
                <Link to="/schedule" className="btn-primary mt-6 inline-block">
                  See your schedule
                </Link>
                <p className="mt-4 font-body text-sm text-zeus/70">
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="underline decoration-rosewood/40 underline-offset-2 hover:text-rosewood"
                  >
                    Not you?
                  </button>
                </p>
              </>
            ) : (
              <>
                <p className="font-body text-lg leading-relaxed text-zeus/80">
                  This trip is for the guests joining us in Kerala after the wedding. Add your name
                  to see it.
                </p>
                <button
                  type="button"
                  onClick={onUnlock}
                  disabled={status === 'loading'}
                  className="btn-primary mt-6"
                >
                  Unlock Your Schedule
                </button>
              </>
            )}
          </div>
        </div>
      </header>
    </div>
  )
}

// Reads the shared lookup rather than starting its own — the hook fetches the
// index and derives a key at 150,000 iterations, and SiteLayout's provider has
// already paid for both by the time this renders.
const KeralaItinerary: React.FC = () => {
  const { status, events, displayName, signOut, openUnlock, openJoy } = useGuestScheduleContext()

  if (events.some((event) => event.id === KERALA_EVENT_ID)) return <KeralaItineraryContent />

  return (
    <KeralaGate
      status={status}
      displayName={displayName}
      onSignOut={signOut}
      onUnlock={openUnlock}
      onViewOnJoy={openJoy}
    />
  )
}

export default KeralaItinerary
