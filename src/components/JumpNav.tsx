import React from 'react'
import { JumpNavOffset } from '../lib/jumpNavOffset'
import { flushSync } from 'react-dom'
import {
  JUMP_NAV_HEIGHT_PX,
  JUMP_NAV_SECTION_TOP,
  SITE_NAV_HEIGHT_PX,
  SITE_NAV_OFFSET,
} from '../lib/constants'
import StickyChipBar from './StickyChipBar'
import { chipClass } from '../lib/chipClass'
import { useHiddenOnScrollDown } from '../lib/useHiddenOnScrollDown'

// Clears SiteNav (5rem) plus this bar (3rem). Written out because Tailwind needs
// the class statically — keep it in step with JUMP_NAV_SECTION_TOP, which the
// headings on those pages use.
export const JUMP_NAV_SCROLL_MT = 'scroll-mt-[calc(env(safe-area-inset-top,0px)+8rem)]'

// For an anchor *inside* one of those sections, where StickySectionHeading has
// pinned itself under both bars and would otherwise sit on top of the thing
// being jumped to. The 8rem above plus that heading, which measures 76px on
// /what-to-wear — 5rem leaves it a few pixels of daylight.
export const JUMP_NAV_INNER_SCROLL_MT = 'scroll-mt-[calc(env(safe-area-inset-top,0px)+13rem)]'

// Where a jumped-to section comes to rest: below SiteNav and this bar.
const JUMP_LINE_PX = SITE_NAV_HEIGHT_PX + JUMP_NAV_HEIGHT_PX

export type JumpTarget = { id: string; label: string }

// Highlights the chip for whichever section the reader is in: the last one whose
// top has passed under both bars. rAF-throttled like useScrolled.ts, and every
// measurement happens inside the effect so nothing touches layout during render.
function useActiveSection(ids: string[]) {
  const [active, setActive] = React.useState(ids[0])

  React.useEffect(() => {
    let frame = 0
    const pick = () => {
      frame = 0
      let current = ids[0]
      for (const id of ids) {
        const section = document.getElementById(id)
        if (section && section.getBoundingClientRect().top <= JUMP_LINE_PX + 8) current = id
      }
      // At the very bottom the rule above under-reports: the last sections can
      // sit below the line with no scroll left to lift them past it. Nothing
      // follows them, so that's where the reader is.
      const atBottom =
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      setActive(atBottom ? ids[ids.length - 1] : current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(pick)
    }

    pick()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ids])

  return active
}

/**
 * A bar of chips that pins under SiteNav and scrolls the reader to a section,
 * highlighting whichever one they're in.
 *
 * Wraps the page's content rather than sitting above it because it owns two
 * things at opposite ends of the page: the bar before, and the slack after.
 * Wrap the page header too — the bar belongs at the very top, where it is at
 * its sticky position from the start.
 *
 * Sections must carry the matching `id` and `JUMP_NAV_SCROLL_MT`, and their
 * headings must pin at `JUMP_NAV_SECTION_TOP` — otherwise they sit underneath
 * this bar instead of below it.
 *
 * `ready` gates the deep-link landing for pages whose content is still settling
 * on mount: the slack is measured against the last section, so measuring while
 * that section can still change size sizes it for the wrong page.
 */
const JumpNav: React.FC<{
  targets: JumpTarget[]
  label?: string
  ready?: boolean
  children: React.ReactNode
}> = ({ targets, label = 'Jump to section', ready = true, children }) => {
  const ids = React.useMemo(() => targets.map((target) => target.id), [targets])
  const active = useActiveSection(ids)
  const [room, setRoom] = React.useState(0)
  const [jump, setJump] = React.useState(0)
  const [hidden, setHidden, settle] = useHiddenOnScrollDown()

  // Headings sit under the bar while it's there and take its place when it's
  // not. Both values move together: the CSS offset parks the heading, the px one
  // decides when its opaque background comes in.
  const offset = React.useMemo(
    () =>
      hidden
        ? { top: SITE_NAV_OFFSET, pinPx: SITE_NAV_HEIGHT_PX }
        : { top: JUMP_NAV_SECTION_TOP, pinPx: JUMP_LINE_PX },
    [hidden],
  )

  // How much slack the page needs beneath the last section for a jump target to
  // reach the line. Sized against the last section because it's the deepest
  // target — anything above it has more content below to scroll through.
  const roomNeeded = React.useCallback(() => {
    const last = document.getElementById(ids[ids.length - 1])
    if (!last) return 0
    return Math.max(0, window.innerHeight - JUMP_LINE_PX - last.getBoundingClientRect().height)
  }, [ids])

  // Arriving on a deep link, the browser scrolled before that slack existed and
  // so landed short. Re-assert after `load`, because Chrome performs its own
  // fragment scroll around then — computed before the slack existed too — and
  // going first only to be overridden leaves the reader short again.
  React.useEffect(() => {
    if (!ready) return
    const id = window.location.hash.slice(1)
    if (!id || !ids.includes(id)) return

    const land = () =>
      requestAnimationFrame(() => {
        // Arriving is not scrolling away, and this jump can land long after
        // mount — it waits for `load`, so the window opened there has closed.
        settle()
        setHidden(false)
        flushSync(() => {
          setRoom(roomNeeded())
          setJump((n) => n + 1)
        })
        // Instant: the reader asked for this position, they didn't scroll here.
        document.getElementById(id)?.scrollIntoView({ behavior: 'instant' })
      })

    if (document.readyState === 'complete') {
      land()
      return
    }
    window.addEventListener('load', land, { once: true })
    return () => window.removeEventListener('load', land)
  }, [ready, ids, roomNeeded, settle, setHidden])

  // flushSync so the height is committed before the browser performs the
  // anchor's own navigation; a normal setState would land a frame too late,
  // after it had already measured how far it could scroll.
  //
  // The bar is showing — it was just clicked — so pin the headings under it
  // before the jump, or the target lands 48px off from where scroll-mt expects.
  const openRoom = () => {
    settle()
    flushSync(() => {
      setHidden(false)
      setRoom(roomNeeded())
      // Counts jumps, so a second one re-arms the retraction below even when it
      // needs the same room as the last and `room` alone doesn't change.
      setJump((n) => n + 1)
    })
  }

  // Take it back once the reader has scrolled up far enough that the spacer sits
  // entirely below the viewport, where removing it moves nothing on screen. Any
  // earlier and the browser would clamp the scroll position and the page would
  // lurch; any later and they could scroll down into the emptiness again.
  //
  // Keyed on `jump` as well as `room`: a second jump travels down through the
  // range where this would fire, and pulling the spacer out from under a scroll
  // already in flight leaves it short of the target it was aimed at.
  React.useEffect(() => {
    if (!room) return
    let frame = 0
    let settled = false
    let cancelled = false

    // The jump's own scroll starts well above the threshold, so wait for it to
    // come to rest before reading movement as the reader leaving.
    let lastY = -1
    let stillFor = 0
    const waitForRest = () => {
      if (cancelled) return
      const y = window.scrollY
      if (y === lastY) {
        if (++stillFor > 8) {
          settled = true
          return
        }
      } else {
        stillFor = 0
        lastY = y
      }
      requestAnimationFrame(waitForRest)
    }
    requestAnimationFrame(waitForRest)

    const check = () => {
      frame = 0
      if (!settled) return
      const withoutRoom = document.documentElement.scrollHeight - room - window.innerHeight
      if (window.scrollY <= withoutRoom) setRoom(0)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelled = true
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [room, jump])

  return (
    <>
      <StickyChipBar label={label} hidden={hidden}>
        {targets.map((target) => (
          <a
            key={target.id}
            href={`#${target.id}`}
            onClick={openRoom}
            aria-current={active === target.id ? 'true' : undefined}
            className={chipClass(active === target.id)}
          >
            {target.label}
          </a>
        ))}
      </StickyChipBar>

      <JumpNavOffset.Provider value={offset}>{children}</JumpNavOffset.Provider>

      {/* Present only mid-jump, and only as tall as that jump needs. */}
      {room > 0 && <div aria-hidden data-jump-room style={{ height: room }} />}
    </>
  )
}

export default JumpNav
