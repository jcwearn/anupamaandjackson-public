import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import Hotels from './Hotels'
import { GOLKONDA_SLUG, hotels } from '../data/hotels'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { universalEvents } from '../data/scheduleEvents'
import type { GuestScheduleState } from '../lib/useGuestSchedule'

const state = vi.hoisted(() => ({ current: null as GuestScheduleState | null }))

vi.mock('../lib/useGuestSchedule', () => ({
  useGuestSchedule: () => state.current,
}))

beforeAll(() => {
  // StickySectionHeading pins itself with an IntersectionObserver, absent in jsdom.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})

const setState = (overrides: Partial<GuestScheduleState> = {}) => {
  state.current = {
    status: 'anonymous',
    events: universalEvents,
    isAdmin: false,
    candidates: [],
    emailPrompt: false,
    emailFailed: false,
    lookup: vi.fn(),
    submitEmail: vi.fn(),
    skipEmail: vi.fn(),
    chooseCandidate: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  }
}

const withRoom = (golkonda: 'covered' | 'own') => ({
  status: 'identified' as const,
  displayName: 'Alan',
  golkonda,
})

// Through the real provider with only the hook stubbed, the way the other
// personalized pages are tested.
const renderPage = () =>
  render(
    <GuestScheduleProvider>
      <Hotels />
    </GuestScheduleProvider>,
  )

beforeEach(() => {
  setState()
})

describe('Hotels anchors', () => {
  it('every in-page jump link points at an element that exists', () => {
    // The jump buttons, the section ids and the headings' anchorIds are written
    // out in three separate places, so they can drift apart silently.
    const { container } = render(<Hotels />)

    const hrefs = [...container.querySelectorAll('a[href^="#"]')].map((a) =>
      a.getAttribute('href')!.slice(1),
    )

    expect(hrefs.length).toBeGreaterThan(0)
    for (const id of hrefs) {
      expect(container.querySelector(`#${id}`), `no element with id "${id}"`).not.toBeNull()
    }
  })

  it('names the section anchors after hotels, not events', () => {
    const { container } = render(<Hotels />)

    expect(container.querySelector('#pre-wedding-hotels')).not.toBeNull()
    expect(container.querySelector('#wedding-hotels')).not.toBeNull()
    expect(container.querySelector('#pre-wedding-events')).toBeNull()
    expect(container.querySelector('#wedding-events')).toBeNull()
  })

  it('gives each section heading a copy button matching its section id', () => {
    const { container } = render(<Hotels />)

    for (const [id, title] of [
      ['pre-wedding-hotels', 'Pre-Wedding Hotels'],
      ['wedding-hotels', 'Wedding Hotels'],
    ]) {
      const button = container.querySelector(`#${id} button[aria-label="Copy link to ${title}"]`)
      expect(button, `no copy button for #${id}`).not.toBeNull()
    }
  })

  it('reaches both sections from the pinned jump bar', () => {
    render(<Hotels />)

    const bar = screen.getByRole('navigation', { name: 'Jump to section' })
    expect(within(bar).getByRole('link', { name: 'Pre-Wedding' })).toHaveAttribute(
      'href',
      '#pre-wedding-hotels',
    )
    expect(within(bar).getByRole('link', { name: 'Wedding' })).toHaveAttribute(
      'href',
      '#wedding-hotels',
    )
  })

  it('no longer duplicates those links as buttons in the header', () => {
    // The pinned bar replaced them; keeping both would be two sets of controls
    // doing one job, stacked on top of each other.
    const { container } = render(<Hotels />)

    expect(container.querySelectorAll('.btn-primary')).toHaveLength(0)
  })

  it('renders every hotel as its own anchor target', () => {
    const { container } = render(<Hotels />)

    for (const hotel of hotels) {
      expect(container.querySelector(`#${hotel.slug}`), `missing #${hotel.slug}`).not.toBeNull()
    }
  })
})

const RSVP_PUNT = /reflected in your RSVP details/

// Scoped, because the Golkonda hotel card's own description carries the same
// RSVP sentence as the page header and each is swapped separately.
const header = (container: HTMLElement) => within(container.querySelector('header')!)
const golkondaCard = (container: HTMLElement) =>
  within(container.querySelector(`#${GOLKONDA_SLUG}`) as HTMLElement)

describe('Hotels room personalization', () => {
  it('looks like an ordinary page to a guest with no room', () => {
    // The whole point of the feature: nothing about the untagged page hints
    // that it can be read any other way.
    const { container } = renderPage()

    expect(screen.queryByText('Your room is reserved')).not.toBeInTheDocument()
    expect(header(container).getByText(RSVP_PUNT)).toBeInTheDocument()
    expect(golkondaCard(container).getByText(RSVP_PUNT)).toBeInTheDocument()
    expect(container.textContent).not.toContain('$350')
  })

  it('looks the same to a guest who is identified but has no room', () => {
    // Everyone tagged who declined the room or is not attending still carries
    // the four hotel events, so the events alone would not have been a gate.
    setState({ status: 'identified', displayName: 'Katherine' })
    const { container } = renderPage()

    expect(screen.queryByText('Your room is reserved')).not.toBeInTheDocument()
    expect(header(container).getByText(RSVP_PUNT)).toBeInTheDocument()
    expect(container.textContent).not.toContain('$350')
  })

  it('tells a covered guest about the room and never about money', () => {
    // They have nothing to settle, so raising the subject at all only invites
    // the question.
    setState(withRoom('covered'))
    const { container } = renderPage()

    const text = (container.querySelector(`#${GOLKONDA_SLUG}`) as HTMLElement).textContent!
    expect(text).toContain('a room for you here for the nights of October 27 and 28')
    for (const money of ['$350', 'on us', 'pay', 'cost', 'settle']) {
      expect(text, money).not.toContain(money)
    }
  })

  it('quotes an own-room guest the price and where to settle it', () => {
    setState(withRoom('own'))
    const { container } = renderPage()

    const text = (container.querySelector(`#${GOLKONDA_SLUG}`) as HTMLElement).textContent!
    expect(text).toContain('a room for you here for the nights of October 27 and 28')
    expect(text).toContain('roughly $350 per room, for one to three people')
    expect(text).toContain('settle it with the resort directly at check-in or checkout')
    expect(text).not.toContain('on us')
  })

  it('offers either guest a way out of the arrangement', () => {
    for (const stay of ['covered', 'own'] as const) {
      setState(withRoom(stay))
      const { container, unmount } = renderPage()
      expect(
        golkondaCard(container).getByText(/If you’d rather make your own arrangements/),
      ).toBeInTheDocument()
      unmount()
    }
  })

  it('keeps the room note on the Golkonda card and nowhere else', () => {
    // No separate summary section: the answer lives with the hotel it is about.
    setState(withRoom('own'))
    const { container } = renderPage()

    expect(screen.getAllByText(/a room for you here for the nights/)).toHaveLength(1)
    expect(screen.getAllByText('Your room is reserved')).toHaveLength(1)
    expect(golkondaCard(container).getByText('Your room is reserved')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Your Room' })).not.toBeInTheDocument()
  })

  it('swaps the header’s RSVP punt for the guest who now has the answer', () => {
    setState(withRoom('own'))
    const { container } = renderPage()

    expect(header(container).queryByText(RSVP_PUNT)).not.toBeInTheDocument()
    expect(
      header(container).getByText(/We’ve arranged a room for you at the resort/),
    ).toBeInTheDocument()
  })

  it('drops the Golkonda card’s own RSVP punt, which the note now answers', () => {
    setState(withRoom('covered'))
    const { container } = renderPage()

    expect(golkondaCard(container).queryByText(RSVP_PUNT)).not.toBeInTheDocument()
  })
})
