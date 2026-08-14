import React from 'react'
import { Link } from 'react-router-dom'
import CopyLinkButton from '../components/CopyLinkButton'
import DietBadge from '../components/DietBadge'
import DishCard from '../components/DishCard'
import EatPlaceCard from '../components/EatPlaceCard'
import { MandalaDivider } from '../components/OrnamentalFrame'
import PhotoFrame from '../components/PhotoFrame'
import { dishGroups, eatPlaces, heroPhotos } from '../data/eats'
import { AnchorScrollMt } from '../lib/anchorOffset'
import { useHashDisclosure } from '../lib/useHashDisclosure'

const linkClass = 'underline hover:text-rosewood'

// The ruled heading the Things to Do page uses for its sections, lifted here
// because this page has four of them rather than one.
const SectionHeading: React.FC<{ id: string; title: string; blurb?: string }> = ({
  id,
  title,
  blurb,
}) => {
  const scrollMt = React.useContext(AnchorScrollMt)

  return (
    <div id={id} className={scrollMt}>
      <div className="group/copy flex items-center justify-between gap-4 border-b border-gold/40 pb-3">
        <h2 className="font-display text-2xl text-rosewood">{title}</h2>
        <CopyLinkButton id={id} label={title} />
      </div>
      {blurb && <p className="mt-3 text-sm text-zeus/70">{blurb}</p>}
    </div>
  )
}

// How each section racks its cards. The default is the two-up stack; naming a
// dish here pulls it across the full width — `banner` with the photo on top,
// `feature` with the photo beside the text. Keyed by slug so reordering the
// data can't silently hand the big treatment to the wrong dish.
const dishPresentation: Record<string, { layout: 'banner' | 'feature'; reverse?: boolean }> = {
  // The feast opens its section, and the everyday curry closes it, mirrored.
  'banti-bhojanam': { layout: 'feature' },
  'guthi-vankaya': { layout: 'feature', reverse: true },
  // The main event gets the widest photo on the page; the café ritual reads
  // best sideways, like the twenty minutes it's asking you to sit for.
  'hyderabadi-biryani': { layout: 'banner' },
  'irani-chai': { layout: 'feature', reverse: true },
}

// Sources that would lose their subject to the default 4:3 side crop —
// Nimrah's is a vertical shot of the Charminar, and Subbayya's and Almond
// House's are square.
const placePhotoAspects: Record<string, string> = {
  subbayya: 'aspect-[4/3] sm:aspect-square',
  'almond-house': 'aspect-[4/3] sm:aspect-square',
  'nimrah-cafe': 'aspect-[4/3] sm:aspect-[3/4]',
}

const Food: React.FC = () => {
  useHashDisclosure()

  return (
    <div className="min-h-screen bg-peach/20">
      <header className="bg-peach/60 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-4xl text-rosewood sm:text-5xl">What to Eat</h1>
          <div className="mx-auto mt-4 max-w-xl text-left">
            <p className="font-body text-lg leading-relaxed text-zeus/80">
              Half the reason to come. Here’s what we’d tell you to order in Hyderabad, what you’ll
              meet everywhere else in the South, and the handful of places we’d send you to for it.
              Both of the city’s kitchens cook rich — ghee, cream, long-simmered gravies — so order
              like a local on the first day and you’ll feel it on the second. Pace yourself; you have
              a week.
            </p>
          </div>
          {/* Three arches, one per table below, in the order the page walks
              them: the Telugu leaf, the Muslim pot, the tiffin plate. */}
          <div className="mx-auto mt-8 grid max-w-xl grid-cols-3 gap-2 sm:gap-4">
            {heroPhotos.map((photo) => (
              <PhotoFrame key={photo.src} photo={photo} aspect="aspect-[4/5]" shape="arch" eager />
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-12 font-body">
        <section className="flex flex-col gap-4">
          <SectionHeading id="vegetarian-and-vegan" title="Vegetarian & vegan" />
          {/* The same tinted callout the eVisa page uses for the things you have
              to read before you act on the rest of the page. Deliberately the
              one block above the fold with no photograph — it's a reading
              moment, and the restraint is what lets the pictures land. */}
          <div className="rounded-lg border border-gold/40 bg-lily/25 px-4 py-3">
            <div className="flex flex-col gap-3 text-sm leading-relaxed text-zeus/80">
              <p>
                Anupama is vegan, Jackson is vegetarian, and{' '}
                <Link to="/faq#food" className={linkClass}>
                  every meal across the wedding events
                </Link>{' '}
                is vegetarian too. So the non-veg dishes below are the city’s word rather than ours —
                the rest we can vouch for.
              </p>
              <p>
                If you eat the same way, you’ll have an easier time of it here than almost anywhere.
                Vegetarian food isn’t a substitution in India, and most restaurants run separate veg
                and non-veg menus. Vegans do have to ask harder — ghee and curd turn up unannounced
                in South Indian cooking, brushed over a dosa or stirred through rice — so name them
                rather than asking for “vegan”.
              </p>
              {/* The legend stays inside the callout, with the paragraph that
                  explains why the leaf exists — the glosses carry the rest, so
                  there's nothing to say above them. */}
              <ul className="flex flex-wrap gap-x-5 gap-y-2 border-t border-gold/40 pt-3">
                <li className="flex items-center gap-2">
                  <DietBadge diet="vegan" />
                  <span className="text-xs text-zeus/70">no dairy, or easy to ask for without</span>
                </li>
                <li className="flex items-center gap-2">
                  <DietBadge diet="veg" />
                  <span className="text-xs text-zeus/70">vegetarian, dairy included</span>
                </li>
                <li className="flex items-center gap-2">
                  <DietBadge diet="non-veg" />
                  <span className="text-xs text-zeus/70">meat or fish</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {dishGroups.map((group) => (
          <React.Fragment key={group.id}>
            {/* The page leaves Hyderabad here — the same break the place cards
                get, so both turns in the guide read the same way. */}
            {group.id === 'further-south' && <MandalaDivider className="mx-auto -my-4 text-gold" />}
            <section className="flex flex-col gap-4">
              <SectionHeading id={group.id} title={group.title} blurb={group.blurb} />
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.dishes.map((dish) => (
                  <DishCard
                    key={dish.slug}
                    dish={dish}
                    {...dishPresentation[dish.slug]}
                    // The southern classics wear the header's arches — their
                    // own postcard rack, rather than a third tray of tiles.
                    {...(group.id === 'further-south'
                      ? { photoAspect: 'aspect-[4/5]', photoShape: 'arch' as const }
                      : {})}
                  />
                ))}
              </ul>
            </section>
          </React.Fragment>
        ))}

        {/* The divider the place cards use, so the turn from dishes to addresses
            reads as a break in one guide rather than the start of another. */}
        <MandalaDivider className="mx-auto -my-4 text-gold" />

        <section className="flex flex-col gap-4">
          <SectionHeading
            id="where-to-go"
            title="Where to go"
            blurb="Places we’d actually point you to, whether you have an evening or ten minutes on the way back to your hotel."
          />
          <ul className="flex flex-col gap-4">
            {eatPlaces.map((place, i) => (
              <EatPlaceCard
                key={place.slug}
                place={place}
                reverse={i % 2 === 1}
                photoAspect={placePhotoAspects[place.slug]}
              />
            ))}
          </ul>
        </section>

        <p className="text-xs text-zeus/60">
          Opening hours change and the good places move, so check before you set out. Bottled water,
          street food and spice are covered in{' '}
          <Link to="/travel/tips#eating-and-drinking" className={linkClass}>
            eating &amp; drinking
          </Link>
          , and{' '}
          <Link to="/travel/hyderabad" className={linkClass}>
            things to do
          </Link>{' '}
          has the sights to build a day around.
        </p>
      </div>
    </div>
  )
}

export default Food
