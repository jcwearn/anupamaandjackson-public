import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Faq from './Faq'
import TravelTips from './TravelTips'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { universalEvents, type ScheduleEvent } from '../data/scheduleEvents'
import type { GuestScheduleState } from '../lib/useGuestSchedule'
import { NAV_ITEMS } from '../lib/navItems'

// Only the guest-aware suite at the bottom renders through the provider; the
// anchor and link suites render bare and see the anonymous default.
const state = vi.hoisted(() => ({ current: null as GuestScheduleState | null }))

vi.mock('../lib/useGuestSchedule', () => ({
  useGuestSchedule: () => state.current,
}))

beforeAll(() => {
  // The deep-link reveal scrolls on the next frame; jsdom implements neither it
  // nor scrollIntoView.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  Element.prototype.scrollIntoView = vi.fn()
})

const renderPage = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

// Every group and question is a <details> carrying its own anchor id.
const anchorIds = (container: HTMLElement) =>
  [...container.querySelectorAll('details[id]')].map((el) => el.id)

describe('FAQ anchors', () => {
  it('gives every group and question a unique, URL-safe id', () => {
    const { container } = renderPage(<Faq />)
    const ids = anchorIds(container)

    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id, `"${id}" needs no escaping in a URL fragment`).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('gives every group and question a copy-link button', () => {
    const { container } = renderPage(<Faq />)

    for (const id of anchorIds(container)) {
      const details = container.querySelector(`details#${id}`)!
      // The label comes from the title, so this also catches a heading that
      // rendered without its summary row.
      expect(
        details.querySelector('button[aria-label^="Copy link to "]'),
        `no copy button for #${id}`
      ).not.toBeNull()
    }
  })
})

describe('FAQ links', () => {
  // The travel questions deliberately carry a short answer plus a link rather
  // than a second copy of the facts. That only holds up while the anchors on
  // the other side still exist — this is what catches a reworded Travel Tips id.
  it('every /travel/tips deep link resolves to a section on that page', () => {
    const travelTips = renderPage(<TravelTips />)
    const travelTipsIds = new Set(
      [...travelTips.container.querySelectorAll('[id]')].map((el) => el.id)
    )
    travelTips.unmount()

    const { container } = renderPage(<Faq />)
    const fragments = [...container.querySelectorAll('a[href^="/travel/tips#"]')].map(
      (a) => a.getAttribute('href')!.split('#')[1]
    )

    expect(fragments.length).toBeGreaterThan(0)
    for (const fragment of fragments) {
      expect(travelTipsIds.has(fragment), `/travel/tips has no #${fragment}`).toBe(true)
    }
  })

  it('answers the clothing question with the guide, in one place', () => {
    // This used to be two questions — "What should I wear?" and "I want to wear
    // Indian clothing — where do I start?" — each answering a slice of the same
    // thing in its own words. One question now, and its answer is the way to
    // the page that holds all of it.
    const { container } = renderPage(<Faq />)

    const links = [...container.querySelectorAll('a[href^="/what-to-wear"]')]
    expect(links.length, 'no link to the What to Wear guide').toBe(1)
    expect(links[0].closest('details')!.id).toBe('dress-code')
    expect(container.querySelector('details#indian-clothing')).toBeNull()
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
      '/faq',
      '/what-to-wear',
    ])

    const { container } = renderPage(<Faq />)
    const internal = [...container.querySelectorAll('a[href^="/"]')].map(
      (a) => a.getAttribute('href')!.split('#')[0]
    )

    expect(internal.length).toBeGreaterThan(0)
    for (const path of internal) {
      expect(routes.has(path), `no route for "${path}"`).toBe(true)
    }
  })

  it('opens external shopping links in a new tab safely', () => {
    const { container } = renderPage(<Faq />)

    const external = [...container.querySelectorAll('a[href^="http"]')]
    expect(external.length).toBeGreaterThan(0)
    for (const link of external) {
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toContain('noreferrer')
    }
  })
})

describe('FAQ RSVP answer', () => {
  it('opens the password modal rather than linking straight to Joy', () => {
    // Joy's RSVP page is password-gated, so a bare link would dead-end.
    renderPage(<Faq />)

    // The modal is always mounted so it can animate; closed, it's aria-hidden,
    // which takes it out of the accessibility tree and so out of role queries.
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'RSVP on Joy' }))

    expect(screen.getByRole('dialog', { name: 'Before you RSVP' })).toBeInTheDocument()
  })
})

describe('FAQ navigation', () => {
  it('is reachable from the site nav', () => {
    expect(NAV_ITEMS).toContainEqual({ to: '/faq', label: 'FAQ' })
  })
})

describe('FAQ dress code', () => {
  const setState = (overrides: Partial<GuestScheduleState> = {}) => {
    state.current = {
      status: 'anonymous',
      events: universalEvents,
      isAdmin: false,
      candidates: [],
      emailPrompt: false,
      emailFailed: false,
      submitEmail: vi.fn(),
      skipEmail: vi.fn(),
      lookup: vi.fn(),
      chooseCandidate: vi.fn(),
      signOut: vi.fn(),
      ...overrides,
    }
  }

  const renderFaq = () =>
    render(
      <MemoryRouter>
        <GuestScheduleProvider>
          <Faq />
        </GuestScheduleProvider>
      </MemoryRouter>
    )

  const dressCode = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('details#dress-code')!

  const reception: ScheduleEvent = {
    id: 'reception',
    date: '2026-10-28',
    time: '7:00 PM',
    title: 'Reception & Dinner',
    location: 'Golkonda Resorts and Spa',
    attire: 'Wedding formal. Floor-length gowns, cocktail dresses…',
    sortKey: 20,
  }

  it('points at the guide instead of listing the dress codes', () => {
    setState()
    const { container } = renderFaq()

    const button = within(dressCode(container)).getByRole('link', { name: 'What to Wear Guide' })
    expect(button).toHaveAttribute('href', '/what-to-wear')
  })

  it('restates no dress code of its own, identified or not', () => {
    // The answer used to render the guest's events here as well as on
    // /what-to-wear. Two places describing the same event drift, and the guest
    // reads whichever they land on first.
    setState({ status: 'identified', displayName: 'Grace', events: [reception] })
    const { container } = renderFaq()
    const text = dressCode(container).textContent

    expect(text).not.toContain('Reception & Dinner')
    expect(text).not.toContain('Wedding formal')
    expect(text).not.toContain('For your events')
    expect(text).not.toContain('Unlock Your Events')
  })
})
