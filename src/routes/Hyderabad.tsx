import React from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import ArchFrame from '../components/ArchFrame'
import CopyLinkButton from '../components/CopyLinkButton'
import PlaceCarousel from '../components/PlaceCarousel'
import { places } from '../data/places'
import { AnchorScrollMt } from '../lib/anchorOffset'
import { useHashDisclosure } from '../lib/useHashDisclosure'

const linkClass = 'underline hover:text-rosewood'

// The groupings the "Hyderabad at a glance" guide suggests, as a way in for
// anyone with one free morning rather than a whole week. Every slug here has to
// match a place below — Hyderabad.test.tsx checks that.
const dayPlans: { id: string; title: string; slugs: string[] }[] = [
  {
    id: 'a-heritage-morning',
    title: 'A heritage morning',
    slugs: ['charminar', 'chowmahalla-palace', 'laad-bazaar'],
  },
  {
    id: 'a-regal-afternoon',
    title: 'A regal afternoon',
    slugs: ['golconda-fort', 'qutb-shahi-tombs'],
  },
  {
    id: 'a-leisurely-evening',
    title: 'A leisurely evening',
    slugs: ['birla-mandir', 'hussain-sagar'],
  },
  {
    id: 'for-art-and-culture',
    title: 'For art & culture lovers',
    slugs: ['salar-jung-museum', 'charminar'],
  },
  {
    id: 'for-craft-and-keepsakes',
    title: 'For craft & keepsakes',
    slugs: ['laad-bazaar', 'shilparamam'],
  },
]

const Hyderabad: React.FC = () => {
  const scrollMt = React.useContext(AnchorScrollMt)
  const { hash } = useLocation()
  useHashDisclosure()

  // The food guide lived on this page once, and /travel/hyderabad#eat-like-a-local
  // is already out in the world. The pointer section it used to land on is gone,
  // so the old link now forwards to the page the guide moved to.
  if (hash === '#eat-like-a-local') {
    return <Navigate to="/travel/food" replace />
  }

  return (
    <div className="min-h-screen bg-peach/20">
      <header className="bg-peach/60 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-4xl text-rosewood sm:text-5xl">
            Things to do in Hyderabad
          </h1>
          <div className="mx-auto mt-4 max-w-xl text-left">
            <p className="font-body text-lg leading-relaxed text-zeus/80">
              Hyderabad is a vibrant blend of historic charm and modern energy — forts and palaces
              on one side of the city, bazaars and biryani on the other. If you have some free time
              around the celebrations, we’d highly recommend exploring a bit of it.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-12 font-body">
        {/* The guide sets this list inside an arch; so does this. */}
        <ArchFrame id="day-plans" className={`text-gold ${scrollMt}`}>
          <section className="group/copy -mt-6 space-y-4 text-center sm:-mt-28">
            <div className="flex items-center justify-center gap-2">
              <h2 className="font-display text-2xl text-rosewood">A few ways to spend a day</h2>
              <CopyLinkButton id="day-plans" label="A few ways to spend a day" />
            </div>
            <p className="text-sm text-zeus/70">
              Places that sit near each other, so you’re not crossing the city twice.
            </p>
            {/* w-fit so the columns hug their entries and the pair sits centred
                under the arch, rather than stretching to the frame with a
                canyon of empty space down the middle. */}
            <ul className="mx-auto grid w-fit gap-x-14 gap-y-5 pt-2 text-left sm:grid-cols-2">
              {dayPlans.map((plan) => (
                <li key={plan.id}>
                  <h3 className="font-display text-lg text-rosewood">{plan.title}</h3>
                  <ul className="mt-1 space-y-1 text-sm text-zeus/80">
                    {plan.slugs.map((slug) => (
                      <li key={slug} className="flex items-baseline gap-2">
                        <span aria-hidden className="text-[0.5rem] text-gold">
                          ◆
                        </span>
                        <a href={`#${slug}`} className={linkClass}>
                          {places.find((place) => place.slug === slug)!.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        </ArchFrame>

        <PlaceCarousel places={places} />

        <p className="text-xs text-zeus/60">
          Opening hours and ticketing change, so check before you set out — and see{' '}
          <Link to="/travel/tips#getting-around" className={linkClass}>
            getting around
          </Link>{' '}
          for how to reach any of these.
        </p>
      </div>
    </div>
  )
}

export default Hyderabad
