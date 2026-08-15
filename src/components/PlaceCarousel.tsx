import React from 'react'
import clsx from 'clsx'
import type { Place } from '../data/places'
import { ChevronDownIcon } from '../icons/ChevronDownIcon'
import { FLIP_MS, useCardFlip } from '../lib/useCardFlip'
import PlaceCard from './PlaceCard'

const SWIPE_THRESHOLD_PX = 48

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

const slugIndex = (places: Place[], hash: string) =>
  places.findIndex((place) => place.slug === decodeURIComponent(hash.replace(/^#/, '')))

const ArrowButton: React.FC<{
  direction: 'prev' | 'next'
  label: string
  onClick: () => void
}> = ({ direction, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className={clsx(
      'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-gold/60 bg-cream text-rosewood shadow-sm transition-colors',
      'hover:bg-rosewood hover:text-cream focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2',
      // The card is as wide as the sections above and below it, so there is no
      // room beside it until the viewport outgrows the content column. Below
      // lg these stay in the control row, either side of the dots; at lg they
      // step out of the flow to stand beside the card.
      //
      // They centre on the carousel as a whole rather than on the deck, so the
      // -mt lifts them by roughly half the control row they left behind.
      'shrink-0',
      'lg:absolute lg:top-1/2 lg:z-10 lg:-mt-8 lg:-translate-y-1/2',
      direction === 'prev' ? 'lg:left-0 lg:-ml-16' : 'lg:right-0 lg:-mr-16',
    )}
  >
    {/* The nudge lives on a wrapper, not on the chevron: Tailwind's rotate-* is
        the standalone `rotate` property, which applies after `translate`, so
        animating the rotated element drifts it along the pre-rotation axis —
        left/right motion coming out vertical. */}
    <span className={direction === 'prev' ? 'arrow-nudge-back' : 'arrow-nudge'}>
      <ChevronDownIcon
        className={clsx('h-5 w-5', direction === 'prev' ? 'rotate-90' : '-rotate-90')}
      />
    </span>
  </button>
)

// backface-visibility alone isn't dependable once a descendant makes its own
// rendering context — the turned-away card was showing through, mirrored. While
// nothing is actually turning there's no reason to keep it around at all.
const Face: React.FC<{
  facing: boolean
  flipping: boolean
  back?: boolean
  children: React.ReactNode
}> = ({ facing, flipping, back, children }) => (
  <div
    // inset-0, not top-0: at their natural heights the two faces end at
    // different places, and mid-turn you see both bottom edges. Filling the
    // cell makes every card the height of the tallest.
    className="absolute inset-0"
    aria-hidden={!facing}
    style={{
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
      transform: back ? 'rotateY(180deg)' : undefined,
      visibility: facing || flipping ? 'visible' : 'hidden',
    }}
  >
    {children}
  </div>
)

/**
 * The nine places, one at a time, turning like the invitation cards.
 *
 * The URL fragment is the source of truth for which one is showing, so
 * /travel/hyderabad#golconda-fort opens on Golconda and every existing deep
 * link keeps working. Flipping writes the fragment back with `replaceState`
 * rather than react-router's `navigate`: replaceState fires no `hashchange` and
 * doesn't touch the router's location, so the page's `useHashDisclosure` won't
 * re-scroll on every turn. Inbound clicks on `<a href="#slug">` still fire
 * `hashchange`, which is listened for below.
 */
const PlaceCarousel: React.FC<{ places: Place[] }> = ({ places }) => {
  const { index, rotation, faceAIndex, faceBIndex, flipping, goTo, jumpTo } = useCardFlip(
    places.length,
  )
  const swipeStart = React.useRef<{ x: number; y: number } | null>(null)

  const select = React.useCallback(
    (next: number) => (prefersReducedMotion() ? jumpTo(next) : goTo(next)),
    [goTo, jumpTo],
  )

  // Land on whatever the fragment names, and follow it when it changes.
  React.useEffect(() => {
    const fromHash = () => {
      const found = slugIndex(places, window.location.hash)
      if (found >= 0) select(found)
    }
    // On mount the reader hasn't turned anything yet — arrive, don't animate.
    const initial = slugIndex(places, window.location.hash)
    if (initial >= 0) jumpTo(initial)

    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [places, select, jumpTo])

  // Write the fragment back without disturbing the router (see the note above).
  const firstRender = React.useRef(true)
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.history.replaceState(null, '', `#${places[index].slug}`)
  }, [index, places])

  // Only the neighbours are one turn away; the rest can wait.
  React.useEffect(() => {
    for (const neighbour of [places[index - 1], places[index + 1]]) {
      if (neighbour) new Image().src = neighbour.photo.src
    }
  }, [index, places])

  const showingA = ((rotation % 360) + 360) % 360 === 0
  const current = places[index]

  return (
    <div
      // relative so the arrows have something to stand beside at lg, once they
      // leave the control row.
      className="relative flex flex-col gap-5"
      role="group"
      aria-roledescription="carousel"
      aria-label="Places in Hyderabad"
      tabIndex={0}
      // On the container rather than the window: Invite.tsx listens globally
      // because it owns the whole screen, but here that would take the arrow
      // keys away from a reader scrolling the page.
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          select(index - 1)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          select(index + 1)
        }
      }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return
        swipeStart.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={(e) => {
        const start = swipeStart.current
        swipeStart.current = null
        if (!start) return
        const dx = e.clientX - start.x
        // Only a clearly horizontal drag counts, or scrolling the page turns cards.
        if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(e.clientY - start.y))
          return
        select(dx < 0 ? index + 1 : index - 1)
      }}
    >
      <div>
        {/* Every card in one grid cell, so the deck is as tall as its tallest
            card and stays that height — otherwise it grows and shrinks as you
            turn through, and the arrows ride up and down with it. The sizer
            copies are invisible and photoless; only the two faces are real. */}
        <div className="grid" style={{ perspective: '1800px' }}>
          {places.map((place) => (
            <div
              key={place.slug}
              aria-hidden
              inert
              className="pointer-events-none invisible [grid-area:1/1]"
            >
              <PlaceCard place={place} anchored={false} measuring />
            </div>
          ))}

          <div
            className="relative [grid-area:1/1]"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateY(${rotation}deg)`,
              transition: flipping ? `transform ${FLIP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)` : 'none',
            }}
          >
            <Face facing={showingA} flipping={flipping}>
              <PlaceCard place={places[faceAIndex]} anchored={showingA} />
            </Face>
            <Face facing={!showingA} flipping={flipping} back>
              <PlaceCard place={places[faceBIndex]} anchored={!showingA} />
            </Face>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        {/* One cluster: step either side, jump in the middle. At lg the arrows
            leave the row and stand beside the card instead — see ArrowButton. */}
        <div className="flex items-center justify-center gap-4">
          {index > 0 ? (
            <ArrowButton
              direction="prev"
              label="Previous place"
              onClick={() => select(index - 1)}
            />
          ) : (
            // An arrow that points nowhere is noise, but its absence must not
            // shunt the dots sideways.
            <span aria-hidden className="h-11 w-11 shrink-0 lg:hidden" />
          )}

          <ul className="flex flex-wrap items-center justify-center gap-2">
            {places.map((place, i) => (
              <li key={place.slug}>
                <button
                  type="button"
                  onClick={() => select(i)}
                  aria-label={place.name}
                  aria-current={i === index ? 'true' : undefined}
                  className={clsx(
                    'block h-2.5 w-2.5 cursor-pointer rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2',
                    i === index ? 'bg-rosewood' : 'bg-rosewood/25 hover:bg-rosewood/50',
                  )}
                />
              </li>
            ))}
          </ul>

          {index < places.length - 1 ? (
            <ArrowButton direction="next" label="Next place" onClick={() => select(index + 1)} />
          ) : (
            <span aria-hidden className="h-11 w-11 shrink-0 lg:hidden" />
          )}
        </div>

        {/* Without this the turn is silent to a screen reader. */}
        <p aria-live="polite" className="text-xs text-zeus/60">
          {current.name} — {index + 1} of {places.length}
        </p>
      </div>
    </div>
  )
}

export default PlaceCarousel
