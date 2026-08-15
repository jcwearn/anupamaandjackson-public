import React from 'react'
import clsx from 'clsx'
import { AnchorScrollMt } from '../lib/anchorOffset'
import { MandalaDivider } from './OrnamentalFrame'
import PhotoLightbox from './PhotoLightbox'
import {
  STORY_LEDE,
  STORY_TRAVEL_HEADING,
  storyAccounts,
  storyClosingPhoto,
  storyTravelPhotos,
  type StoryPhoto,
} from '../data/story'

const tabClass = (active: boolean) =>
  clsx(
    'whitespace-nowrap rounded-full px-5 py-2 font-body text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 sm:text-base',
    // Not StickyChipBar's chipClass: that one is sized for a dense bar of jump
    // links, and its opaque idle fill fights the track this sits in.
    active ? 'bg-rosewood text-cream shadow-sm' : 'text-zeus/70 hover:bg-lily/40',
  )

// The gold-ruled mat the place and hotel photos already sit in.
const MAT = 'rounded-lg bg-white/70 p-1.5 ring-1 ring-gold/60'

// A two-line drop cap on the opening paragraph. 60px of Playfair puts ~42px of
// ink between the first line's cap height and the second line's baseline, which
// is the height a two-line cap wants. The side margins are equal because
// Playfair's bearings are small: with the whole gutter on the right the letter
// hugs the left edge of the box it carves out, and detaches from its own word.
// They sum to the gutter the cap had before, so the text beside it is unmoved.
const DROP_CAP =
  'first-letter:float-left first-letter:ml-[5px] first-letter:mr-[5px] first-letter:font-display first-letter:text-6xl first-letter:leading-[0.85] first-letter:text-rosewood'

// How far to drop the cap so its top lands on the first line's ascenders.
// Keyed on the letter because Playfair draws its round caps about 3px taller
// above the baseline than its flat-topped ones at this size — one shared value
// leaves whichever letter it wasn't tuned for visibly off. Both numbers are
// read off rendered pixels; canvas font metrics disagree with what Chrome
// actually paints here by ~5px, so they can't be derived.
const CAP_TOP_NUDGE: Record<string, string> = {
  I: 'first-letter:mt-[1px]',
  O: 'first-letter:mt-[4px]',
}
const capTopNudge = (text: string) => CAP_TOP_NUDGE[text[0]] ?? 'first-letter:mt-[1px]'

const Figure: React.FC<{
  photo: StoryPhoto
  className?: string
  imgClassName?: string
  onZoom: (photo: StoryPhoto, trigger: HTMLButtonElement) => void
}> = ({ photo, className, imgClassName, onZoom }) => (
  <figure className={className}>
    {/* Every photo here is cropped by its container, so the whole frame is only
        ever visible in the lightbox. A button rather than a click handler on the
        image, so it is reachable and announced like the control it is. */}
    <button
      type="button"
      onClick={(e) => onZoom(photo, e.currentTarget)}
      aria-label={`View full size: ${photo.caption ?? photo.alt}`}
      className={clsx(
        MAT,
        'block w-full cursor-zoom-in transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2',
      )}
    >
      {/* WebP is about a third the weight; the JPEG is there for anything that
          can't take it. Same <picture> shape the invite cards already use. */}
      <picture>
        <source type="image/webp" srcSet={photo.webp} />
        <img
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          loading="lazy"
          decoding="async"
          className={clsx('w-full rounded object-cover', imgClassName)}
        />
      </picture>
    </button>
    {photo.caption && (
      // Sentence case, not the site's usual letterspaced eyebrow: these run from
      // "Norway" to a full sentence, and the long ones shout in uppercase.
      <figcaption className="mt-2 text-center font-body text-xs italic leading-snug text-soyabean">
        {photo.caption}
      </figcaption>
    )}
  </figure>
)

const StorySection: React.FC = () => {
  const scrollMt = React.useContext(AnchorScrollMt)
  const [activeId, setActiveId] = React.useState(storyAccounts[0].id)
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const [zoomed, setZoomed] = React.useState<StoryPhoto | null>(null)
  const zoomTriggerRef = React.useRef<HTMLButtonElement | null>(null)

  const openZoom = (photo: StoryPhoto, trigger: HTMLButtonElement) => {
    zoomTriggerRef.current = trigger
    setZoomed(photo)
  }

  // Send focus back to the thumbnail that opened it, or closing the lightbox
  // drops the reader at the top of the document.
  const closeZoom = React.useCallback(() => {
    setZoomed(null)
    zoomTriggerRef.current?.focus()
  }, [])

  const activeIndex = storyAccounts.findIndex((a) => a.id === activeId)

  const move = (delta: number) => {
    const next = storyAccounts[(activeIndex + delta + storyAccounts.length) % storyAccounts.length]
    setActiveId(next.id)
    tabRefs.current[next.id]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const jump: Record<string, () => void> = {
      ArrowRight: () => move(1),
      ArrowLeft: () => move(-1),
      Home: () => setActiveId(storyAccounts[0].id),
      End: () => setActiveId(storyAccounts[storyAccounts.length - 1].id),
    }
    const handler = jump[event.key]
    if (!handler) return
    event.preventDefault()
    handler()
  }

  return (
    <section id="our-story" className={scrollMt}>
      <header className="text-center">
        <p className="font-body text-xs uppercase tracking-[0.25em] text-zeus/60">
          How we got here
        </p>
        <h2 className="mt-3 font-display text-3xl text-rosewood sm:text-4xl">Our Story</h2>
        <MandalaDivider className="mx-auto mt-5 text-gold" />
        <p className="mx-auto mt-4 max-w-md font-body text-lg text-zeus/70">{STORY_LEDE}</p>
      </header>

      <div className="mt-8 flex justify-center">
        <div
          role="tablist"
          aria-label="Whose telling of the story to read"
          onKeyDown={onKeyDown}
          className="inline-flex gap-1 rounded-full bg-white/70 p-1 ring-1 ring-gold/50"
        >
          {storyAccounts.map((account) => {
            const active = account.id === activeId
            return (
              <button
                key={account.id}
                ref={(el) => {
                  tabRefs.current[account.id] = el
                }}
                type="button"
                role="tab"
                id={`story-tab-${account.id}`}
                aria-selected={active}
                aria-controls={`story-panel-${account.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setActiveId(account.id)}
                className={tabClass(active)}
              >
                {account.tabLabel}
              </button>
            )
          })}
        </div>
      </div>

      {/* Both panels stay in the DOM — the page is prerendered, so hiding the
          inactive one with `hidden` keeps the whole story in the shipped HTML
          for search, link previews, and anyone who arrives before hydration. */}
      {storyAccounts.map((account) => {
        const active = account.id === activeId
        return (
          <div
            key={account.id}
            role="tabpanel"
            id={`story-panel-${account.id}`}
            aria-labelledby={`story-tab-${account.id}`}
            hidden={!active}
            className={active ? 'animate-story-fade' : undefined}
          >
            <p className="mt-10 text-center font-body text-xs uppercase tracking-[0.2em] text-soyabean">
              {account.eyebrow}
            </p>
            <div className="mx-auto mt-6 max-w-2xl space-y-5 font-body text-lg leading-relaxed text-zeus/80">
              <Figure
                photo={account.photo}
                className="mx-auto mb-6 max-w-[15rem] sm:float-right sm:mb-3 sm:ml-8 sm:w-56 sm:max-w-none"
                imgClassName="aspect-[4/5]"
                onZoom={openZoom}
              />
              {account.paragraphs.map((text, i) => (
                <p
                  key={text.slice(0, 24)}
                  // The letter is the hook Gecko's correction in globals.css needs.
                  data-drop-cap={i === 0 ? text[0] : undefined}
                  className={clsx(i === 0 && [DROP_CAP, capTopNudge(text)])}
                >
                  {text}
                </p>
              ))}
            </div>
          </div>
        )
      })}

      {/* Where both accounts land: "traveled all over the world together". The
          candids are grouped into one matched row rather than mixed in beside
          the portraits, so the phone-snapshot quality reads as deliberate. */}
      <div className="clear-both mx-auto mt-14 max-w-2xl">
        <p className="text-center font-body text-xs uppercase tracking-[0.2em] text-soyabean">
          {STORY_TRAVEL_HEADING}
        </p>
        {/* Two across at every width. Four made each photo small enough that the
            faces stopped reading, which is most of why they're here. */}
        <div className="mt-5 grid grid-cols-2 gap-4 sm:gap-6">
          {storyTravelPhotos.map((photo) => (
            <Figure key={photo.src} photo={photo} imgClassName="aspect-square" onZoom={openZoom} />
          ))}
        </div>
      </div>

      <Figure
        photo={storyClosingPhoto}
        className="mx-auto mt-14 max-w-2xl"
        imgClassName="aspect-[3/2]"
        onZoom={openZoom}
      />

      <PhotoLightbox photo={zoomed} onClose={closeZoom} />
    </section>
  )
}

export default StorySection
