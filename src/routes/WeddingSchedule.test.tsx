import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import WeddingSchedule from './WeddingSchedule'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { universalEvents, type ScheduleEvent } from '../data/scheduleEvents'
import type { GuestScheduleState } from '../lib/useGuestSchedule'

const state = vi.hoisted(() => ({ current: null as GuestScheduleState | null }))

vi.mock('../lib/useGuestSchedule', () => ({
  useGuestSchedule: () => state.current,
}))

beforeAll(() => {
  // StickySectionHeading pins itself with an IntersectionObserver, which jsdom
  // doesn't implement. Nothing here depends on it firing.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

const lookup = vi.fn()
const chooseCandidate = vi.fn()
const signOut = vi.fn()

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
    signOut,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  setState()
})

// Through the real provider, with only the underlying hook stubbed: the page
// reaches its dialogs through the context now, so rendering it bare would test
// a wiring that no longer exists.
const renderPage = () =>
  render(
    <MemoryRouter>
      <GuestScheduleProvider>
        <WeddingSchedule />
      </GuestScheduleProvider>
    </MemoryRouter>
  )

describe('WeddingSchedule', () => {
  it('invites an anonymous guest to identify themselves', () => {
    renderPage()

    expect(screen.getByRole('button', { name: 'Unlock Your Schedule' })).toBeEnabled()
    expect(screen.getByText(/add your name to see the schedule/i)).toBeInTheDocument()
  })

  it('shows the universal events before anyone identifies themselves', () => {
    // The page is never empty: these two are bundled precisely so the
    // prerendered HTML says something useful.
    renderPage()

    expect(
      screen.getByRole('heading', { name: 'Wedding Ceremony & Muhurtham' })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Wednesday, October 28' })).toBeInTheDocument()
  })

  it('sends a reader from a dress code to the pictures', () => {
    // The attire lines name garments — sari, kurta, sherwani — and this was the
    // only page carrying them with no route to the guide that shows them.
    renderPage()

    const guide = screen.getByRole('link', { name: 'What to Wear guide' })
    expect(guide).toHaveAttribute('href', '/what-to-wear')
  })

  it('holds the trigger closed until the index has loaded', () => {
    setState({ status: 'loading' })
    renderPage()

    expect(screen.getByRole('button', { name: 'Unlock Your Schedule' })).toBeDisabled()
  })

  it('greets a guest by name once identified', () => {
    setState({ status: 'identified', displayName: 'Grace' })
    renderPage()

    expect(screen.getByText(/Here’s everything we have planned for you, Grace/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unlock Your Schedule' })).not.toBeInTheDocument()
  })

  it('lets an identified guest say it is not them', () => {
    setState({ status: 'identified', displayName: 'Grace' })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Not you?' }))

    expect(signOut).toHaveBeenCalled()
  })

  it('points guests at Joy when personalized schedules are unavailable', () => {
    // A failed index load must not leave the page looking broken.
    setState({ status: 'error' })
    renderPage()

    expect(screen.getByText(/trouble loading personalized schedules/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unlock Your Schedule' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'view your full details on Joy' })).toBeInTheDocument()
  })

  it('groups a guest’s events under a heading per day, in date order', () => {
    const events: ScheduleEvent[] = [
      {
        id: 'reception',
        date: '2026-10-29',
        time: '7:00 PM',
        title: 'Reception',
        location: 'Golkonda Resorts and Spa',
        sortKey: 10,
      },
      {
        id: 'pellikuthuru',
        date: '2026-10-26',
        time: '9:00 AM',
        title: 'Pellikuthuru',
        location: 'Banjara Hills',
        sortKey: 10,
      },
      ...universalEvents,
    ]
    setState({ status: 'identified', displayName: 'Alan', events })
    renderPage()

    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)

    expect(headings).toEqual([
      'Monday, October 26',
      'Wednesday, October 28',
      'Thursday, October 29',
    ])
  })

  it('names the day’s venue once in its heading instead of on every card', () => {
    // October 29 as guests actually see it: two events at the resort plus the
    // optional Kerala trip. The heading's eyebrow takes the resort, the two
    // cards below it go quiet, and Kerala keeps its own venue because it
    // differs.
    const events: ScheduleEvent[] = [
      {
        id: 'farewell-breakfast',
        date: '2026-10-29',
        time: '8:00 AM',
        title: 'Farewell Breakfast',
        location: 'Golkonda Resorts and Spa',
        mapUrl: 'https://maps.app.goo.gl/SpZipKNxsgTZEywSA',
        sortKey: 10,
      },
      {
        id: 'checkout',
        date: '2026-10-29',
        time: '11:00 AM',
        title: 'Checkout',
        location: 'Golkonda Resorts and Spa',
        mapUrl: 'https://maps.app.goo.gl/SpZipKNxsgTZEywSA',
        sortKey: 20,
      },
      {
        id: 'kerala',
        date: '2026-10-29',
        time: 'October 29 to November 1',
        title: 'Kerala Trip',
        location: 'Kochi & Alleppey, Kerala',
        sortKey: 30,
      },
    ]
    setState({ status: 'identified', displayName: 'Alan', events })
    renderPage()

    const venueLinks = screen.getAllByRole('link', { name: 'Golkonda Resorts and Spa' })
    expect(venueLinks).toHaveLength(1)
    expect(venueLinks[0]).toHaveAttribute('href', 'https://maps.app.goo.gl/SpZipKNxsgTZEywSA')

    const heading = screen.getByRole('heading', { name: 'Thursday, October 29' })
    expect(heading.closest('.sticky')).toContainElement(venueLinks[0])

    expect(screen.getByText('Kochi & Alleppey, Kerala')).toBeInTheDocument()
  })

  it('marks the venue with a pin, without letting it into the link’s name', () => {
    // At eyebrow size an underline alone doesn't say "this opens a map". The
    // pin says it — but it is decoration, so screen readers must still hear
    // just the venue.
    renderPage()

    const venueLink = screen.getByRole('link', { name: 'Golkonda Resorts and Spa' })
    expect(venueLink.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })

  it('leaves the pin off a venue that has no map to point at', () => {
    setState({
      status: 'identified',
      displayName: 'Alan',
      events: [
        {
          id: 'kerala',
          date: '2026-10-29',
          time: 'October 29 to November 1',
          title: 'Kerala Trip',
          location: 'Kochi & Alleppey, Kerala',
          sortKey: 10,
        },
      ],
    })
    const { container } = renderPage()

    expect(screen.queryByRole('link', { name: 'Kochi & Alleppey, Kerala' })).not.toBeInTheDocument()
    expect(container.querySelector('.sticky svg')).toBeNull()
  })

  it('opens the unlock dialog from the header button', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Unlock Your Schedule' }))

    const dialog = screen.getByRole('dialog', { name: 'Unlock your schedule' })
    expect(within(dialog).getByLabelText('First name')).toBeInTheDocument()
  })

  it('passes the entered name through to the lookup', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Unlock Your Schedule' }))

    const dialog = screen.getByRole('dialog', { name: 'Unlock your schedule' })
    fireEvent.change(within(dialog).getByLabelText('First name'), { target: { value: 'Alan' } })
    fireEvent.change(within(dialog).getByLabelText('Last name'), { target: { value: 'Turing' } })
    fireEvent.submit(within(dialog).getByRole('button', { name: /Unlock/ }).closest('form')!)

    expect(lookup).toHaveBeenCalledWith('Alan', 'Turing')
  })
})
