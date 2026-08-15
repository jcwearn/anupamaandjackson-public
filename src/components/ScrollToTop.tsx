import React, { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Resets window scroll on client-side navigations. POP covers browser
// back/forward and the initial load, where the browser restores its own
// position; hash locations scroll to their anchor instead.
const ScrollToTop: React.FC = () => {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  // Deliberately keyed on pathname alone. navigationType and hash are read as
  // of the moment the path changed, which is the question being asked: "was
  // this a fresh navigation to a new page, and did it name an anchor?"
  //
  // Adding them to the deps would change behaviour rather than just satisfy the
  // rule. Going from /a#section to /a keeps the same pathname, so today nothing
  // re-runs and the reader stays put; with `hash` in the array the effect would
  // fire on the hash clearing and jump them to the top. That may or may not be
  // wanted, but it is a UX decision and no test covers it, so it does not
  // belong in a lint sweep.
  useLayoutEffect(() => {
    if (navigationType === 'POP' || hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}

export default ScrollToTop
