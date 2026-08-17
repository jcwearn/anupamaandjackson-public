import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render as rtlRender, screen, within, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import KeralaItinerary from './KeralaItinerary'
import { INR_PER_USD, usd } from '../lib/inr'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { KERALA_EVENT_ID, universalEvents, type ScheduleEvent } from '../data/scheduleEvents'
import type { GuestScheduleState, KeralaGuestInfo } from '../lib/useGuestSchedule'

const state = vi.hoisted(() => ({ current: null as GuestScheduleState | null }))

vi.mock('../lib/useGuestSchedule', () => ({
  useGuestSchedule: () => state.current,
}))

// The jump bar suppresses hiding for a moment after mount, so a deep link's
// landing scroll doesn't read as the reader setting off. These tests drive that
// clock rather than waiting on it.
let clock = 0

beforeAll(() => {
  // StickySectionHeading pins itself with an IntersectionObserver, which jsdom
  // doesn't implement.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('performance', { now: () => clock })
  // The bar's scroll listeners are rAF-throttled; run the callback inline so a
  // dispatched scroll event settles within the act() that sent it.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 0
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

const lookup = vi.fn()
const chooseCandidate = vi.fn()

const keralaEvent: ScheduleEvent = {
  id: KERALA_EVENT_ID,
  date: '2026-10-29',
  time: 'October 29 – November 1',
  title: 'A Lush Kerala Weekend',
  location: 'Kochi & Alleppey, Kerala',
  sortKey: 10,
}

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
    lookup,
    chooseCandidate,
    signOut: vi.fn(),
    ...overrides,
  }
}

// scrollY is global and survives between tests, and the bar reads it once on
// mount to know where the reader started.
beforeEach(() => {
  vi.clearAllMocks()
  setState()
  clock = 0
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true })
})

// Past the settle window, so this reads as the reader rather than an arrival.
const scrollTo = (y: number) => {
  clock += 1000
  Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true })
  act(() => {
    window.dispatchEvent(new Event('scroll'))
  })
}

// Through the real provider, with only the underlying hook stubbed: the page
// reads guest state from the context now, not from its own hook call.
// A factory, not a shared element: rerender() with a referentially identical
// element lets React bail out of the subtree, so the re-render under test
// would never actually happen.
// The page also reads its filters from the query string, so the router carries
// the search that sets up each scenario.
const page = (search = '') => (
  <MemoryRouter initialEntries={[`/kerala-itinerary${search}`]}>
    <GuestScheduleProvider>
      <KeralaItinerary />
    </GuestScheduleProvider>
  </MemoryRouter>
)

const renderPage = () => rtlRender(page())

// A line that only appears in the real itinerary, never in the gate.
const itinerarySignature = /join us in enjoying one of South India/

describe('KeralaItinerary gating', () => {
  it('shows the itinerary to a guest carrying the kerala event', () => {
    setState({
      status: 'identified',
      displayName: 'Alan',
      events: [...universalEvents, keralaEvent],
    })
    renderPage()

    expect(screen.getByText(itinerarySignature)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unlock Your Schedule' })).not.toBeInTheDocument()
  })

  it('withholds it from an anonymous visitor', () => {
    renderPage()

    expect(screen.queryByText(itinerarySignature)).not.toBeInTheDocument()
    expect(screen.getByText(/This trip is for the guests joining us in Kerala/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unlock Your Schedule' })).toBeEnabled()
  })

  it('withholds it from a guest who is identified but not on the trip', () => {
    // The whole point of the gate: being recognised is not the same as being
    // invited to Kerala.
    setState({ status: 'identified', displayName: 'Ada', events: universalEvents })
    renderPage()

    expect(screen.queryByText(itinerarySignature)).not.toBeInTheDocument()
  })

  describe('when a guest is identified but not on the trip', () => {
    beforeEach(() => {
      setState({ status: 'identified', displayName: 'Ada', events: universalEvents })
    })

    it('says they were recognised, so silence does not read as a failed lookup', () => {
      renderPage()

      expect(screen.getByText(/We found you, Ada/)).toBeInTheDocument()
    })

    it('explains that the trip is a smaller group and offers to re-check', () => {
      renderPage()

      expect(screen.getByText(/smaller group staying on after the wedding/)).toBeInTheDocument()
      expect(screen.getByText(/reach out to us and we’ll take another look/)).toBeInTheDocument()
    })

    it('sends them on to their own schedule rather than leaving a dead end', () => {
      renderPage()

      expect(screen.getByRole('link', { name: 'See your schedule' })).toHaveAttribute(
        'href',
        '/schedule',
      )
    })

    it('offers a way to try a different name', () => {
      // They may be on the list under a spelling they didn't try.
      const signOut = vi.fn()
      setState({ status: 'identified', displayName: 'Ada', events: universalEvents, signOut })
      renderPage()

      fireEvent.click(screen.getByRole('button', { name: 'Not you?' }))

      expect(signOut).toHaveBeenCalled()
    })

    it('drops the unlock trigger, which would do nothing for them now', () => {
      renderPage()

      expect(screen.queryByRole('button', { name: 'Unlock Your Schedule' })).not.toBeInTheDocument()
    })

    it('does not claim to have found anyone before a name is entered', () => {
      setState({ status: 'anonymous' })
      renderPage()

      expect(screen.queryByText(/We found you/)).not.toBeInTheDocument()
      expect(screen.queryByText(/smaller group staying on/)).not.toBeInTheDocument()
    })
  })

  it('keeps the heading, so a shared link still lands somewhere recognisable', () => {
    renderPage()

    expect(
      screen.getByRole('heading', { name: 'A Lush Kerala Weekend', level: 1 }),
    ).toBeInTheDocument()
  })

  it('holds the trigger closed until the index has loaded', () => {
    setState({ status: 'loading' })
    renderPage()

    expect(screen.getByRole('button', { name: 'Unlock Your Schedule' })).toBeDisabled()
  })

  it('points guests at Joy when the index will not load', () => {
    setState({ status: 'error' })
    renderPage()

    expect(screen.getByText(/trouble loading personalized schedules/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unlock Your Schedule' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'view your full details on Joy' }),
    ).toBeInTheDocument()
  })

  it('does not fall open when the index fails', () => {
    // Failing open here would publish the trip to everyone during an outage.
    setState({ status: 'error' })
    renderPage()

    expect(screen.queryByText(itinerarySignature)).not.toBeInTheDocument()
  })

  it('passes a name entered on the gate through to the lookup', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Unlock Your Schedule' }))

    const dialog = screen.getByRole('dialog', { name: 'Unlock your schedule' })
    fireEvent.change(within(dialog).getByLabelText('First name'), { target: { value: 'Alan' } })
    fireEvent.change(within(dialog).getByLabelText('Last name'), { target: { value: 'Turing' } })
    fireEvent.submit(
      within(dialog)
        .getByRole('button', { name: /Unlock/ })
        .closest('form')!,
    )

    expect(lookup).toHaveBeenCalledWith('Alan', 'Turing')
  })

  it('closes the dialog for a guest whose lookup succeeds but who is not on the trip', () => {
    // Otherwise the dialog sits open with their name in it and no sign that
    // anything happened. An invited guest never hits this — the gate unmounts.
    setState({ status: 'anonymous' })
    const { rerender } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Unlock Your Schedule' }))
    expect(screen.getByRole('dialog', { name: 'Unlock your schedule' })).toBeVisible()

    setState({ status: 'identified', displayName: 'Ada', events: universalEvents })
    rerender(page())

    expect(
      screen.getByRole('dialog', { name: 'Unlock your schedule', hidden: true }),
    ).not.toBeVisible()
  })

  it('asks which household from the gate, same as the schedule does', () => {
    setState({ status: 'ambiguous', candidates: ['With Mary Smith', 'With Peter Smith'] })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Unlock Your Schedule' }))

    fireEvent.click(screen.getByRole('button', { name: 'With Peter Smith' }))

    expect(chooseCandidate).toHaveBeenCalledWith(1)
  })
})

// The pricing table sits behind the gate, so these render as a guest the roster
// places on the trip.
const render = (search = '') => {
  setState({ status: 'identified', displayName: 'Alan', events: [...universalEvents, keralaEvent] })
  return rtlRender(page(search))
}

// The rupee quotes behind the table: land cost + ₹8,352 out + ₹7,968 back.
const QUOTES = {
  'Full itinerary': {
    'Double occupancy (per person)': { roundTrip: 56160, oneWay: 48192 },
    'Single occupancy': { roundTrip: 90000, oneWay: 82032 },
  },
  'Shortened itinerary': {
    'Double occupancy (per person)': { roundTrip: 41020, oneWay: 33052 },
    'Single occupancy': { roundTrip: 60860, oneWay: 52892 },
  },
}

function priceRow(title: string, occupancy: string | RegExp) {
  const card = screen.getByRole('heading', { name: title }).closest('div.card')
  expect(card, `no card for "${title}"`).not.toBeNull()
  const row = within(card as HTMLElement)
    .getByRole('rowheader', { name: occupancy })
    .closest('tr')
  return within(row as HTMLElement)
    .getAllByRole('cell')
    .map((cell) => cell.textContent)
}

describe('Kerala flights', () => {
  it('lists all three group flights with their numbers, times and duration', () => {
    render()

    // Keyed off the flight number, not the route: both returns run COK → HYD.
    for (const [number, ...details] of [
      ['IndiGo 6E 6682', 'HYD', 'COK', '2:15 PM', '3:55 PM', '1h 40m'],
      ['IndiGo 6E 6681', 'COK', 'HYD', '4:25 PM', '6:00 PM', '1h 35m'],
      ['IndiGo 6E 951', 'COK', 'HYD', '1:49 PM', '3:15 PM', '1h 26m'],
    ]) {
      const box = screen.getByText(number).closest('div.rounded-lg')!
      for (const detail of details) {
        expect(
          within(box as HTMLElement).getByText(detail),
          `${number}: ${detail}`,
        ).toBeInTheDocument()
      }
    }
  })

  it('labels every time for screen readers, which only see the airport codes', () => {
    // Sighted guests read HYD/COK plus a connector; without these the times are
    // just bare numbers either side of a duration.
    render()

    const cards = screen.getAllByRole('heading', { name: /\(HYD\)|\(COK\)/ })
    expect(screen.getAllByText(/^Departs$/)).toHaveLength(cards.length)
    expect(screen.getAllByText(/^Arrives$/)).toHaveLength(cards.length)
  })

  it('lists the flights in date order, not declaration order', () => {
    // Unfiltered, the two returns belong to different itineraries — the full
    // trip's November 1 leg is declared before the shortened trip's October 31.
    render()

    const dates = [...document.querySelectorAll('#flights .rounded-lg > div > p:first-child')].map(
      (p) => p.textContent,
    )

    // Rendered uppercase by CSS; textContent keeps the derived casing.
    expect(dates).toEqual(['Thursday, October 29', 'Saturday, October 31', 'Sunday, November 1'])
  })

  it('says who the November 1 return is for while both itineraries are on screen', () => {
    render()

    expect(
      screen.getByText(/November 1 return is for guests on the full itinerary/),
    ).toBeInTheDocument()
  })
})

describe('Kerala pricing', () => {
  it('renders a Pricing section', () => {
    render()

    expect(screen.getByRole('heading', { name: 'Pricing' })).toBeInTheDocument()
  })

  it('prices every itinerary and occupancy combination in dollars', () => {
    render()

    for (const [title, rows] of Object.entries(QUOTES)) {
      for (const [occupancy, { roundTrip, oneWay }] of Object.entries(rows)) {
        expect(priceRow(title, occupancy), `${title} · ${occupancy}`).toEqual([
          usd(roundTrip),
          usd(oneWay),
        ])
      }
    }
  })

  it('quotes single occupancy on the shortened itinerary', () => {
    // This row read "not quoted" until the ₹44,540 land cost came in, and is the
    // reason the table exists — guard the two figures it produces.
    render()

    expect(priceRow('Shortened itinerary', 'Single occupancy')).toEqual(['$639', '$555'])
  })

  it('quotes double occupancy on the shortened itinerary', () => {
    // The planner's first quote put this row's land cost at ₹30,540; ₹24,700 is
    // the correction. Pinned in dollars because QUOTES mirrors the table's own
    // numbers, so the check above would pass even if both drifted together.
    render()

    expect(priceRow('Shortened itinerary', 'Double occupancy (per person)')).toEqual([
      '$430',
      '$347',
    ])
  })

  it('derives the dollar figures from the exchange rate', () => {
    // Guards against someone editing a displayed figure without moving the rate,
    // or bumping the rate and leaving stale numbers behind.
    expect(usd(60860)).toBe('$639')
    expect(usd(90000)).toBe('$944')
    expect(Math.round(56160 / INR_PER_USD)).toBe(589)
  })

  it('gives every section heading a copy button', () => {
    const { container } = render()

    expect(container.querySelectorAll('button[aria-label^="Copy link"]').length).toBe(7)
  })
})

describe('Kerala section anchors', () => {
  // The jump chips, the section ids and the headings' anchorIds are written out
  // in three separate places, so they can drift apart silently — and filtering
  // changes which sections exist, so check each state.
  for (const pills of [[], ['Shortened', 'One way'], ['Full', 'Round trip']]) {
    it(`every jump link resolves to a real section with ${pills.join(' + ') || 'no filters'}`, () => {
      const { container } = render()
      for (const pill of pills) {
        fireEvent.click(screen.getByRole('button', { name: pill }))
      }

      const hrefs = [...container.querySelectorAll('a[href^="#"]')].map((a) =>
        a.getAttribute('href')!.slice(1),
      )

      expect(hrefs.length).toBeGreaterThan(0)
      for (const id of hrefs) {
        expect(container.querySelector(`#${id}`), `no element with id "${id}"`).not.toBeNull()
      }
    })
  }
})

describe('Kerala jump bar', () => {
  const bar = (container: HTMLElement) => container.querySelector('nav')!

  it('sits above the page header, so it is pinned from the very top', () => {
    // Below the header it only reaches its sticky slot once the reader has
    // scrolled past the title and the toggles — and rides up over them getting
    // there. Every other page with a chip bar puts it first.
    const { container } = render()
    // `root` not `page`: `page` is the render helper defined at the top of this
    // file, and naming the rendered element after it read as if this were the
    // helper rather than its output.
    const root = container.firstElementChild!

    expect(root.firstElementChild!.tagName).toBe('NAV')
    expect(root.firstElementChild!.nextElementSibling!.tagName).toBe('HEADER')
  })

  it('gets out of the way on the way down the page, and comes back on the way up', () => {
    const { container } = render()

    expect(bar(container).className).not.toContain('-translate-y-full')

    scrollTo(600)
    expect(bar(container).className, 'should hide scrolling down').toContain('-translate-y-full')
    expect(bar(container), 'should not be focusable off screen').toHaveAttribute('inert')

    scrollTo(400)
    expect(bar(container).className, 'should return scrolling up').not.toContain(
      '-translate-y-full',
    )
    expect(bar(container)).not.toHaveAttribute('inert')
  })

  it('behaves the same once a guest has filtered down to their own trip', () => {
    // Filtering changes which flight cards and pricing rows exist, and the bar
    // measures the page around it — but none of that should reach the chips.
    const { container } = render()
    fireEvent.click(screen.getByRole('button', { name: 'Shortened' }))
    fireEvent.click(screen.getByRole('button', { name: 'One way' }))

    scrollTo(600)
    expect(bar(container).className).toContain('-translate-y-full')

    scrollTo(400)
    expect(bar(container).className).not.toContain('-translate-y-full')
  })

  it('comes back before it jumps, so the target lands where scroll-mt expects', () => {
    // Every section's scroll-mt clears both bars. Jump while this one is away
    // and the section lands 48px off.
    const { container } = render()

    scrollTo(600)
    expect(bar(container).className).toContain('-translate-y-full')

    fireEvent.click(screen.getByRole('link', { name: 'Pricing' }))

    expect(bar(container).className).not.toContain('-translate-y-full')
  })
})

describe('Kerala itinerary filters', () => {
  it('shows everything when no option has been chosen', () => {
    // This is also the prerendered HTML, so it has to stand on its own.
    render()

    expect(screen.getByRole('heading', { name: 'Full itinerary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Shortened itinerary' })).toBeInTheDocument()
    expect(screen.getByText('IndiGo 6E 951')).toBeInTheDocument()
    expect(screen.getByText(/one last breakfast at the hotel/)).toBeInTheDocument()
  })

  it('narrows to the shortened one-way trip', () => {
    render()
    fireEvent.click(screen.getByRole('button', { name: 'Shortened' }))
    fireEvent.click(screen.getByRole('button', { name: 'One way' }))

    expect(screen.queryByRole('heading', { name: 'Full itinerary' })).toBeNull()
    expect(priceRow('Shortened itinerary', 'Single occupancy')).toEqual(['$555'])
    // The Nov 1 return leaves the day after these guests do.
    expect(screen.queryByText('IndiGo 6E 951')).toBeNull()
    expect(screen.getByText(/head straight to the airport that afternoon/)).toBeInTheDocument()
  })

  it('gives the shortened return its own flight, not the full trip’s', () => {
    // Both returns run COK → HYD, so the only thing separating them is the date:
    // 6E 951 departs November 1, the day after these guests leave.
    render()
    fireEvent.click(screen.getByRole('button', { name: 'Shortened' }))
    fireEvent.click(screen.getByRole('button', { name: 'Round trip' }))

    const box = screen.getByText('IndiGo 6E 6681').closest('div.rounded-lg')!
    for (const detail of ['4:25 PM', '6:00 PM', '1h 35m']) {
      expect(within(box as HTMLElement).getByText(detail), detail).toBeInTheDocument()
    }
    expect(screen.queryByText('IndiGo 6E 951')).toBeNull()
  })

  it('keeps both flights and drops the one-way column on the full round trip', () => {
    render()
    fireEvent.click(screen.getByRole('button', { name: 'Full' }))
    fireEvent.click(screen.getByRole('button', { name: 'Round trip' }))

    expect(screen.getByText('IndiGo 6E 6682')).toBeInTheDocument()
    expect(screen.getByText('IndiGo 6E 951')).toBeInTheDocument()
    expect(priceRow('Full itinerary', 'Single occupancy')).toEqual(['$944'])
    expect(screen.queryByRole('columnheader', { name: /One way/ })).toBeNull()
  })

  it('counts the hotel nights the chosen itinerary actually covers', () => {
    // The shortened option skips the final night, so the full trip's "2 night"
    // wording would over-promise by a night.
    render()
    fireEvent.click(screen.getByRole('button', { name: 'Shortened' }))
    expect(screen.getByText(/^1 night hotel accommodation in Kochi/)).toBeInTheDocument()
    expect(screen.queryByText(/^2 night hotel accommodation/)).toBeNull()
  })

  it('states the airfare the chosen fare covers', () => {
    render()
    fireEvent.click(screen.getByRole('button', { name: 'One way' }))
    expect(screen.getByText('One way airfare from Hyderabad to Kochi')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Round trip' }))
    expect(screen.getByText('Round trip airfare between Hyderabad and Kochi')).toBeInTheDocument()
  })

  it('covers both trips in the inclusions when nothing is chosen', () => {
    render()

    expect(
      screen.getByText(/2 night hotel accommodation.*1 night on the shortened option/),
    ).toBeInTheDocument()
  })

  it('falls back to the whole page when the link is mangled', () => {
    render('?trip=banana&flights=')

    expect(screen.getByRole('heading', { name: 'Full itinerary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Shortened itinerary' })).toBeInTheDocument()
  })
})

describe('Kerala personalization', () => {
  const jacksonTrip: KeralaGuestInfo = {
    trip: 'full',
    flight: 'rt',
    occupancy: 'double',
    roommates: ['Anupama Tadanki'],
  }

  const renderAs = (kerala: KeralaGuestInfo | undefined, search = '') => {
    setState({
      status: 'identified',
      displayName: 'Jackson',
      events: [...universalEvents, keralaEvent],
      kerala,
    })
    return rtlRender(page(search))
  }

  it('pre-selects the toggles from the guest’s form response', () => {
    renderAs(jacksonTrip)

    expect(screen.getByRole('button', { name: 'Full' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Round trip' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // The pre-selection actually filters the page, same as clicking would.
    expect(screen.queryByRole('heading', { name: 'Shortened itinerary' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: /One way/ })).toBeNull()
  })

  it('ignores query params, so nobody can be linked into someone else’s view', () => {
    // The toggles are page state, not URL state — a link carrying the old
    // ?trip=short must not override what the guest actually chose on the form.
    renderAs(jacksonTrip, '?trip=short&flights=ow')

    expect(screen.getByRole('button', { name: 'Full' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Round trip' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('keeps a cleared toggle cleared instead of snapping back', () => {
    renderAs(jacksonTrip)

    fireEvent.click(screen.getByRole('button', { name: 'Full' }))

    expect(screen.getByRole('button', { name: 'Full' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('heading', { name: 'Full itinerary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Shortened itinerary' })).toBeInTheDocument()
  })

  it('lets "Show everything" survive the defaults too', () => {
    renderAs(jacksonTrip)

    fireEvent.click(screen.getByRole('button', { name: 'Show everything' }))

    expect(screen.getByRole('heading', { name: 'Full itinerary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Shortened itinerary' })).toBeInTheDocument()
  })

  // The section heading and the card land together, so one locator serves all
  // the card assertions.
  const yourTripCard = () =>
    screen.getByText('Here’s what we have down for you').closest('div.card')! as HTMLElement

  it('sums the guest’s choices up in a card, roommate and price included', () => {
    renderAs(jacksonTrip)

    expect(screen.getByRole('heading', { name: 'Your Trip' })).toBeInTheDocument()
    expect(screen.getByText('For Jackson')).toBeInTheDocument()

    // Four stat blocks in the flight cards' hierarchy: eyebrow, headline
    // value, supporting detail. Scoped to the card — 'Full' is also a toggle.
    const card = yourTripCard()
    for (const [label, value, detail] of [
      ['Itinerary', 'Full', 'Oct 29 – Nov 1'],
      ['Flights', 'Round trip', 'HYD ⇄ COK'],
      // The full roster name: first names repeat across a family guest list.
      ['Room', 'Double', 'with Anupama Tadanki'],
      ['Your price', usd(56160), 'per person'],
    ]) {
      expect(within(card).getByText(label), label).toBeInTheDocument()
      expect(within(card).getByText(value), value).toBeInTheDocument()
      expect(within(card).getByText(detail), detail).toBeInTheDocument()
    }
    // Straight from the table, in dollars only.
    expect(card.textContent).not.toContain('₹')
  })

  it('gives the section its own jump chip, but only for form respondents', () => {
    renderAs(jacksonTrip)
    expect(screen.getByRole('link', { name: 'Your Trip' })).toHaveAttribute('href', '#your-trip')
  })

  it('keeps the card telling the form’s truth while the toggles wander', () => {
    // The card is the guest's confirmation of what they told us; flipping the
    // page filters must not rewrite it.
    renderAs(jacksonTrip)

    fireEvent.click(screen.getByRole('button', { name: 'Shortened' }))

    const card = yourTripCard()
    expect(within(card).getByText('Full')).toBeInTheDocument()
    expect(within(card).queryByText('Shortened')).toBeNull()
    expect(within(card).getByText('with Anupama Tadanki')).toBeInTheDocument()
  })

  it('says single occupancy without inventing a roommate', () => {
    renderAs({ trip: 'short', flight: 'ow', occupancy: 'single', roommates: [] })

    const card = yourTripCard()
    expect(within(card).getByText('Single')).toBeInTheDocument()
    expect(within(card).getByText('a room of your own')).toBeInTheDocument()
    expect(within(card).queryByText(/^with /)).toBeNull()
    // Shortened, single, one way — read from the card, not the table.
    expect(within(card).getByText(usd(52892))).toBeInTheDocument()
  })

  it('marks the guest’s own pricing row, and only that one', () => {
    // Cleared filters put both trip cards on screen; the marker must stay on
    // the full-trip double row rather than following every card.
    renderAs(jacksonTrip, '?trip=full')
    fireEvent.click(screen.getByRole('button', { name: 'Show everything' }))

    const markers = screen.getAllByText('Your rate')
    expect(markers).toHaveLength(1)
    const card = markers[0].closest('div.card')!
    expect(
      within(card as HTMLElement).getByRole('heading', { name: 'Full itinerary' }),
    ).toBeInTheDocument()
    expect(markers[0].closest('tr')!.querySelector('th')!.textContent).toContain(
      'Double occupancy (per person)',
    )
  })

  // Fixture names, not the real guests in either of these two cases. This file
  // is published to the public mirror, and a name in a test title is as
  // identifying as one anywhere else — keralaPricing.test.ts says the same.
  it('quotes an overridden guest their actual price, with the note explaining the extra', () => {
    const note =
      'Your price is a little higher than the double-occupancy rate ($588): Carl heads home a night early, so your last night is single occupancy and adds one night’s single supplement ($118).'
    renderAs({
      trip: 'full',
      flight: 'rt',
      occupancy: 'double',
      roommates: ['Carl Sagan'],
      priceOverride: 67440,
      priceNote: note,
    })

    // The card leads with what they actually pay; the note explains why.
    expect(within(yourTripCard()).getByText(usd(67440))).toBeInTheDocument()
    expect(screen.getByText(note)).toBeInTheDocument()
    // The shared table keeps quoting the group rate.
    expect(priceRow('Full itinerary', /Double occupancy \(per person\)/)).toEqual([usd(56160)])
  })

  it('quotes a subsidised guest the reduced price, with the table unchanged behind it', () => {
    // The card and the table disagree on purpose here: the guest is being asked
    // for less than the rate their row quotes, and the note is what reconciles
    // the two. Nothing else on the page knows why.
    const note = 'We are covering $244 of this one, so your price is $700 instead of $944.'
    renderAs({
      trip: 'full',
      flight: 'rt',
      occupancy: 'single',
      roommates: [],
      hostCovers: 23283,
      priceNote: note,
    })

    expect(within(yourTripCard()).getByText('$700')).toBeInTheDocument()
    expect(screen.getByText(note)).toBeInTheDocument()
    // A regex, because this is the guest's own row and so carries the "Your
    // rate" marker in its accessible name.
    expect(priceRow('Full itinerary', /Single occupancy/)).toEqual(['$944'])
  })

  it('leaves the page untouched for a trip guest with no form response', () => {
    renderAs(undefined)

    expect(screen.queryByRole('heading', { name: 'Your Trip' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Your Trip' })).toBeNull()
    expect(screen.queryByText('Your rate')).toBeNull()
    expect(screen.getByRole('button', { name: 'Full' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('heading', { name: 'Full itinerary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Shortened itinerary' })).toBeInTheDocument()
  })
})

describe('Kerala itinerary toggles', () => {
  it('arrives unfiltered even when the link carries the old query params', () => {
    // The filters deliberately live outside the URL now.
    render('?trip=short')

    expect(screen.getByRole('button', { name: 'Shortened' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('heading', { name: 'Full itinerary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Shortened itinerary' })).toBeInTheDocument()
  })

  it('picking an option filters the page', () => {
    render()

    fireEvent.click(screen.getByRole('button', { name: 'Shortened' }))

    expect(screen.queryByRole('heading', { name: 'Full itinerary' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Shortened itinerary' })).toBeInTheDocument()
  })

  it('clicking the chosen option again clears it', () => {
    // "Haven't chosen" is a real state, so these are toggles rather than radios —
    // without this there'd be no way back to seeing both trips.
    render()

    fireEvent.click(screen.getByRole('button', { name: 'Shortened' }))
    expect(screen.queryByRole('heading', { name: 'Full itinerary' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Shortened' }))

    expect(screen.getByRole('heading', { name: 'Full itinerary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Shortened itinerary' })).toBeInTheDocument()
  })

  it('offers a reset only once something is filtered', () => {
    render()
    expect(screen.queryByRole('button', { name: 'Show everything' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'One way' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show everything' }))

    expect(screen.getByRole('heading', { name: 'Full itinerary' })).toBeInTheDocument()
    expect(screen.getByText('IndiGo 6E 951')).toBeInTheDocument()
  })
})
