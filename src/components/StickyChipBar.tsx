import React from 'react'
import clsx from 'clsx'
// This bar's own h-12. Named for JumpNav because that's where it started; it is
// the height of every bar rendered here, and JumpNav's offset math reads the
// same value.
import { JUMP_NAV_HEIGHT_PX, SITE_NAV_OFFSET } from '../lib/constants'

/**
 * The bar of chips that pins directly under SiteNav, shared by the two things
 * that use one: JumpNav (sections within a page) and SectionNav (pages within a
 * section). Only the chips differ — anchors in one, routes in the other — so
 * this owns the chrome and the hide-on-scroll behaviour, and takes them as
 * children.
 *
 * Callers render it as the first thing on the page, above the page header, so
 * it is at its sticky position from the very top and never rides over the
 * header's own text on its way there.
 */
const StickyChipBar: React.FC<{
  label: string
  hidden: boolean
  children: React.ReactNode
}> = ({ label, hidden, children }) => (
  <nav
    aria-label={label}
    // Opaque, but mixed to the colour the page headers render as (peach/60 over
    // the page's peach/20), so the bar reads as part of the header at the top of
    // the page without letting content scroll through it further down.
    //
    // Hiding slides it up behind SiteNav, which is z-50 to this z-20.
    // overflow-y-hidden because a container that scrolls on one axis computes
    // the other to `auto` too, and a vertical scrollbar inside 48px is worse
    // than the clipping it would be there to solve.
    className={clsx(
      'sticky z-20 flex h-12 items-center overflow-x-auto overflow-y-hidden border-b border-gold/30 bg-[#ffd7e4] px-2 transition-transform duration-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      hidden && '-translate-y-full',
    )}
    style={{ top: SITE_NAV_OFFSET }}
    // Out of the tab order while off screen, so it can't be focused invisibly.
    inert={hidden || undefined}
  >
    {/* mx-auto on an inner row rather than justify-center on the scroller: the
        four Travel chips are 49px wider than a 320px screen, and a centred
        scroll container puts the overflow half off each end with the leading
        chip unreachable. This centres while the row fits and pins it to the
        start once it doesn't. */}
    <div className="mx-auto flex items-center gap-1.5">{children}</div>
  </nav>
)

export const chipClass = (active: boolean) =>
  clsx(
    'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 sm:text-sm',
    active ? 'bg-rosewood text-cream' : 'bg-lily/60 text-zeus hover:bg-lily',
  )

// How long after a jump a scroll is still that jump arriving rather than the
// reader setting off. Generous: nobody reads and scrolls away inside it, and
// coming back a frame late is a flicker where staying away is a missing bar.
const SETTLE_MS = 400

/**
 * The bar is worth its 48px when you want to move around, and not while you're
 * reading — so it goes on the way down and comes back the moment you head up.
 * The threshold keeps a trackpad's jitter from flickering it.
 *
 * rAF-throttled like useScrolled.ts, and every measurement happens inside the
 * effect so nothing touches layout during render.
 *
 * Two things come back out with `hidden`:
 * - `setHidden`, because JumpNav has to bring the bar in before it jumps: the
 *   sections' scroll-mt clears it, so a jump made while it's away lands short.
 * - `settle`, to say "the scroll about to happen is not the reader". A deep
 *   link's own landing scroll is a long one downwards, and without this the bar
 *   leaves at the exact moment someone arrives — which is when they most need
 *   to see where they are. The window opens at mount for the pages that scroll
 *   to a hash themselves, and JumpNav reopens it around its own late jump,
 *   which waits for `load` and so can land well after that.
 */
export function useHiddenOnScrollDown() {
  const [hidden, setHidden] = React.useState(false)
  const settledAt = React.useRef(0)

  const settle = React.useCallback(() => {
    settledAt.current = performance.now() + SETTLE_MS
  }, [])

  React.useEffect(() => {
    settle()

    let frame = 0
    let lastY = window.scrollY

    const check = () => {
      frame = 0
      const y = window.scrollY
      const moved = y - lastY
      if (Math.abs(moved) < 8) return
      // Still track where we are, so the first real scroll after a jump is
      // measured from where the jump left off rather than from the top.
      lastY = y
      if (performance.now() < settledAt.current) return
      // Nothing has passed under the bar yet until the page has scrolled by its
      // own height, so leaving early would slide it up off a strip of page
      // background rather than off content — a pale gap under SiteNav.
      setHidden(moved > 0 && y >= JUMP_NAV_HEIGHT_PX)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [settle])

  return [hidden, setHidden, settle] as const
}

export default StickyChipBar
