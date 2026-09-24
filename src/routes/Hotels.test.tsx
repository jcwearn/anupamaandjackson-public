import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import Hotels from './Hotels'
import { GOLKONDA_SLUG, hotels } from '../data/hotels'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import {
  GOLKONDA_STAY_EVENT_ID,
  PELLIKUTHURU_EVENT_ID,
  universalEvents,
  type ScheduleEvent,
} from '../data/scheduleEvents'
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

// The page only reads ids off these, so the rest is filler.
const stubEvent = (id: string): ScheduleEvent => ({
  id,
  date: '2026-10-27',
  time: '',
  title: id,
  location: '',
  sortKey: 0,
})

const withEvents = (displayName: string, ...ids: string[]) => ({
  status: 'identified' as const,
  displayName,
  events: [...universalEvents, ...ids.map(stubEvent)],
})

// A guest with a room is always tagged, so always carries the check-in event.
const withRoom = (golkonda: 'covered' | 'own') => ({
  ...withEvents('Alan', PELLIKUTHURU_EVENT_ID, GOLKONDA_STAY_EVENT_ID),
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

const jumpBar = () => screen.queryByRole('navigation', { name: 'Jump to section' })
const TAJ_BLOCK = /held a block of rooms at the Taj Krishna/

beforeEach(() => {
  setState()
})

describe('Hotels anchors', () => {
  // Every section and card is on the page for a guest invited to everything;
  // what the gates hide is covered below.
  beforeEach(() => {
    setState(withEvents('Alan', PELLIKUTHURU_EVENT_ID, GOLKONDA_STAY_EVENT_ID))
  })

  it('every in-page jump link points at an element that exists', () => {
    // The jump buttons, the section ids and the headings' anchorIds are written
    // out in three separate places, so they can drift apart silently.
    const { container } = renderPage()

    const hrefs = [...container.querySelectorAll('a[href^="#"]')].map((a) =>
      a.getAttribute('href')!.slice(1),
    )

    expect(hrefs.length).toBeGreaterThan(0)
    for (const id of hrefs) {
      expect(container.querySelector(`#${id}`), `no element with id "${id}"`).not.toBeNull()
    }
  })

  it('names the section anchors after hotels, not events', () => {
    const { container } = renderPage()

    expect(container.querySelector('#pre-wedding-hotels')).not.toBeNull()
    expect(container.querySelector('#wedding-hotels')).not.toBeNull()
    expect(container.querySelector('#pre-wedding-events')).toBeNull()
    expect(container.querySelector('#wedding-events')).toBeNull()
  })

  it('gives each section heading a copy button matching its section id', () => {
    const { container } = renderPage()

    for (const [id, title] of [
      ['pre-wedding-hotels', 'Pre-Wedding Hotels'],
      ['wedding-hotels', 'Wedding Hotels'],
    ]) {
      const button = container.querySelector(`#${id} button[aria-label="Copy link to ${title}"]`)
      expect(button, `no copy button for #${id}`).not.toBeNull()
    }
  })

  it('reaches both sections from the pinned jump bar', () => {
    renderPage()

    const bar = jumpBar()!
    expect(bar).not.toBeNull()
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
    // Scoped to the header: through the provider, the unlock modal's own
    // submit button wears the same class.
    const { container } = renderPage()

    expect(container.querySelector('header')!.querySelectorAll('.btn-primary')).toHaveLength(0)
  })

  it('renders every hotel as its own anchor target', () => {
    const { container } = renderPage()

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

describe('Hotels invitation gates', () => {
  // The other wedding hotels are for everyone; only the resort's card is gated.
  const otherWeddingHotels = hotels.filter(
    (h) => h.section === 'wedding' && h.slug !== GOLKONDA_SLUG,
  )

  const expectLockedView = (container: HTMLElement) => {
    expect(container.querySelector('#pre-wedding-hotels')).toBeNull()
    expect(container.querySelector(`#${GOLKONDA_SLUG}`)).toBeNull()
    expect(header(container).queryByText(TAJ_BLOCK)).not.toBeInTheDocument()
    expect(jumpBar()).toBeNull()
    expect(container.querySelector('#wedding-hotels')).not.toBeNull()
    for (const hotel of otherWeddingHotels) {
      expect(container.querySelector(`#${hotel.slug}`), `missing #${hotel.slug}`).not.toBeNull()
    }
    // The header is deliberately unchanged: it still reads like the page it
    // always was, RSVP punt included.
    expect(header(container).getByText(RSVP_PUNT)).toBeInTheDocument()
  }

  it('withholds the pre-wedding hotels and the resort from a visitor who has not signed in', () => {
    // Also what the prerender bakes in: the server never has a record.
    const { container } = renderPage()
    expectLockedView(container)
  })

  it('withholds them from a guest invited to neither', () => {
    setState(withEvents('Ada'))
    const { container } = renderPage()
    expectLockedView(container)
  })

  it('shows the pre-wedding hotels, and only those, to a Pellikuthuru guest', () => {
    setState(withEvents('Ana', PELLIKUTHURU_EVENT_ID))
    const { container } = renderPage()

    expect(container.querySelector('#pre-wedding-hotels')).not.toBeNull()
    expect(header(container).getByText(TAJ_BLOCK)).toBeInTheDocument()
    for (const hotel of hotels.filter((h) => h.section === 'pre-wedding')) {
      expect(container.querySelector(`#${hotel.slug}`), `missing #${hotel.slug}`).not.toBeNull()
    }
    expect(container.querySelector(`#${GOLKONDA_SLUG}`)).toBeNull()

    // Two sections again, so the bar is back with both chips.
    const bar = jumpBar()!
    expect(bar).not.toBeNull()
    expect(within(bar).getAllByRole('link')).toHaveLength(2)
  })

  it('shows the resort, and only that, to a guest tagged for a room', () => {
    // Tagged and attending, but she declined the room: the card is hers to
    // see because the tag is what admits her, and it reads exactly as it
    // does for everyone — no reservation, no price.
    setState(withEvents('Katherine', GOLKONDA_STAY_EVENT_ID))
    const { container } = renderPage()

    expect(container.querySelector(`#${GOLKONDA_SLUG}`)).not.toBeNull()
    expect(golkondaCard(container).getByText(RSVP_PUNT)).toBeInTheDocument()
    expect(screen.queryByText('Your room is reserved')).not.toBeInTheDocument()
    expect(container.textContent).not.toContain('$350')

    expect(container.querySelector('#pre-wedding-hotels')).toBeNull()
    expect(header(container).queryByText(TAJ_BLOCK)).not.toBeInTheDocument()
    expect(jumpBar()).toBeNull()
  })
})

describe('Hotels room personalization', () => {
  it('looks like an ordinary page to a guest with no room', () => {
    // The whole point of the feature: nothing about the untagged page hints
    // that it can be read any other way.
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

describe('Hotels unlock prompt', () => {
  // The gates above hide rooms silently, so a guest who hasn't unlocked needs
  // telling that the list they're looking at may not be the whole of it.
  const unlockButton = () => screen.queryByRole('button', { name: 'Unlock Your Stay' })

  it('asks a visitor who has not signed in for their name', () => {
    const { container } = renderPage()

    expect(header(container).getByText(/see the hotels we’ve arranged for you/)).toBeInTheDocument()
    fireEvent.click(unlockButton()!)

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Unlock your stay')
  })

  it('holds the button disabled while a returning guest is still being looked up', () => {
    setState({ status: 'loading' })
    renderPage()

    expect(unlockButton()).toBeDisabled()
  })

  it('goes away once the guest is identified', () => {
    setState(withEvents('Ada'))
    renderPage()

    expect(unlockButton()).toBeNull()
  })

  it('stays out of the way when there is no index to unlock against', () => {
    setState({ status: 'error' })
    renderPage()

    expect(unlockButton()).toBeNull()
  })
})
