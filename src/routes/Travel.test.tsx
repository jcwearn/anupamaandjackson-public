import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Travel from './Travel'
import TravelTips from './TravelTips'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { NAV_ITEMS, TRAVEL_NAV_ITEMS } from '../lib/navItems'
import { KERALA_EVENT_ID, universalEvents, type ScheduleEvent } from '../data/scheduleEvents'
import type { GuestScheduleState } from '../lib/useGuestSchedule'

// Mocked rather than left to run: the real hook fetches the index on mount, and
// these tests have no business making a request to decide the rest of the page.
const state = vi.hoisted(() => ({ current: null as GuestScheduleState | null }))

vi.mock('../lib/useGuestSchedule', () => ({
  useGuestSchedule: () => state.current,
}))

const setState = (events: ScheduleEvent[] = universalEvents) => {
  state.current = {
    status: 'anonymous',
    events,
    isAdmin: false,
    candidates: [],
    emailPrompt: false,
    emailFailed: false,
    submitEmail: vi.fn(),
    skipEmail: vi.fn(),
    lookup: vi.fn(),
    chooseCandidate: vi.fn(),
    signOut: vi.fn(),
  }
}

beforeEach(() => {
  setState()
})

beforeAll(() => {
  // The hash reveal scrolls on the next frame; jsdom implements neither it nor
  // scrollIntoView.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  Element.prototype.scrollIntoView = vi.fn()
})

const renderPage = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <GuestScheduleProvider>{ui}</GuestScheduleProvider>
    </MemoryRouter>,
  )

describe('Travel hub', () => {
  it('is the section entry point in the nav', () => {
    expect(NAV_ITEMS.some((item) => item.to === '/travel')).toBe(true)
    // The sub-pages are reached from this page, not from the nav row, which is
    // what keeps SiteNav's 880px breakpoint where it is.
    expect(NAV_ITEMS.some((item) => item.to.startsWith('/travel/'))).toBe(false)
  })

  it('covers the whole section in the second-level row', () => {
    // The bar TravelLayout pins is the only way between these pages, so a page
    // added to the section and left out of this list would be unreachable.
    const tos = TRAVEL_NAV_ITEMS.map((item) => item.to)

    expect(tos).toEqual(['/travel', '/travel/tips', '/travel/hyderabad', '/travel/food'])
  })

  it('gives both sections a copy-linkable anchor', () => {
    const { container } = renderPage(<Travel />)

    for (const id of ['booking-your-flights', 'once-you-land']) {
      const heading = container.querySelector(`#${id}`)
      expect(heading, `no #${id} on the page`).not.toBeNull()
      expect(
        heading!.querySelector('button[aria-label^="Copy link to "]'),
        `no copy button for #${id}`,
      ).not.toBeNull()
    }
  })

  it('every internal link points at a route the site serves', () => {
    // Mirrors the SiteLayout children in main.tsx and entry-server.tsx; an
    // unknown path would hit the catch-all and bounce the reader home.
    const routes = new Set([
      '/',
      '/evisa',
      '/kerala-itinerary',
      '/hotels',
      '/travel',
      '/travel/hyderabad',
      '/travel/tips',
      '/travel/food',
      '/faq',
    ])

    const { container } = renderPage(<Travel />)
    const internal = [...container.querySelectorAll('a[href^="/"]')].map(
      (a) => a.getAttribute('href')!.split('#')[0],
    )

    expect(internal.length).toBeGreaterThan(0)
    for (const path of internal) {
      expect(routes.has(path), `no route for "${path}"`).toBe(true)
    }
  })

  describe('the Kerala flights note', () => {
    const note = /flights between Hyderabad and Kochi/
    const keralaEvent: ScheduleEvent = {
      id: KERALA_EVENT_ID,
      date: '2026-10-29',
      time: 'October 29 – November 1',
      title: 'A Lush Kerala Weekend',
      location: 'Kochi & Alleppey, Kerala',
      sortKey: 10,
    }

    it('is withheld from a visitor who has not identified themselves', () => {
      renderPage(<Travel />)

      expect(screen.queryByText(note)).not.toBeInTheDocument()
    })

    it('is withheld from a guest who is not on the trip', () => {
      // Telling them their flights are booked would give away a trip they are
      // not on — the same thing /kerala-itinerary is gated to avoid.
      setState(universalEvents)
      renderPage(<Travel />)

      expect(screen.queryByText(note)).not.toBeInTheDocument()
    })

    it('is shown to a guest carrying the kerala event', () => {
      setState([...universalEvents, keralaEvent])
      renderPage(<Travel />)

      expect(screen.getByText(note)).toBeInTheDocument()
    })

    it('leaves the rest of the flights section in place either way', () => {
      // Gating one paragraph must not take its section with it.
      renderPage(<Travel />)

      expect(screen.getByText(/Rajiv Gandhi International Airport/)).toBeInTheDocument()
      expect(screen.getByText(/Monday, October 26/)).toBeInTheDocument()
    })
  })

  it('every /travel/tips deep link resolves to a section on that page', () => {
    const travelTips = renderPage(<TravelTips />)
    const travelTipsIds = new Set(
      [...travelTips.container.querySelectorAll('[id]')].map((el) => el.id),
    )
    travelTips.unmount()

    const { container } = renderPage(<Travel />)
    const fragments = [...container.querySelectorAll('a[href^="/travel/tips#"]')].map(
      (a) => a.getAttribute('href')!.split('#')[1],
    )

    expect(fragments.length).toBeGreaterThan(0)
    for (const fragment of fragments) {
      expect(travelTipsIds.has(fragment), `/travel/tips has no #${fragment}`).toBe(true)
    }
  })
})
