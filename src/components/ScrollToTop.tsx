import React, { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Resets window scroll on client-side navigations. POP covers browser
// back/forward and the initial load, where the browser restores its own
// position; hash locations scroll to their anchor instead.
const ScrollToTop: React.FC = () => {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  useLayoutEffect(() => {
    if (navigationType === 'POP' || hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

export default ScrollToTop
