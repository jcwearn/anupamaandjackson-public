import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { NAV_ITEMS, KERALA_NAV_ITEM, type NavItem } from './navItems'

const KERALA_INVITED_KEY = 'schedule-kerala-invited'
const KERALA_INVITED_EVENT = 'schedule-kerala-invited-changed'

/**
 * Records whether the identified guest is on the Kerala trip.
 *
 * Written by useGuestSchedule when a lookup resolves, and read here rather
 * than re-deriving it: the nav renders on every page — including the invites,
 * which sit outside the schedule entirely — and deciding one link is not worth
 * fetching the index and running a 150,000-iteration PBKDF2 on each of them.
 *
 * This only decides whether the link is offered. /kerala-itinerary does the
 * real check against the guest's decrypted events, so flipping this by hand
 * reveals a link to a page that still gates itself.
 */
export function setKeralaInvited(invited: boolean) {
  try {
    if (invited) window.localStorage.setItem(KERALA_INVITED_KEY, 'true')
    else window.localStorage.removeItem(KERALA_INVITED_KEY)
  } catch {
    // localStorage unavailable (e.g. private browsing) — ignore
  }
  // Notify any already-mounted nav (e.g. a guest identifying themselves on
  // this same page load) immediately, rather than waiting for a route change.
  window.dispatchEvent(new Event(KERALA_INVITED_EVENT))
}

function isKeralaInvited(): boolean {
  try {
    return window.localStorage.getItem(KERALA_INVITED_KEY) === 'true'
  } catch {
    return false
  }
}

// Re-checks on every route change, not just first mount, since SiteNav/FloatingNav
// persist across client-side navigations within their shared layout and wouldn't
// otherwise notice a flag set later in the session. Also listens for the change
// event so the nav updates the moment a guest identifies themselves — or signs
// out again, which takes the link back.
export function useNavItems(): NavItem[] {
  const { pathname } = useLocation()
  const [showKerala, setShowKerala] = useState(false)

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setShowKerala(isKeralaInvited())
  }, [pathname])

  useEffect(() => {
    const onChanged = () => setShowKerala(isKeralaInvited())
    window.addEventListener(KERALA_INVITED_EVENT, onChanged)
    return () => window.removeEventListener(KERALA_INVITED_EVENT, onChanged)
  }, [])

  return showKerala ? [...NAV_ITEMS, KERALA_NAV_ITEM] : NAV_ITEMS
}
