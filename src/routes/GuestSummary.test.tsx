import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import GuestSummary from './GuestSummary'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { universalEvents } from '../data/scheduleEvents'
import type { GuestScheduleState } from '../lib/useGuestSchedule'
import type { AdminUnlockState, AdminUnlockStatus, GuestSummaryEntry } from '../lib/adminUnlock'

const state = vi.hoisted(() => ({ current: null as GuestScheduleState | null }))
const unlockState = vi.hoisted(() => ({ current: null as AdminUnlockState | null }))

vi.mock('../lib/useGuestSchedule', () => ({
  useGuestSchedule: () => state.current,
}))

// The passphrase crypto is adminUnlock.test.tsx's subject. Here the roster is
// handed over directly, so the filters can be checked against known rows.
vi.mock('../lib/adminUnlock', () => ({
  useAdminUnlock: () => unlockState.current,
}))

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

/**
 * Nine guests, one for each tag × status pair plus three untagged, so every
 * combination of the two chip rows has exactly one expected name.
 */
const summary: GuestSummaryEntry[] = [
  { name: 'Vidya Yes', tag: 'vidya', status: 'attending' },
  { name: 'Vidya No', tag: 'vidya', status: 'declined' },
  { name: 'Vidya Silent', tag: 'vidya', status: 'none' },
  { name: 'Venkat Yes', tag: 'venkat', status: 'attending' },
  { name: 'Venkat No', tag: 'venkat', status: 'declined' },
  { name: 'Venkat Silent', tag: 'venkat', status: 'none' },
  { name: 'Neither Yes', status: 'attending' },
  { name: 'Neither No', status: 'declined' },
  { name: 'Neither Silent', status: 'none' },
]

const setUnlock = (
  status: AdminUnlockStatus = 'locked',
  overrides: Partial<AdminUnlockState> = {},
) => {
  unlockState.current = {
    status,
    summary: status === 'unlocked' ? summary : [],
    unlock: vi.fn(),
    forget: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  setState()
  setUnlock()
})

const renderPage = () =>
  render(
    <MemoryRouter>
      <GuestScheduleProvider>
        <GuestSummary />
      </GuestScheduleProvider>
    </MemoryRouter>,
  )

const asAdmin = () => setState({ status: 'identified', displayName: 'Anupama', isAdmin: true })

/** By name, because each household renders as a list of its own inside it. */
const guestList = () => screen.getByRole('list', { name: 'Guests' })

/**
 * The names on screen, in order.
 *
 * Scoped to the leaf items: a household renders as a nested list inside one
 * outer item, so collecting every `li` would return the wrapper and its
 * members both, and read the household's names twice.
 */
const listed = () =>
  [...guestList().querySelectorAll('li')]
    .filter((item) => item.querySelector('li') === null)
    .map((item) => item.textContent)

/** Names grouped as the page draws them: one array per row, households nested. */
const households = () =>
  [...guestList().children].map((item) => {
    const nested = [...item.querySelectorAll('li')]
    return nested.length > 0 ? nested.map((member) => member.textContent) : [item.textContent]
  })

describe('GuestSummary gate', () => {
  it('shows an anonymous visitor the way in, not the guest list', () => {
    renderPage()

    expect(screen.getByRole('button', { name: 'Unlock This Page' })).toBeInTheDocument()
    expect(screen.queryByText('Vidya Yes')).not.toBeInTheDocument()
  })

  it('withholds the list from an identified guest who is not an admin', () => {
    const signOut = vi.fn()
    setState({ status: 'identified', displayName: 'Ada', isAdmin: false, signOut })
    renderPage()

    expect(screen.getByText(/We know you as Ada/)).toBeInTheDocument()
    expect(screen.queryByText('Vidya Yes')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Not you?' }))
    expect(signOut).toHaveBeenCalled()
  })

  it('withholds the list from an admin who has not entered the passphrase', () => {
    // Carrying the admin tag is who you are. The passphrase is the secret, and
    // this page is 649 people's names, so the tag alone is not enough.
    asAdmin()
    setUnlock('locked')
    renderPage()

    expect(screen.getByLabelText('Admin passphrase')).toBeInTheDocument()
    expect(screen.queryByText('Vidya Yes')).not.toBeInTheDocument()
  })

  it('says so when the passphrase was wrong, without showing the list', () => {
    asAdmin()
    setUnlock('wrong')
    renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent('not the passphrase')
    expect(screen.queryByText('Vidya Yes')).not.toBeInTheDocument()
  })

  it('shows nothing at all while the index is still loading', () => {
    // Rather than flashing a password field at an admin who unlocked months ago.
    asAdmin()
    setUnlock('loading')
    renderPage()

    expect(screen.queryByLabelText('Admin passphrase')).not.toBeInTheDocument()
    expect(screen.queryByText('Vidya Yes')).not.toBeInTheDocument()
  })
})

describe('GuestSummary filters', () => {
  beforeEach(() => {
    asAdmin()
    setUnlock('unlocked')
  })

  it('opens on everyone who has not responded', () => {
    // The list worth acting on. Attending and declined are both settled.
    renderPage()

    expect(listed()).toEqual(['Vidya Silent', 'Venkat Silent', 'Neither Silent'])
  })

  it.each([
    ['Everyone', 'Attending', ['Vidya Yes', 'Venkat Yes', 'Neither Yes']],
    ['Everyone', 'Not Attending', ['Vidya No', 'Venkat No', 'Neither No']],
    ['Everyone', 'No Response', ['Vidya Silent', 'Venkat Silent', 'Neither Silent']],
    ['Vidya', 'Attending', ['Vidya Yes']],
    ['Vidya', 'Not Attending', ['Vidya No']],
    ['Vidya', 'No Response', ['Vidya Silent']],
    ['Venkat', 'Attending', ['Venkat Yes']],
    ['Venkat', 'Not Attending', ['Venkat No']],
    ['Venkat', 'No Response', ['Venkat Silent']],
  ])('lists %s / %s', (side, status, expected) => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: side }))
    fireEvent.click(screen.getByRole('button', { name: status }))

    expect(listed()).toEqual(expected)
  })

  it('counts what is on screen', () => {
    renderPage()

    expect(screen.getByText('3 guests')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Vidya' }))
    // Singular, because '1 guests' on a page built for one person to read all
    // day is the kind of thing that gets noticed.
    expect(screen.getByText('1 guest')).toBeInTheDocument()
  })

  it('marks the active chip in each row', () => {
    renderPage()

    expect(screen.getByRole('button', { name: 'Everyone' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Venkat' }))
    expect(screen.getByRole('button', { name: 'Venkat' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Everyone' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('keeps the two filters independent', () => {
    // Changing side must not reset the answer, or every look at the other
    // family starts over from the default.
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Attending' }))
    fireEvent.click(screen.getByRole('button', { name: 'Venkat' }))

    expect(listed()).toEqual(['Venkat Yes'])
  })

  it('says so plainly when a combination is empty', () => {
    setUnlock('unlocked', { summary: [{ name: 'Vidya Yes', tag: 'vidya', status: 'attending' }] })
    renderPage()

    expect(screen.getByText('0 guests')).toBeInTheDocument()
    expect(screen.getByText('Nobody on this list right now.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('lists both of two guests who share a name', () => {
    // There are two Jane Does on the real roster, and a keyed-by-name list
    // would silently render one.
    setUnlock('unlocked', {
      summary: [
        { name: 'Jane Doe', status: 'none' },
        { name: 'Jane Doe', status: 'none' },
      ],
    })
    renderPage()

    expect(listed()).toEqual(['Jane Doe', 'Jane Doe'])
  })

  it('draws a household as one bracketed block, and a lone guest as a plain row', () => {
    setUnlock('unlocked', {
      summary: [
        { name: 'Solo Traveller', status: 'none' },
        { name: 'Ama Household', status: 'none', party: 4 },
        { name: 'Bo Household', status: 'none', party: 4 },
        { name: 'Cy Household', status: 'none', party: 4 },
      ],
    })
    renderPage()

    expect(households()).toEqual([
      ['Solo Traveller'],
      ['Ama Household', 'Bo Household', 'Cy Household'],
    ])
    expect(screen.getByRole('list', { name: 'Party of 3' })).toBeInTheDocument()
  })

  it('keeps two adjacent households apart', () => {
    // Consecutive rows are only one block when they share a party id; running
    // them together would invent a household that does not exist.
    setUnlock('unlocked', {
      summary: [
        { name: 'Ama One', status: 'none', party: 1 },
        { name: 'Bo One', status: 'none', party: 1 },
        { name: 'Cy Two', status: 'none', party: 2 },
        { name: 'Di Two', status: 'none', party: 2 },
      ],
    })
    renderPage()

    expect(households()).toEqual([
      ['Ama One', 'Bo One'],
      ['Cy Two', 'Di Two'],
    ])
  })

  it('brackets only the members a filter leaves on screen', () => {
    // 25 households on the real roster are split across RSVP answers. On a
    // "who has not responded" list the useful thing is the two who have not.
    setUnlock('unlocked', {
      summary: [
        { name: 'Ama Split', status: 'none', party: 7 },
        { name: 'Bo Split', status: 'attending', party: 7 },
        { name: 'Cy Split', status: 'none', party: 7 },
      ],
    })
    renderPage()

    expect(households()).toEqual([['Ama Split', 'Cy Split']])
    expect(screen.getByRole('list', { name: 'Party of 2' })).toBeInTheDocument()
  })

  it('drops the bracket when a filter leaves one member of a household', () => {
    // A bracket around a single name says nothing.
    setUnlock('unlocked', {
      summary: [
        { name: 'Ama Alone', status: 'none', party: 9 },
        { name: 'Bo Alone', status: 'attending', party: 9 },
      ],
    })
    renderPage()

    expect(households()).toEqual([['Ama Alone']])
    expect(screen.queryByRole('list', { name: /^Party of/ })).not.toBeInTheDocument()
  })

  it('counts guests, not households', () => {
    setUnlock('unlocked', {
      summary: [
        { name: 'Ama Household', status: 'none', party: 3 },
        { name: 'Bo Household', status: 'none', party: 3 },
        { name: 'Solo Traveller', status: 'none' },
      ],
    })
    renderPage()

    expect(screen.getByText('3 guests')).toBeInTheDocument()
  })

  it('offers a way to re-lock the device', () => {
    const forget = vi.fn()
    setUnlock('unlocked', { forget })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Forget this device' }))
    expect(forget).toHaveBeenCalled()
  })
})
