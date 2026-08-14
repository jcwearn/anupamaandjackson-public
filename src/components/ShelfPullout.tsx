import React from 'react'
import clsx from 'clsx'
import type { ShelfItem } from '../data/shelf'
import {
  prefersReducedMotion,
  PrismFaces,
  CASE_DEPTH_PX,
  CASE_HEIGHT_PX,
  CASE_WIDTH_PX,
} from './Shelf3D'

/** One turn of the pull-out, matching FLIP_MS so the site's cards agree on pace. */
export const PULL_MS = 700

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

/**
 * The pulled-out book or case: a FLIP-style fixed overlay.
 *
 * The shelf rows scroll sideways, so animating the item in place would clip at
 * the scroller's edge. Instead the shelf hides the original and this overlay
 * draws a copy at the captured shelf rect, then lets one transform transition
 * carry it to centre screen, travelling and growing in the same movement — the
 * shelf shows every cover face out, so there is nothing to turn.
 *
 * With no `fromRect` (hash deep links) or under reduced motion there is nothing
 * to travel from or no appetite for travel, so it simply appears centred.
 */
const ShelfPullout: React.FC<{
  item: ShelfItem
  /**
   * The shelf button's untransformed layout rect; null when opened from a
   * hash deep link. Layout, not the projected AABB: the transformed bounds
   * are taller (top-face overhang) and off-centre (side-face bulge), and a
   * copy scaled or anchored on them lands visibly off the shelf box.
   */
  fromRect: DOMRect | null
  /** The display angle the shelf box rests at, so the copy departs turned
   * exactly the way it sat — each shelf position rests differently. */
  fromDeg?: number
  /** Called once the close animation has finished and the overlay can unmount. */
  onClose: () => void
}> = ({ item, fromRect, fromDeg, onClose }) => {
  const animate = fromRect !== null && !prefersReducedMotion()
  const [open, setOpen] = React.useState(!animate)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const closeTimer = React.useRef<number | null>(null)
  const titleId = React.useId()

  // Arrive in the shelf slot, then open on the next frame so the transition has
  // a rendered starting state to leave from. Double rAF: one frame is not
  // always enough for the initial transform to have been painted.
  React.useEffect(() => {
    if (!animate) return
    let raf1 = 0
    let raf2 = 0
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setOpen(true))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [animate])

  const requestClose = React.useCallback(() => {
    if (closeTimer.current !== null) return
    if (!animate) {
      onClose()
      return
    }
    setOpen(false)
    closeTimer.current = window.setTimeout(onClose, PULL_MS)
  }, [animate, onClose])

  // Escape, scroll lock, and focus hand-off. The lock pins the body in place
  // rather than setting overflow:hidden — iOS ignores the overflow trick and
  // keeps scrolling the page under the overlay, drifting the backdrop off the
  // visual viewport. Fixing the body at -scrollY freezes the page exactly
  // where it was; close puts the scroll position back. The caller returns
  // focus to the shelf button that opened this.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)

    const scrollY = window.scrollY
    const { style } = document.body
    const prev = {
      position: style.position,
      top: style.top,
      left: style.left,
      right: style.right,
      overflow: style.overflow,
    }
    style.position = 'fixed'
    style.top = `-${scrollY}px`
    style.left = '0'
    style.right = '0'
    style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0)

    return () => {
      window.removeEventListener('keydown', onKey)
      style.position = prev.position
      style.top = prev.top
      style.left = prev.left
      style.right = prev.right
      style.overflow = prev.overflow
      // 'instant', not the default: globals.css sets scroll-behavior smooth,
      // and un-pinning leaves the page at the top for a beat — a smooth
      // restore visibly glides back down from there instead of never moving.
      window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' })
      window.clearTimeout(focusTimer)
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [requestClose])

  // Never reached in practice — the page only mounts this after a client-side
  // selection — but the geometry below reads the window, so keep it honest.
  if (typeof window === 'undefined') return null

  // Biased upward so the detail card fits below the cover on most screens.
  const coverH = Math.min(Math.round(window.innerHeight * 0.42), 420)
  // A book's board is cut to its cover, but a film sits in a uniform case with
  // the poster cropped into it. Take the width from the face the shelf box
  // actually shows: one uniform scale can only land back on the shelf rect if
  // the copy carries the shelf box's proportions, and a poster-shaped copy of a
  // 2:3 case starts up to 6% too wide — the width snapped on the first frame.
  const coverW = Math.round(
    item.spine
      ? (coverH * item.cover.width) / item.cover.height
      : (coverH * CASE_WIDTH_PX) / CASE_HEIGHT_PX
  )
  // The whole prism travels, so its thickness scales with it.
  const depth = Math.round(
    item.spine
      ? (item.spine.widthPx * coverH) / item.spine.heightPx
      : (CASE_DEPTH_PX * coverH) / CASE_HEIGHT_PX
  )
  const centerX = Math.round(window.innerWidth / 2)
  const coverTop = Math.max(Math.round(window.innerHeight * 0.06), 16)

  // The copy departs turned the way it sat on the shelf and settles at a
  // gentler display angle — still turned enough that it stays a solid object
  // rather than flattening into an image.
  //
  // Matching the shelf's camera is what keeps the first frame seamless: the
  // shelf box projects through its own perspective() at its own centre, so
  // the copy must too — same function order (so the transition interpolates
  // each in place), origin at centre, positioned on the shelf box's visual
  // centre. The camera stays at 900px in both states: the scale sits before
  // perspective() in the list, so the camera always views full-size geometry.
  // scale3d, never scale(): the 2D function leaves the z axis alone, so the
  // faces' translateZ offsets kept their full-size depth inside a shrunken
  // box — twice the thickness under the same camera, and the page block
  // visibly ballooned the moment the animated copy swapped in.
  const scale = fromRect ? fromRect.height / coverH : 1
  const openTransform = `translate3d(${centerX - Math.round(coverW / 2)}px, ${coverTop}px, 0px) perspective(900px) rotateX(-4deg) rotateY(-16deg) scale3d(1, 1, 1)`
  const closedTransform = fromRect
    ? `translate3d(${Math.round(fromRect.left + fromRect.width / 2 - coverW / 2)}px, ${Math.round(
        fromRect.top + fromRect.height / 2 - coverH / 2
      )}px, 0px) perspective(900px) rotateX(-5deg) rotateY(${fromDeg ?? -20}deg) scale3d(${scale}, ${scale}, ${scale})`
    : openTransform

  const cardTop = coverTop + coverH + 20

  return (
    <div className="fixed inset-0 z-60">
      <div
        onClick={requestClose}
        aria-hidden="true"
        className={clsx(
          'absolute inset-0 bg-zeus/70 backdrop-blur-sm',
          animate && 'transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0'
        )}
      />

      <div role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {/* Pinned to the overlay's corner rather than the card's: the card sits
            below a cover that fills the top of the screen, so a close control
            inside it would be a scroll away on a short viewport. */}
        <button
          ref={closeRef}
          type="button"
          onClick={requestClose}
          aria-label="Close"
          className={clsx(
            'absolute top-4 right-4 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-cream/90 text-zeus transition-colors hover:bg-cream focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2',
            animate && 'transition-opacity duration-300',
            open ? 'opacity-100' : 'opacity-0'
          )}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="h-4 w-4">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>

        {/* The travelling book. Pointer events stay off so the backdrop behind
            it keeps taking the dismissing click. */}
        {/* No wrapper perspective: the travelling box carries its own camera
            in its transform, matching the shelf boxes. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: coverW,
              height: coverH,
              transformStyle: 'preserve-3d',
              transform: open ? openTransform : closedTransform,
              transition: animate ? `transform ${PULL_MS}ms ${EASE}` : 'none',
            }}
          >
            <PrismFaces item={item} depth={depth} hero />
          </div>
        </div>

        {/* The details, arriving once the pull is mostly done. */}
        <div
          className={clsx(
            'absolute left-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto',
            animate && 'transition-opacity duration-300',
            open ? 'opacity-100' : 'opacity-0',
            animate && open && 'delay-300'
          )}
          style={{ top: cardTop, maxHeight: `calc(100vh - ${cardTop + 16}px)` }}
        >
          <div className="card text-left">
            <h2 id={titleId} className="font-display text-2xl">
              {item.title}
            </h2>
            <p className="mt-1 font-body text-sm text-zeus/70">
              {item.creator} · {item.year}
              {item.pages ? ` · ${item.pages.toLocaleString()} pages` : ''}
            </p>
            <p className="mt-2">
              <span className="inline-block rounded-full bg-lily/30 px-3 py-0.5 font-body text-xs font-medium text-buccaneer">
                {item.genre}
              </span>
            </p>
            <p className="mt-3 font-body text-base leading-relaxed text-zeus/80">{item.teaser}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {item.externalUrl && (
                <a href={item.externalUrl} target="_blank" rel="noreferrer" className="btn-primary">
                  Watch on YouTube
                </a>
              )}
              {item.libraryUrl && (
                <a href={item.libraryUrl} target="_blank" rel="noreferrer" className="btn-primary">
                  {item.kind === 'book' ? 'View on Goodreads' : 'View on Letterboxd'}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ShelfPullout
