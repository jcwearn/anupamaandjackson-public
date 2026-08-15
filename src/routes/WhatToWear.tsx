import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import GuestDressCodes from '../components/GuestDressCodes'
import WhereToShop from '../components/WhereToShop'
import JumpNav, {
  JUMP_NAV_INNER_SCROLL_MT,
  JUMP_NAV_SCROLL_MT,
  type JumpTarget,
} from '../components/JumpNav'
import PhotoFrame from '../components/PhotoFrame'
import StickySectionHeading from '../components/StickySectionHeading'
import CopyLinkButton from '../components/CopyLinkButton'
import { mensOutfits, womensOutfits, type Outfit } from '../data/attire'
import { useGuestScheduleContext } from '../lib/guestScheduleContext'

const linkClass = 'underline hover:text-rosewood'

/**
 * The events a card may name, titled — empty until a guest identifies themselves.
 *
 * Built from the reader's own decrypted events rather than from any list in
 * `src/`, so a card can only ever name an event they're admitted to. It stays
 * empty while anonymous rather than falling back to `universalEvents`: this
 * page names no event at all before a name is entered, which is also what the
 * dress-code section above the galleries does.
 *
 * Titles are shortened here: the schedule needs "Wedding Ceremony & Muhurtham"
 * to be unambiguous on its own, but as a chip under a photograph the long form
 * wraps to three lines and says nothing the short one doesn't.
 */
const SHORT_TITLES: Record<string, string> = {
  muhurtham: 'Muhurtham',
  'welcome-edurukolu': 'Edurukolu',
  pellikuthuru: 'Pellikuthuru',
  reception: 'Reception',
}

/**
 * Lands a deep link on the event it names — /what-to-wear#muhurtham, from the
 * What to Wear Guide button on that event's schedule card.
 *
 * The browser's own fragment scroll and ScrollToTop both run on navigation,
 * when the dress-code list is still a gate prompt: its events arrive later,
 * once the guest's schedule has been fetched and decrypted. So the scroll waits
 * for the target to exist, and then only fires once — a reader who has since
 * scrolled somewhere else should not be yanked back by a re-render.
 */
function useScrollToEventAnchor() {
  const { hash } = useLocation()
  const { status, events } = useGuestScheduleContext()
  const landed = React.useRef<string | null>(null)

  React.useEffect(() => {
    const id = decodeURIComponent(hash.replace(/^#/, ''))
    if (!id || landed.current === id) return

    const target = document.getElementById(id)
    if (!target) return

    landed.current = id
    // globals.css sets scroll-behavior: smooth; arriving on a deep link should
    // land already there rather than animate from the top of the page.
    requestAnimationFrame(() => target.scrollIntoView({ behavior: 'instant', block: 'start' }))
  }, [hash, status, events])
}

function useEventLabels(): Map<string, string> {
  const { status, events } = useGuestScheduleContext()
  const identified = status === 'identified'

  return React.useMemo(
    () =>
      identified
        ? new Map(events.map((event) => [event.id, SHORT_TITLES[event.id] ?? event.title]))
        : new Map(),
    [identified, events],
  )
}

// Short enough that four chips clear a 390px phone. StickyChipBar scrolls
// horizontally if they ever don't, but a bar you have to scroll hides half its
// own contents.
const jumpTargets: JumpTarget[] = [
  { id: 'your-events', label: 'Your Events' },
  { id: 'womens', label: 'Women’s' },
  { id: 'mens', label: 'Men’s' },
  { id: 'where-to-shop', label: 'Shopping' },
]

// One garment. Outfits with several photos take the full grid width and rack
// them in a row — they're one thing shown a few ways, and splitting them across
// cards would read as three different outfits with the same name.
const OutfitCard: React.FC<{ outfit: Outfit; labels: Map<string, string> }> = ({
  outfit,
  labels,
}) => {
  const wide = outfit.photos.length > 1
  // Order comes from the outfit, which lists its events chronologically, so the
  // chips read in the order of the week rather than of the guest's tags.
  const worn = outfit.events.filter((id) => labels.has(id))

  return (
    <li
      id={outfit.slug}
      className={`group/copy card flex h-full flex-col ${wide ? 'col-span-2' : ''} ${JUMP_NAV_SCROLL_MT}`}
    >
      <div className={`mb-3 flex gap-2 sm:gap-3 ${wide ? '' : 'flex-col'}`}>
        {outfit.photos.map((photo) => (
          // min-w-0 so three photos share the row evenly instead of each
          // insisting on its intrinsic width and overflowing the card.
          <PhotoFrame
            key={photo.src}
            photo={photo}
            aspect="aspect-[2/3]"
            className={wide ? 'min-w-0 flex-1' : ''}
          />
        ))}
      </div>

      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg text-rosewood">{outfit.name}</h3>
        <CopyLinkButton id={outfit.slug} label={outfit.name} />
      </div>

      {outfit.note && <p className="mt-2 text-sm leading-relaxed text-zeus/80">{outfit.note}</p>}

      {/* mt-auto so the chips sit on the floor of the card: the notes run to
          different lengths, and without it they stagger across the row. */}
      {worn.length > 0 && (
        <div className="mt-auto pt-3">
          <p className="sr-only">Suits these events:</p>
          <ul className="flex flex-wrap gap-1.5">
            {worn.map((id) => (
              <li
                key={id}
                className="rounded-full bg-lily/25 px-2.5 py-0.5 text-xs font-medium text-rosewood"
              >
                {labels.get(id)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

const OutfitGrid: React.FC<{ outfits: Outfit[] }> = ({ outfits }) => {
  const labels = useEventLabels()

  return (
    <ul className="mx-auto mt-6 grid w-full max-w-2xl grid-cols-2 items-stretch gap-4 px-4 sm:gap-6">
      {outfits.map((outfit) => (
        <OutfitCard key={outfit.slug} outfit={outfit} labels={labels} />
      ))}
    </ul>
  )
}

const WhatToWear: React.FC = () => {
  useScrollToEventAnchor()

  return (
    <div className="min-h-screen bg-peach/20">
      <JumpNav targets={jumpTargets}>
        <header className="bg-peach/60 px-4 py-16 text-center">
          <div className="mx-auto max-w-2xl">
            <h1 className="font-display text-4xl text-rosewood sm:text-5xl">What to Wear</h1>
            <div className="mx-auto mt-4 max-w-xl text-left">
              <p className="font-body text-lg leading-relaxed text-zeus/80">
                We want you to come wearing whatever you’re most comfortable in! Indian clothing is
                warmly welcome on all of our guests — and if you’d like to wear it but aren’t sure
                where to start, that’s what this page is for.
              </p>
              <p className="mt-6 font-body text-lg leading-relaxed text-zeus/80">
                It’s a guide to cuts and names more than to how formal anything is, but there are
                notes for each of your events below.
              </p>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-12 py-12 font-body">
          <section id="your-events" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading
              eyebrow="Dress code by event"
              title="Your Events"
              anchorId="your-events"
            />
            <div className="mx-auto mt-6 w-full max-w-2xl px-4 text-zeus/80">
              <GuestDressCodes anchorScrollMt={JUMP_NAV_INNER_SCROLL_MT} />
            </div>
          </section>

          <section id="womens" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading eyebrow="Seven to know" title="Women’s Wear" anchorId="womens" />
            <OutfitGrid outfits={womensOutfits} />
          </section>

          <section id="mens" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading eyebrow="Five to know" title="Men’s Wear" anchorId="mens" />
            <OutfitGrid outfits={mensOutfits} />
          </section>

          <section id="where-to-shop" className={JUMP_NAV_SCROLL_MT}>
            <StickySectionHeading
              eyebrow="In person and online"
              title="Where to Shop"
              anchorId="where-to-shop"
            />
            <div className="mx-auto mt-6 w-full max-w-2xl px-4 text-sm leading-relaxed text-zeus/80">
              <WhereToShop />
              <p className="mt-6">
                Whatever you land on, reach for rich, saturated colors — reds, blues, greens, deep
                purples, pinks — and gold jewelry is very much in the spirit of the occasion. Our{' '}
                <Link to="/faq#shoes" className={linkClass}>
                  FAQ
                </Link>{' '}
                has a word about shoes, and{' '}
                <Link to="/travel/tips#outfits" className={linkClass}>
                  Travel Tips
                </Link>{' '}
                covers what to pack for the rest of the week.
              </p>
            </div>
          </section>
        </div>
      </JumpNav>
    </div>
  )
}

export default WhatToWear
