import React from 'react'
import { Link } from 'react-router-dom'
import { Bullets, Disclosure, DisclosureGroup } from '../components/Disclosure'
import WhatToWearButton from '../components/WhatToWearButton'
import { useHashDisclosure } from '../lib/useHashDisclosure'

// What to pack for the week around the events — the heat, the temples, the
// streets. Not the wedding itself: the dress codes and the outfits live on
// /what-to-wear, which this tip points at rather than restating.
const EVERYDAY_OUTFITS = [
  'Light, breathable clothing for the heat, plus something modest (shoulders and knees covered) for temples and religious sites.',
  'For men, opt for pants rather than shorts while you’re out and about.',
  'A pair of shoes or sandals you don’t mind getting dirty — walking around Indian streets can be dusty.',
]

const OutfitsTip: React.FC = () => (
  <>
    <Bullets items={EVERYDAY_OUTFITS} />
    <p>
      For the events themselves, the guide has the dress code for each of yours, a photo of every
      outfit, and where to shop for one.
    </p>
    <p>
      <WhatToWearButton />
    </p>
  </>
)

// `id`s are the deep-link anchors (/travel-tips#visa-entry-documents) and are
// hand-written rather than derived from the titles, so rewording a heading
// doesn't quietly break links people have already shared.
const groups: {
  id: string
  title: string
  blurb: string
  tips: { id: string; title: string; body: React.ReactNode }[]
}[] = [
  {
    id: 'one-or-two-months-out',
    title: 'One or two months out',
    blurb: 'The things with a lead time — worth starting before they sneak up on you.',
    tips: [
      {
        id: 'visa-entry-documents',
        title: 'Visa & entry documents',
        body: (
          <>
            <p>You’ll need an approved e-Visa before you fly.</p>
            <Bullets
              items={[
                <>
                  Apply for the{' '}
                  <a
                    href="https://indianvisaonline.gov.in/evisa/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-rosewood"
                  >
                    e-Tourist Visa
                  </a>{' '}
                  online. Approval usually arrives within a few business days, but apply early so
                  there’s room for a hiccup. Our{' '}
                  <Link to="/evisa" className="underline hover:text-rosewood">
                    e-Visa Helper
                  </Link>{' '}
                  walks you through the form step by step.
                </>,
                'Print your approval when it comes through and pack it with your passport — you’ll show it at customs on arrival.',
                <>
                  Closer to your trip you’ll also fill out an{' '}
                  <a
                    href="https://indianvisaonline.gov.in/earrival/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-rosewood"
                  >
                    e-Arrival card
                  </a>
                  . Keep it with your visa approval.
                </>,
              ]}
            />
          </>
        ),
      },
      {
        id: 'check-your-passport',
        title: 'Check your passport',
        body: (
          <Bullets
            items={[
              'India asks that your passport be valid for at least six months from your arrival date, with a couple of blank pages for stamps.',
              'Renewals can take weeks, so it’s worth looking now rather than the week before.',
            ]}
          />
        ),
      },
      {
        id: 'see-a-travel-nurse',
        title: 'See a travel nurse',
        body: (
          <>
            <p>
              For U.S. travelers, there’s nothing you’re required to get before traveling to India.
              It’s a personal decision, and a medical professional is the right person to help you
              make it.
            </p>
            <Bullets
              items={[
                'Booking an appointment with a travel clinic or travel nurse is an easy way to talk through vaccinations, malaria pills, and anything else worth considering for your own situation and history.',
                <>
                  The{' '}
                  <a
                    href="https://wwwnc.cdc.gov/travel/destinations/traveler/none/india"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-rosewood"
                  >
                    CDC’s recommendations for India
                  </a>{' '}
                  are a good place to read up beforehand. If you’re traveling from outside the U.S.,
                  refer to your own country’s official guidance.
                </>,
                'Some vaccines need a few weeks to take effect or come in a series, and malaria pills often need to be started a few weeks before you travel.',
              ]}
            />
          </>
        ),
      },
      {
        id: 'book-your-room',
        title: 'Book your room and any onward travel',
        body: (
          <Bullets
            items={[
              <>
                Our{' '}
                <Link to="/hotels" className="underline hover:text-rosewood">
                  Hotels
                </Link>{' '}
                page has the places we’d recommend and how close they are to the celebrations.
              </>,
              'If you’re adding time elsewhere in India, domestic flights and trains fill up — book those once your dates are firm.',
            ]}
          />
        ),
      },
      {
        id: 'make-a-voting-plan',
        title: 'Make a voting plan (U.S. voters)',
        body: (
          <>
            <p>
              Election Day in the U.S. is Tuesday, November 3 — close on the heels of the
              celebrations. Most of you will be home in time, but it’s an easy thing to lose track
              of with a trip in between.
            </p>
            <Bullets
              items={[
                'If you can, vote early and in person before you fly. Most states open early voting in the second half of October, and it’s the simplest way to have it handled before you travel.',
                <>
                  Your state sets the rules — registration deadlines, early voting windows, and what
                  to bring all vary. The{' '}
                  <a
                    href="https://www.vote.org/polling-place-locator/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-rosewood"
                  >
                    vote.org polling place locator
                  </a>{' '}
                  will point you to yours.
                </>,
              ]}
            />
          </>
        ),
      },
    ],
  },
  {
    id: 'the-week-before',
    title: 'The week before',
    blurb: 'Packing, phones, and a few things to set up before you fly.',
    tips: [
      {
        id: 'staying-connected-esim',
        title: 'Staying connected (eSIM)',
        body: (
          <>
            <p>
              An eSIM isn’t essential if your carrier already includes international coverage, but
              it can give you better, more reliable service.
            </p>
            <Bullets
              items={[
                <>
                  We’ve personally used{' '}
                  <a
                    href="https://www.airalo.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-rosewood"
                  >
                    Airalo
                  </a>{' '}
                  and it works — though not without issue.
                </>,
                'Most hotels have reliable wifi, as do many public places like malls and cafes, so you won’t be relying on your data plan the whole time.',
                'Plans come as data-only or data with calls and texts. We’d go data-only if your phone can run two eSIMs at once — the call and text plans give you a separate regional or global phone number, which most travelers won’t use.',
                'Set it up before you arrive so you’re connected the moment you land.',
              ]}
            />
          </>
        ),
      },
      {
        id: 'cards-and-your-bank',
        title: 'Cards & your bank',
        body: (
          <Bullets
            items={[
              'Let your bank and card issuers know your travel dates so nothing gets frozen mid-trip — most banks let you do this in the app.',
              'Check what your cards charge in foreign transaction fees, and bring a second card as a backup.',
            ]}
          />
        ),
      },
      {
        id: 'what-to-pack',
        title: 'What to pack',
        body: (
          <Bullets
            items={[
              'An Indian power adapter (Type D / Type M) for your chargers and electronics.',
              'A portable power bank — long days out, and you’ll lean on your phone for maps, ride-hailing, and photos.',
              'Travel-size hand sanitizer — handy before street food and on long days out.',
              'Sun protection — sunscreen, a hat, and sunglasses.',
              'Antacids (Tums). Indian food runs spicier than you may be used to.',
              'You can leave the bug spray at home — pick up Odomos at a local pharmacy once you’re here. It’s our preferred mosquito repellent.',
            ]}
          />
        ),
      },
      {
        id: 'outfits',
        title: 'Outfits',
        body: <OutfitsTip />,
      },
      {
        id: 'handy-apps',
        title: 'Handy apps to download',
        body: (
          <Bullets
            items={[
              'Uber — for cars and autos.',
              'Google Maps — for getting around and finding places nearby.',
              'WhatsApp — the primary way people message in India.',
              'Your airline’s app — for boarding passes and flight updates.',
            ]}
          />
        ),
      },
    ],
  },
  {
    id: 'once-youre-here',
    title: 'Once you’re here',
    blurb: 'Day-to-day things that make getting around and settling in easier.',
    tips: [
      {
        id: 'at-the-airport',
        title: 'At the airport',
        body: (
          <>
            <p>A few things to expect on your way in, and again on your way home:</p>
            {/* mt-5 rather than the mt-4 used for sub-headings elsewhere: the
                body is space-y-3, which puts 12px below the previous list, and
                adjacent margins collapse to the larger of the two. Anything at
                or under 12px therefore changes nothing on screen and leaves the
                heading equidistant between the list above and its own. */}
            <h3 className="mt-5 font-display text-base text-rosewood">Arriving in India</h3>
            <Bullets
              items={[
                'After you exit the plane, follow the crowd to immigration and baggage claim — have your passport, e-Visa approval, and e-Arrival card ready — then look for the prepaid taxi or ride-share pickup area to reach your hotel. Signage points the way, and staff are happy to help if you’re unsure.',
                'Connecting through Amsterdam: if both flights are to or from outside the Schengen area, you generally won’t pass through passport control between them — the same holds on the way home.',
              ]}
            />
            <h3 className="mt-5 font-display text-base text-rosewood">Heading home</h3>
            <Bullets
              items={[
                'Expect to show your ticket and passport at the entrance to the airport — Indian airports generally only let ticketed passengers into the terminal. A PDF or your airline’s app is fine.',
                'Airport security is stricter than you may be used to, here and on any domestic flights within India: take out all electronics (including chargers and cables) when going through the scanners to keep the line moving.',
                'In Hyderabad, the KLM check-in kiosk is in Section B of the main check-in hall — the big atrium with the airline desks and bag drop.',
                'Connecting through Amsterdam: expect a security screening as you come off the flight from India, before you’re let into the terminal. Water bottles don’t need to be empty for this one.',
                'Flying home to the US through Abu Dhabi: you’ll generally clear US customs there rather than on arrival in the States.',
              ]}
            />
          </>
        ),
      },
      {
        id: 'getting-around',
        title: 'Getting around (Uber & autos)',
        body: (
          <>
            <p>Uber works well in most cities and is the easiest way to get around.</p>
            <Bullets
              items={[
                'At the airport it works a little differently — wait in the ride-share line to be matched with a car rather than being assigned one in the app.',
                'Once you’re in the car, you’ll share a PIN with the driver to confirm the ride.',
                'In the app’s payment settings, choose to pay in the local currency (INR). Paying in USD adds a conversion fee.',
                'Autos (called tuk-tuks in some countries) are a fun way to travel and can be booked through Uber — but they’re cash only, so keep some rupees on hand.',
                'Most Ubers in India run on compressed natural gas, and the tank takes up much of the trunk. If you’re traveling with more than a bag or two, book a size up from what you’d expect to need in the US.',
              ]}
            />
          </>
        ),
      },
      {
        id: 'crossing-streets',
        title: 'Crossing streets & walking around',
        body: (
          <Bullets
            items={[
              'Many roads don’t have sidewalks, so always stay aware of the scooters, autos, and cars around you.',
              'Drivers honk proactively — a honk usually just means “I’m here, beside or behind you,” not that you’ve done anything wrong. It’s part of how traffic communicates.',
            ]}
          />
        ),
      },
      {
        id: 'at-your-hotel',
        title: 'At your hotel',
        body: (
          <Bullets
            items={[
              'Many hotels and guesthouses heat shower water with a geyser — a switch in the bathroom or light-switch panel that glows red when it’s on. Flip it on 10–15 minutes before you shower, and off when you’re done; electricity is more of a commodity in India.',
            ]}
          />
        ),
      },
      {
        id: 'eating-and-drinking',
        title: 'Eating & drinking',
        body: (
          <>
            <p>The food is one of the best parts of the trip — a few habits keep it worry-free:</p>
            <Bullets
              items={[
                'Stick to bottled water.',
                'Skip ice in drinks unless you’re at a nicer restaurant or hotel.',
                'Be cautious with anything involving uncooked vegetables or liquid — salads, and street food like pani puri. Both can be delicious and are generally fine at a nicer restaurant or hotel, but we’d skip them elsewhere.',
                'Indian food can be spicy, even Western favorites like McDonald’s. If you don’t have a high spice tolerance, steer clear of dishes marked spicy.',
              ]}
            />
          </>
        ),
      },
      {
        id: 'money-and-payments',
        title: 'Money & payments',
        body: (
          <>
            <p>
              Cards are widely accepted at established shops and restaurants, but a little cash goes
              a long way:
            </p>
            <Bullets
              items={[
                'Keep some rupees on hand for autos, small vendors, and temple donations.',
                'We’d pull out cash from the currency exchange at the airport when you land — it’s the most convenient place to start, though ATMs are widely available around the city too.',
                'You won’t need large sums. Around 1,000 rupees at a time is plenty, and it’s worth asking for 100-rupee notes if you get the choice — small vendors and auto drivers often can’t break big bills.',
                'Tipping is appreciated but not expected the way it is in the US — rounding up an auto fare or leaving a little for hotel and restaurant staff is plenty.',
                'At markets and with non-metered autos, a bit of friendly bargaining is normal — agree on the fare before you get in.',
                'When a card reader offers to charge you in dollars instead of rupees, choose rupees — the dollar rate a terminal picks is generally worse than the one your bank would give you.',
              ]}
            />
          </>
        ),
      },
      {
        id: 'culture-and-etiquette',
        title: 'Culture & etiquette',
        body: (
          <Bullets
            items={[
              'Indian weddings run differently from Western ones. The ceremony is long, but there’s no expectation that guests sit still and stay focused the whole way through — chatting and socializing during it is completely normal. The priest will announce the key moments as they come, so you’ll know when to turn your attention to the couple.',
              'It’s very common to take your shoes off in people’s homes, temples, and even some shops. It’s usually obvious — but when in doubt, leave your shoes at the door.',
              'For temples and religious sites, dress modestly with shoulders and knees covered.',
            ]}
          />
        ),
      },
    ],
  },
]

const TravelTips: React.FC = () => {
  useHashDisclosure()

  return (
    <div className="min-h-screen bg-peach/20">
      <header className="bg-peach/60 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-4xl text-rosewood sm:text-5xl">India Travel Tips</h1>
          <div className="mx-auto mt-4 max-w-xl text-left">
            <p className="font-body text-lg leading-relaxed text-zeus/80">
              A few things we’ve learned that make traveling in India smoother, sorted by when
              you’ll need them.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12 font-body">
        {groups.map((group) => (
          <DisclosureGroup key={group.id} id={group.id} title={group.title} blurb={group.blurb}>
            {group.tips.map((tip) => (
              <Disclosure key={tip.id} id={tip.id} title={tip.title}>
                {tip.body}
              </Disclosure>
            ))}
          </DisclosureGroup>
        ))}

        <p className="mt-4 text-xs text-zeus/60">
          These are friendly pointers from our own travels, not official guidance — customs rules,
          fees, and health advice can change, so check current sources before you fly.
        </p>
      </div>
    </div>
  )
}

export default TravelTips
