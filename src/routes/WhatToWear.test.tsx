import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import WhatToWear from './WhatToWear'
import { mensOutfits, womensOutfits } from '../data/attire'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import type { ScheduleEvent } from '../data/scheduleEvents'
import type { GuestScheduleState } from '../lib/useGuestSchedule'

const state = vi.hoisted(() => ({ current: null as GuestScheduleState | null }))

vi.mock('../lib/useGuestSchedule', () => ({
  useGuestSchedule: () => state.current,
}))

beforeAll(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  // StickySectionHeading pins itself with an IntersectionObserver, absent in jsdom.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Element.prototype.scrollIntoView = vi.fn()
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <WhatToWear />
    </MemoryRouter>,
  )

const allOutfits = [...mensOutfits, ...womensOutfits]
const allPhotos = allOutfits.flatMap((outfit) => outfit.photos)

describe('What to Wear', () => {
  it('keeps every slug unique and URL-safe', () => {
    // The outfits and the page's own section ids render into one document, so a
    // collision would give two elements the same id and send a deep link to
    // whichever the browser found first.
    const { container } = renderPage()
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id)

    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size, 'duplicate id on the page').toBe(ids.length)
    for (const id of ids) {
      expect(id, `"${id}" needs no escaping in a URL fragment`).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('renders every outfit, under its own id', () => {
    const { container } = renderPage()

    for (const outfit of allOutfits) {
      expect(screen.getByRole('heading', { name: outfit.name })).toBeInTheDocument()
      if (outfit.note) expect(screen.getByText(outfit.note)).toBeInTheDocument()
      expect(container.querySelectorAll(`#${outfit.slug}`), `#${outfit.slug}`).toHaveLength(1)
    }
  })

  it('gives every photo alt text and an intrinsic size', () => {
    // Seventeen lazy images below the fold: without width/height the page
    // reflows under the reader as each one arrives, and without alt the guest
    // using a screen reader gets a list of outfit names with nothing under them.
    renderPage()

    for (const photo of allPhotos) {
      expect(photo.alt.trim(), `${photo.src} has no alt text`).not.toBe('')
      expect(photo.width, `${photo.src} has no width`).toBeGreaterThan(0)
      expect(photo.height, `${photo.src} has no height`).toBeGreaterThan(0)

      const img = screen.getByAltText(photo.alt)
      expect(img).toHaveAttribute('width', String(photo.width))
      expect(img).toHaveAttribute('height', String(photo.height))
    }
  })

  it('crops every photo to the 2:3 the cards render at', () => {
    // The cards are a fixed aspect-[2/3] and object-cover silently eats the
    // difference, so a source that arrives at another ratio loses a head or a
    // hem with nothing to show for it. Cropping happens once, on the way in.
    for (const photo of allPhotos) {
      const ratio = photo.width / photo.height
      expect(ratio, `${photo.src} is ${photo.width}x${photo.height}, not 2:3`).toBeCloseTo(2 / 3, 2)
    }
  })

  it('opens external shopping links in a new tab safely', () => {
    // Same list as the FAQ's "Where can I shop?" — one WhereToShop component
    // renders in both, so this and Faq.test.tsx guard the same links.
    const { container } = renderPage()

    const external = [...container.querySelectorAll('a[href^="http"]')]
    expect(external.length).toBeGreaterThan(0)
    for (const link of external) {
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toContain('noreferrer')
    }
  })

  it('every internal link points at a route the site serves', () => {
    const routes = new Set(['/faq', '/travel/tips', '/schedule', '/what-to-wear'])

    const { container } = renderPage()
    const internal = [...container.querySelectorAll('a[href^="/"]')].map(
      (a) => a.getAttribute('href')!.split('#')[0],
    )

    expect(internal.length).toBeGreaterThan(0)
    for (const path of internal) {
      expect(routes.has(path), `no route for "${path}"`).toBe(true)
    }
  })

  it('shows the gate prompt rather than a dress code to an unidentified guest', () => {
    // The per-event dress codes are exactly what the guest gate protects, and
    // this page is reachable by anyone with the URL.
    renderPage()

    expect(screen.getByText(/Add your name/i)).toBeInTheDocument()
    expect(screen.queryByText('For your events')).not.toBeInTheDocument()
  })

  it('gives every outfit at least one event to be worn to', () => {
    // That the ids are *real* is checked in tests/scheduleIndex.test.js, which
    // has the catalog open already — src/ never reads data/schedule-events.json.
    for (const outfit of allOutfits) {
      expect(outfit.events.length, `${outfit.slug} names no event`).toBeGreaterThan(0)
    }
  })

  it('names no event at all until a reader identifies themselves', () => {
    // Not even the universal ones, which /schedule does prerender for everyone.
    // The rule here is the simpler one: nothing until you type your name.
    const { container } = renderPage()

    expect(container.querySelectorAll('#mens li li, #womens li li')).toHaveLength(0)

    const page = container.textContent!
    for (const name of ['Muhurtham', 'Pellikuthuru', 'Edurukolu', 'Reception']) {
      expect(page, `names '${name}' to an anonymous reader`).not.toContain(name)
    }
  })

  it('keeps the Indian-wear notes behind the gate too', () => {
    const { container } = renderPage()
    const yourEvents = container.querySelector('#your-events')!.textContent

    expect(yourEvents).toContain('Add your name')
    expect(yourEvents).not.toContain('If you’d like to wear Indian clothing')
    expect(yourEvents).not.toContain('kanjivaram')
  })
})

describe('What to Wear, for an identified guest', () => {
  const guestEvents: ScheduleEvent[] = [
    {
      id: 'muhurtham',
      date: '2026-10-28',
      time: '9:00 AM',
      title: 'Wedding Ceremony & Muhurtham',
      location: 'Golkonda Resorts and Spa',
      attire: 'Saris/kurtas encouraged',
      indianWear: {
        note: 'The most traditional event of the week.',
        women: 'Bright colored saris with a gold or silver zari (border).',
        men: 'A white cotton or silk kurta with a pancha.',
      },
      sortKey: 10,
    },
    // No Indian-wear notes of its own, and no attire either — it should be
    // skipped rather than listed blank.
    {
      id: 'lunch',
      date: '2026-10-28',
      time: '12:00 PM',
      title: 'Traditional South Indian Lunch',
      location: 'Golkonda Resorts and Spa',
      sortKey: 20,
    },
  ]

  const renderIdentified = () => {
    state.current = {
      status: 'identified',
      displayName: 'Grace',
      events: guestEvents,
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
    return render(
      <MemoryRouter>
        <GuestScheduleProvider>
          <WhatToWear />
        </GuestScheduleProvider>
      </MemoryRouter>,
    )
  }

  it('gives them the Indian-wear notes for their own events', () => {
    const { container } = renderIdentified()
    const yourEvents = container.querySelector('#your-events')!.textContent

    expect(yourEvents).toContain('Wedding Ceremony & Muhurtham')
    expect(yourEvents).toContain('If you’d like to wear Indian clothing')
    expect(yourEvents).toContain('The most traditional event of the week.')
    expect(yourEvents).toContain('Bright colored saris')
    expect(yourEvents).toContain('A white cotton or silk kurta with a pancha.')
    expect(yourEvents).not.toContain('Traditional South Indian Lunch')
  })

  it('gives each event an anchor for the schedule to link at', () => {
    // The What to Wear Guide button on a schedule card points at /what-to-wear#<id>.
    // Without the id it lands at the top of the page and the guest has to find
    // their own event in the list.
    const { container } = renderIdentified()

    const anchor = container.querySelector('#muhurtham')
    expect(anchor, 'no anchor for muhurtham').not.toBeNull()
    expect(anchor!.textContent).toContain('Wedding Ceremony & Muhurtham')

    // Without a scroll margin it lands under the pinned section heading, which
    // covers exactly the event title the reader came for.
    expect(anchor!.className, 'anchor has no scroll margin').toMatch(/scroll-mt-/)

    // Every id on the page still has to be unique — the outfit slugs and the
    // event ids render into one document and are authored in different files.
    const ids = [...container.querySelectorAll('[id]')].map((el) => el.id)
    expect(new Set(ids).size, 'duplicate id on the page').toBe(ids.length)
  })

  it('names on each outfit only the events they’re invited to', () => {
    const { container } = renderIdentified()

    // The sari suits all four events; this guest is admitted to one of them.
    const sari = container.querySelector('#sari') as HTMLElement
    expect(within(sari).getByText('Muhurtham')).toBeInTheDocument()
    expect(sari.textContent).not.toContain('Reception')

    // A reception-only outfit stays silent for them.
    expect(container.querySelector('#sherwani')!.textContent).not.toContain('Reception')

    const chips = [...container.querySelectorAll('#mens li li, #womens li li')].map(
      (el) => el.textContent,
    )
    expect(chips.length).toBeGreaterThan(0)
    expect(new Set(chips)).toEqual(new Set(['Muhurtham']))
  })
})
