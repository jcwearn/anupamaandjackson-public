import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TravelTips from './TravelTips'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { universalEvents, type ScheduleEvent } from '../data/scheduleEvents'
import type { GuestScheduleState } from '../lib/useGuestSchedule'

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

beforeEach(() => {
  vi.clearAllMocks()
  setState()
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <GuestScheduleProvider>
        <TravelTips />
      </GuestScheduleProvider>
    </MemoryRouter>,
  )

const outfits = (container: HTMLElement) => container.querySelector<HTMLElement>('details#outfits')!

// Every group and tip is a <details> carrying its own anchor id.
const anchorIds = (container: HTMLElement) =>
  [...container.querySelectorAll('details[id]')].map((el) => el.id)

describe('Travel Tips anchors', () => {
  it('gives every group and tip a unique, URL-safe id', () => {
    const { container } = renderPage()
    const ids = anchorIds(container)

    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id, `"${id}" needs no escaping in a URL fragment`).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('gives every group and tip a copy-link button', () => {
    const { container } = renderPage()

    for (const id of anchorIds(container)) {
      const details = container.querySelector(`details#${id}`)!
      // The label comes from the title, so this also catches a heading that
      // rendered without its summary row.
      expect(
        details.querySelector('button[aria-label^="Copy link to "]'),
        `no copy button for #${id}`,
      ).not.toBeNull()
    }
  })
})

describe('Standalone advice survives edits', () => {
  // The anchor tests above assert properties of whatever ids happen to exist —
  // they never assert a given id is present, so a deleted section passes them
  // silently. #outfits used to be the exposed one; the FAQ's dress-code answer
  // now links to it, so Faq.test's cross-page check would catch its removal
  // too. These claims still guard the copy inside each section, which no
  // anchor test looks at.
  const claims: [string, string][] = [
    ['what-to-pack', 'Sun protection'],
    ['what-to-pack', 'Odomos'],
    ['what-to-pack', 'hand sanitizer'],
    ['outfits', 'shoulders and knees covered'],
    ['outfits', 'pants rather than shorts'],
    ['outfits', 'don’t mind getting dirty'],
    ['getting-around', 'compressed natural gas'],
    ['money-and-payments', 'choose rupees'],
    ['make-a-voting-plan', 'vote.org'],
    ['make-a-voting-plan', 'November 3'],
  ]

  it.each(claims)('#%s still carries "%s"', (id, phrase) => {
    const { container } = renderPage()
    const details = container.querySelector(`details#${id}`)

    expect(details, `#${id} is gone`).not.toBeNull()
    expect(details!.textContent).toContain(phrase)
  })
})

describe('Outfits', () => {
  const guestEvents: ScheduleEvent[] = [
    {
      id: 'reception',
      date: '2026-10-28',
      time: '7:00 PM',
      title: 'Reception',
      location: 'Golkonda Resorts and Spa',
      attire: 'Wedding formal. Floor-length gowns, cocktail dresses…',
      indianWear: { women: 'Saris, sparkly lehengas', men: 'A sherwani or a bandhgala' },
      sortKey: 20,
    },
    {
      id: 'welcome-edurukolu',
      date: '2026-10-27',
      time: '6:00 PM',
      title: 'Welcome Celebration & Edurukolu',
      location: 'Golkonda Resorts and Spa',
      attire: 'Festive & colorful — Indian wear is welcome',
      sortKey: 30,
    },
  ]

  // What this tip keeps is the packing advice for the week around the events —
  // the heat, the temples, the streets. The dress codes and the garments moved
  // to /what-to-wear, which is now the only page that writes them down.
  it('keeps the everyday packing advice', () => {
    const { container } = renderPage()
    const text = outfits(container).textContent

    expect(text).toContain('Light, breathable clothing for the heat')
    expect(text).toContain('shoes or sandals you don’t mind getting dirty')
  })

  it('sends the reader to the guide rather than answering here', () => {
    const { container } = renderPage()

    const button = within(outfits(container)).getByRole('link', { name: 'What to Wear Guide' })
    expect(button).toHaveAttribute('href', '/what-to-wear')
  })

  it('no longer restates a dress code, identified or not', () => {
    // A second copy of these is exactly what the guide exists to replace: two
    // places describing the same event drift, and the guest reads whichever
    // they land on first.
    const identified = renderPage()
    expect(outfits(identified.container).textContent).not.toContain('Wedding formal')
    identified.unmount()

    setState({ status: 'identified', displayName: 'Grace', events: guestEvents })
    const { container } = renderPage()
    const text = outfits(container).textContent

    expect(text).not.toContain('Wedding formal')
    expect(text).not.toContain('Festive & colorful')
    expect(text).not.toContain('For your events')
    expect(
      within(outfits(container)).queryByRole('button', { name: 'Unlock Your Events' }),
    ).toBeNull()
  })
})

describe('Antacids', () => {
  it('tells you to pack Tums in exactly one place', () => {
    // Eating & drinking used to say "Pack some antacids (Tums)" as well. The
    // packing list is where you'd act on it, so that half was trimmed and only
    // the spice warning stayed behind.
    const { container } = renderPage()
    const mentions = [...container.querySelectorAll('li')].filter((li) =>
      /Tums|antacid/i.test(li.textContent ?? ''),
    )

    expect(mentions).toHaveLength(1)
    expect(mentions[0].closest('details')!.id).toBe('what-to-pack')
  })
})

describe('At the airport', () => {
  // The tip covers both legs of the trip, split by heading. Which list a bullet
  // sits under is the whole point — an arrival reader shouldn't hit check-in
  // kiosks, and someone flying home shouldn't have to scan past baggage claim.
  const airportGroups = () => {
    const { container } = renderPage()
    const details = container.querySelector('details#at-the-airport')!

    return [...details.querySelectorAll('h3')].map((heading) => ({
      heading: heading.textContent,
      // Headings and lists are siblings in the body, so each list belongs to the
      // heading immediately before it.
      bullets: [...(heading.nextElementSibling?.querySelectorAll('li') ?? [])].map(
        (li) => li.textContent ?? '',
      ),
    }))
  }

  it('splits the tip into arriving and heading-home lists', () => {
    expect(airportGroups().map((g) => g.heading)).toEqual(['Arriving in India', 'Heading home'])
  })

  it('files the arrival bullets under Arriving in India', () => {
    const [arriving] = airportGroups()
    const text = arriving.bullets.join('\n')

    expect(text).toContain('immigration and baggage claim')
    // The Schengen rule covers both legs but is stated once, and it belongs
    // here: readers reach this heading on the way out, and would otherwise not
    // meet the rule until they were already coming home.
    expect(text).toContain('passport control')
  })

  it('files the return-journey bullets under Heading home', () => {
    const [, home] = airportGroups()
    const text = home.bullets.join('\n')

    expect(text).toContain('only let ticketed passengers')
    expect(text).toContain('Section B')
    expect(text).toContain('Abu Dhabi')
    expect(text).toContain('take out all electronics')
  })

  it('states the Schengen passport-control rule exactly once', () => {
    const all = airportGroups().flatMap((g) => g.bullets)

    expect(all.filter((b) => b.includes('passport control'))).toHaveLength(1)
  })
})
