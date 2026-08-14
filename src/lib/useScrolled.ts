import { useEffect, useState } from 'react'

// Shared scrolled-state for the fixed nav bars' drop shadow. rAF-throttled,
// with a hysteresis band (on past 24px, off back under 4px) so the shadow
// doesn't flicker when the page settles near the threshold.
export function useScrolled(): boolean {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      setScrolled((prev) => (prev ? window.scrollY > 4 : window.scrollY > 24))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return scrolled
}
