import React from 'react'
import { JUMP_NAV_HEIGHT_PX } from './constants'

/**
 * Hides a sticky bar while the reader scrolls down, and brings it back on the
 * way up.
 *
 * Split out of StickyChipBar.tsx because that file exports a component, and a
 * module exporting both a component and non-components breaks fast refresh --
 * react/only-export-components, an error in .oxlintrc.json.
 */

// How long after a jump a scroll is still that jump arriving rather than the
// reader setting off.
const SETTLE_MS = 400

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
