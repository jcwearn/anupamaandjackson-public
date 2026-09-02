import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import GuestSummary from './GuestSummary'
import AdminLayout from '../layouts/AdminLayout'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { universalEvents } from '../data/scheduleEvents'
import { SITE_ORIGIN } from '../lib/constants'
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
 * Twelve guests, one for each list × status pair, so every combination of the
 * two chip rows has exactly one expected name.
 *
 * The Anupama four carry her side and neither parent's tag, which is what that
 * chip means: the Vidya and Venkat rows are on her side too, and the chip has
 * to leave them out.
 */
const summary: GuestSummaryEntry[] = [
  { name: 'Vidya Yes', tag: 'vidya', side: 'anupama', events: 'SMR', status: 'attending' },
  { name: 'Vidya No', tag: 'vidya', side: 'anupama', events: 'MR', status: 'declined' },
  { name: 'Vidya Silent', tag: 'vidya', side: 'anupama', events: 'M', status: 'none' },
  { name: 'Venkat Yes', tag: 'venkat', side: 'anupama', events: 'SMR', status: 'attending' },
  { name: 'Venkat No', tag: 'venkat', side: 'anupama', events: 'MR', status: 'declined' },
  { name: 'Venkat Silent', tag: 'venkat', side: 'anupama', events: 'M', status: 'none' },
  { name: 'Anupama Yes', side: 'anupama', events: 'SMR', status: 'attending' },
  { name: 'Anupama No', side: 'anupama', events: 'MR', status: 'declined' },
  { name: 'Anupama Silent', side: 'anupama', events: 'M', status: 'none' },
  { name: 'Jackson Yes', side: 'jackson', events: 'SMR', status: 'attending' },
  { name: 'Jackson No', side: 'jackson', events: 'SMR', status: 'declined' },
  { name: 'Jackson Silent', side: 'jackson', events: 'SMR', status: 'none' },
]

const setUnlock = (
  status: AdminUnlockStatus = 'locked',
  overrides: Partial<AdminUnlockState> = {},
) => {
  unlockState.current = {
    status,
    summary: status === 'unlocked' ? summary : [],
    kerala: null,
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

// Through the real layout, which is what supplies the roster on the outlet.
// The gate is AdminLayout's and is tested in AdminLayout.test.tsx; mounting it
// here is what puts this page past it.
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/guest-summary']}>
      <GuestScheduleProvider>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="guest-summary" element={<GuestSummary />} />
          </Route>
        </Routes>
      </GuestScheduleProvider>
    </MemoryRouter>,
  )

const asAdmin = () => setState({ status: 'identified', displayName: 'Anupama', isAdmin: true })

const guestTable = () => screen.getByRole('table')

/**
 * Select a chip, whatever the row was on.
 *
 * A bare click is no longer "select" — clicking the chip you are already on
 * releases it, which is how a row says "no filter". The page opens on No
 * Response, so a test that clicked it to select it would clear it instead.
 */
const choose = (name: string) => {
  const chip = screen.getByRole('button', { name })
  if (chip.getAttribute('aria-pressed') !== 'true') fireEvent.click(chip)
}

/** The name box. `type="search"` is what makes it a searchbox rather than a textbox. */
const searchBox = () => screen.getByRole('searchbox', { name: 'Search' })

/** Type into the name box, as one keystroke's worth of state change. */
const search = (query: string) => fireEvent.change(searchBox(), { target: { value: query } })

/**
 * The names on screen, in order.
 *
 * The name is each row's header cell, so this reads the column without having
 * to know anything about the four event cells and the button beside it.
 */
const listed = () => [...guestTable().querySelectorAll('tbody th')].map((cell) => cell.textContent)

/** Names grouped as the page draws them: one array per household, in order. */
const households = () =>
  [...guestTable().querySelectorAll('tbody')].map((group) =>
    [...group.querySelectorAll('th')].map((cell) => cell.textContent),
  )

/** The row for a guest, found by the name in its header cell. */
const rowFor = (name: string) =>
  [...guestTable().querySelectorAll<HTMLTableRowElement>('tbody tr')].find(
    (row) => row.querySelector('th')?.textContent === name,
  )!

/**
 * The classes on the box drawn around a guest's name — how a household is
 * outlined. An absolutely positioned span inside the header cell, so it can
 * stop short of the row's top and bottom edges without moving the name.
 */
const boxOf = (name: string) => rowFor(name).querySelector('th span[aria-hidden]')?.className ?? ''

/**
 * The four event cells of a row, not the Invite one beside them — that one
 * holds a copy button with an aria-hidden span of its own.
 */
const eventCells = (name: string) => [...rowFor(name).querySelectorAll('td')].slice(0, 4)

/**
 * What each state of a dot says in words. Duplicated from the page on purpose:
 * a test that imported DOTS could not tell four identically-worded marks apart,
 * which is the one thing worth pinning here.
 */
const SAYS = {
  attending: 'Attending ',
  declined: 'Not attending ',
  none: 'No response for ',
  uninvited: 'Not invited to ',
} as const

/**
 * What a row's four event cells claim, read off the screen-reader text rather
 * than the colour. That line is the row's actual claim, and it is what a guest's
 * family would be told if anyone ran this page through a reader.
 */
const answers = (name: string) =>
  eventCells(name).map((cell) => {
    const text = cell.querySelector('.sr-only')?.textContent ?? ''
    const found = Object.entries(SAYS).find(([, prefix]) => text.startsWith(prefix))
    if (!found) throw new Error(`no dot state in '${text}'`)
    return { state: found[0] as keyof typeof SAYS, label: text.slice(found[1].length) }
  })

/** The classes on each of a row's four marks — the shape and fill, nothing else. */
const marksOf = (name: string) =>
  eventCells(name).map((cell) => cell.querySelector('[aria-hidden]')!.className)

/**
 * The per-event breakdown under the guest count, or null when no event chip is
 * pressed and the page draws none.
 *
 * Found by the cohort line rather than by a test hook, and narrowed to a `p` so
 * the wrapper around it — whose text starts the same way and then runs on
 * through every event line — cannot match as well.
 */
const breakdown = () => {
  const line = screen.queryByText(/^\d+ invited to /, { selector: 'p' })
  if (!line) return null
  return {
    cohort: line.textContent ?? '',
    events: [...line.parentElement!.querySelectorAll('li')].map((item) =>
      (item.textContent ?? '').replace(/\s+/g, ' ').trim(),
    ),
  }
}

/** Which of the four event columns a row reads as invited to at all. */
const invitedTo = (name: string) =>
  answers(name)
    .filter(({ state: dot }) => dot !== 'uninvited')
    .map(({ label }) => label)

describe('GuestSummary filters', () => {
  beforeEach(() => {
    asAdmin()
    setUnlock('unlocked')
  })

  it('opens on everyone who has not responded', () => {
    // The list worth acting on. Attending and declined are both settled.
    renderPage()

    expect(listed()).toEqual(['Vidya Silent', 'Venkat Silent', 'Anupama Silent', 'Jackson Silent'])
  })

  it.each([
    // Anupama's chip is her side less the two lists within it, so none of the
    // Vidya or Venkat rows may appear under it.
    ['Anupama', 'Attending', ['Anupama Yes']],
    ['Anupama', 'Not Attending', ['Anupama No']],
    ['Anupama', 'No Response', ['Anupama Silent']],
    ['Jackson', 'Attending', ['Jackson Yes']],
    ['Jackson', 'Not Attending', ['Jackson No']],
    ['Jackson', 'No Response', ['Jackson Silent']],
    ['Vidya', 'Attending', ['Vidya Yes']],
    ['Vidya', 'Not Attending', ['Vidya No']],
    ['Vidya', 'No Response', ['Vidya Silent']],
    ['Venkat', 'Attending', ['Venkat Yes']],
    ['Venkat', 'Not Attending', ['Venkat No']],
    ['Venkat', 'No Response', ['Venkat Silent']],
  ])('lists %s / %s', (side, status, expected) => {
    renderPage()

    choose(side)
    choose(status)

    expect(listed()).toEqual(expected)
  })

  it.each([
    ['Attending', ['Vidya Yes', 'Venkat Yes', 'Anupama Yes', 'Jackson Yes']],
    ['Not Attending', ['Vidya No', 'Venkat No', 'Anupama No', 'Jackson No']],
    ['No Response', ['Vidya Silent', 'Venkat Silent', 'Anupama Silent', 'Jackson Silent']],
  ])('lists every list at once under %s when no list is chosen', (status, expected) => {
    // What the Everyone chip used to do. It is now the state the Guest list row
    // starts in and returns to, rather than a fifth option beside four lists.
    renderPage()

    choose(status)

    expect(listed()).toEqual(expected)
  })

  it('releases the guest list chip you are already on', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Venkat' }))
    expect(listed()).toEqual(['Venkat Silent'])

    fireEvent.click(screen.getByRole('button', { name: 'Venkat' }))

    expect(screen.getByRole('button', { name: 'Venkat' })).toHaveAttribute('aria-pressed', 'false')
    expect(listed()).toEqual(['Vidya Silent', 'Venkat Silent', 'Anupama Silent', 'Jackson Silent'])
  })

  it('shows all three answers at once when the RSVP chip is released', () => {
    // The thing the row could not do while it had no "any" option: a guest
    // whose answer you do not know took three clicks to find.
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'No Response' }))

    expect(screen.getByRole('button', { name: 'No Response' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(listed()).toEqual(summary.map((entry) => entry.name))
  })

  it('shows the whole roster with both rows released', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'No Response' }))
    fireEvent.click(screen.getByRole('button', { name: 'Jackson' }))
    fireEvent.click(screen.getByRole('button', { name: 'Jackson' }))

    expect(listed()).toEqual(summary.map((entry) => entry.name))
    expect(screen.getByText('12 guests')).toBeInTheDocument()
  })

  it('counts what is on screen', () => {
    renderPage()

    expect(screen.getByText('4 guests')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Vidya' }))
    // Singular, because '1 guests' on a page built for one person to read all
    // day is the kind of thing that gets noticed.
    expect(screen.getByText('1 guest')).toBeInTheDocument()
  })

  it('says what each row of chips filters on', () => {
    // The chips in a heap said nothing about which of them answered which
    // question. The label names the group, and names it to a screen reader too.
    renderPage()

    const rows = screen.getAllByRole('group')
    expect(rows.map((row) => row.getAttribute('aria-label') ?? row.textContent)).toEqual([
      'Guest listAnupamaJacksonVidyaVenkat',
      'EventPellikuthuruSangeetMuhurthamReception',
      'RSVPAttendingNot AttendingNo Response',
    ])
    expect(screen.getByRole('group', { name: 'Guest list' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Event' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'RSVP' })).toBeInTheDocument()
    // Event sits between the other two because it scopes the one below it: with
    // a chip pressed there, the three answers underneath stop being the guest's
    // one verdict and become their answer about those events.
    //
    // The search box is a fourth control and deliberately not a fourth group —
    // one input has nothing to group with, and the groups on the page stay the
    // questions the chips ask.
    expect(rows).toHaveLength(3)
    expect(searchBox()).toBeInTheDocument()
  })

  it('marks the active chip in each row', () => {
    renderPage()

    // Nothing is pressed on the Guest list row until something is chosen; the
    // row opens empty rather than on a chip that means "no filter".
    // The Event row opens empty for the same reason, and that is what keeps
    // this an addition to the page rather than a change of default.
    for (const chip of ['Anupama', 'Jackson', 'Vidya', 'Venkat', 'Sangeet', 'Muhurtham']) {
      expect(screen.getByRole('button', { name: chip })).toHaveAttribute('aria-pressed', 'false')
    }
    expect(screen.getByRole('button', { name: 'No Response' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Venkat' }))
    expect(screen.getByRole('button', { name: 'Venkat' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Vidya' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Muhurtham' }))
    expect(screen.getByRole('button', { name: 'Muhurtham' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('offers a hover cue on the chip you are already on', () => {
    // The chip you are on is the one you press to clear the filter, so it is
    // the last chip on the row that should look inert under the pointer. It
    // used to be the only one that did.
    //
    // These chips ask for the cue; the nav bars sharing chipClass do not, since
    // their current chip leads to the page you are already on. SectionNav's
    // own test holds the other half of that pair.
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Venkat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Muhurtham' }))

    expect(screen.getByRole('button', { name: 'Venkat' }).className).toContain('hover:bg-')
    expect(screen.getByRole('button', { name: 'Vidya' }).className).toContain('hover:bg-')
    // The Event chips promise the same gesture — pressing one again releases it
    // — so they ask for the same cue.
    expect(screen.getByRole('button', { name: 'Muhurtham' }).className).toContain('hover:bg-')
    expect(screen.getByRole('button', { name: 'Reception' }).className).toContain('hover:bg-')
  })

  it('keeps the two filters independent', () => {
    // Changing side must not reset the answer, or every look at the other
    // family starts over from the default.
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Attending' }))
    fireEvent.click(screen.getByRole('button', { name: 'Venkat' }))

    expect(listed()).toEqual(['Venkat Yes'])
  })

  it('shows a guest with no side only while no list is chosen', () => {
    // What an index built before `side` existed looks like: this bundle and
    // schedule-index.json deploy separately, so for a moment the index in front
    // of the page is a version behind. An empty Guest list row still finds
    // them, which beats filing them under a list that is not theirs.
    setUnlock('unlocked', { summary: [{ name: 'Unsynced Guest', status: 'none' }] })
    renderPage()

    expect(listed()).toEqual(['Unsynced Guest'])

    for (const chip of ['Anupama', 'Jackson', 'Vidya', 'Venkat']) {
      fireEvent.click(screen.getByRole('button', { name: chip }))
      expect(screen.getByText('0 guests')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: chip }))
      expect(listed()).toEqual(['Unsynced Guest'])
    }
  })

  it('says so plainly when a combination is empty', () => {
    setUnlock('unlocked', { summary: [{ name: 'Vidya Yes', tag: 'vidya', status: 'attending' }] })
    renderPage()

    expect(screen.getByText('0 guests')).toBeInTheDocument()
    expect(screen.getByText('Nobody on this list right now.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('blames the name, not the list, when a search finds nobody', () => {
    // Two different disappointments. "Nobody on this list" is wrong when the
    // list is full and the spelling is what missed, and echoing the query back
    // is what catches the typo.
    renderPage()

    search('Meitner')

    expect(screen.getByText('0 guests')).toBeInTheDocument()
    expect(screen.getByText('Nobody matching “Meitner”.')).toBeInTheDocument()
    expect(screen.queryByText('Nobody on this list right now.')).not.toBeInTheDocument()
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

  it('draws a household as one tinted block, and a lone guest as a plain row', () => {
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
    // The grouping is a box drawn around the name cells, so the box-shadow is
    // the only thing there is to assert on.
    // Ends inset and rounded; the middle runs edge to edge so the sides join up
    // into one box rather than three stacked ones.
    expect(boxOf('Ama Household')).toContain('top-1.5 rounded-t-xl')
    expect(boxOf('Ama Household')).toContain('bottom-0 border-b-0')
    expect(boxOf('Bo Household')).toContain('top-0 border-t-0')
    expect(boxOf('Bo Household')).toContain('bottom-0 border-b-0')
    expect(boxOf('Cy Household')).toContain('bottom-1.5 rounded-b-xl')
    expect(boxOf('Solo Traveller')).toBe('')

    // Only the names are boxed. Around the whole row it read as a banded table.
    const rest = [...rowFor('Ama Household').querySelectorAll('td')].map(
      (cell) => (cell as HTMLElement).style.boxShadow,
    )
    expect(rest).toEqual(['', '', '', '', ''])
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
    expect(boxOf('Ama Split')).toContain('border-gold/50')
  })

  it('drops the tint when a filter leaves one member of a household', () => {
    // A block around a single name says nothing.
    setUnlock('unlocked', {
      summary: [
        { name: 'Ama Alone', status: 'none', party: 9 },
        { name: 'Bo Alone', status: 'attending', party: 9 },
      ],
    })
    renderPage()

    expect(households()).toEqual([['Ama Alone']])
    expect(boxOf('Ama Alone')).toBe('')
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
})

describe('GuestSummary search', () => {
  beforeEach(() => {
    asAdmin()
    setUnlock('unlocked')
  })

  it('narrows the list to the names that match', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Attending' }))
    search('venkat')

    expect(listed()).toEqual(['Venkat Yes'])
    expect(screen.getByText('1 guest')).toBeInTheDocument()
  })

  it('matches on part of a name, from anywhere in it', () => {
    // Nobody types a full name to find someone. Surname-first is the common
    // case, and the roster is stored first-name-first.
    renderPage()

    search('sil')

    expect(listed()).toEqual(['Vidya Silent', 'Venkat Silent', 'Anupama Silent', 'Jackson Silent'])
  })

  it('ignores case, accents and punctuation', () => {
    // fold() is the same normaliser the generator matches names with, so the
    // box behaves like the rest of the site rather than like a raw includes().
    setUnlock('unlocked', {
      summary: [{ name: 'Émilie du Châtelet-Fermi', status: 'none' }],
    })
    renderPage()

    for (const query of ['emilie', 'ÉMILIE', 'chatelet', 'Châtelet', 'chatelet fermi']) {
      search(query)
      expect(listed()).toEqual(['Émilie du Châtelet-Fermi'])
    }
  })

  it('keeps the rest of a matched guest’s household on screen', () => {
    // A party outline drawn around one of three names reads as a bug. Matching
    // one member is a good enough reason to show the household.
    setUnlock('unlocked', {
      summary: [
        { name: 'Ada Lovelace', status: 'none', party: 2 },
        { name: 'Grace Hopper', status: 'none', party: 2 },
        { name: 'Alan Turing', status: 'none' },
      ],
    })
    renderPage()

    search('hopper')

    expect(households()).toEqual([['Ada Lovelace', 'Grace Hopper']])
    expect(boxOf('Ada Lovelace')).toContain('border-gold/50')
    expect(screen.getByText('2 guests')).toBeInTheDocument()
  })

  it('does not pull a housemate back past the chips', () => {
    // The household is drawn from what the chips left, not from the roster.
    // Otherwise a search on a "who has not responded" list quietly reintroduces
    // the member who already answered.
    setUnlock('unlocked', {
      summary: [
        { name: 'Vera Rubin', status: 'none', party: 5 },
        { name: 'Carl Sagan', status: 'attending', party: 5 },
      ],
    })
    renderPage()

    search('rubin')

    expect(listed()).toEqual(['Vera Rubin'])
  })

  it('narrows within the chips rather than reaching past them', () => {
    // An AND. A name the chips exclude stays excluded, so the count line can
    // never claim a guest who is not on the chosen list.
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Vidya' }))
    search('jackson')

    expect(screen.getByText('0 guests')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Vidya' }))
    expect(listed()).toEqual(['Jackson Silent'])
  })

  it('gives the whole list back when the box is cleared', () => {
    renderPage()

    search('anupama')
    expect(listed()).toEqual(['Anupama Silent'])

    search('')

    expect(listed()).toEqual(['Vidya Silent', 'Venkat Silent', 'Anupama Silent', 'Jackson Silent'])
  })

  it('ignores a box holding nothing but spaces', () => {
    // fold() reduces it to the empty string, which is the no-query case — not a
    // query that matches every name by accident.
    renderPage()

    search('   ')

    expect(listed()).toEqual(['Vidya Silent', 'Venkat Silent', 'Anupama Silent', 'Jackson Silent'])
    expect(screen.queryByText(/Nobody/)).not.toBeInTheDocument()
  })
})

describe('GuestSummary invitations', () => {
  beforeEach(() => {
    asAdmin()
    setUnlock('unlocked', {
      summary: [
        // The two 'Full' rows carry the pellikuthuru as well, which is what
        // makes them the proof that the copy link ignores it: 'PSMR' and 'SMR'
        // are the same invitation, because no page is narrowed by that event.
        { name: 'Full Tadanki', side: 'anupama', events: 'PSMR', status: 'none' },
        { name: 'Reception Tadanki', side: 'anupama', events: 'MR', status: 'none' },
        { name: 'Muhurtham Tadanki', side: 'anupama', events: 'M', status: 'none' },
        { name: 'Full Wearn', side: 'jackson', events: 'PSMR', status: 'none' },
      ],
    })
  })

  it('pins the column headings under the bars above them', () => {
    // 352 rows: without this the headings are gone by the third screenful and
    // the S/M/R columns stop meaning anything.
    renderPage()

    const head = guestTable().querySelector('thead')!
    expect(head.className).toContain('sticky')
    // Under SiteNav *and* SectionNav, until SectionNav hides on the way down.
    expect(head.getAttribute('style')).toContain('8rem')
    for (const cell of head.querySelectorAll('th')) expect(cell.className).toContain('sticky')
  })

  it('keeps the copy button the same width once it says Copied', () => {
    // The button sits in a table column; re-widthing it shunts every other
    // column sideways for the 1.5s the confirmation is up.
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn() } })
    renderPage()

    const button = within(rowFor('Full Tadanki')).getByRole('button')
    expect(button.textContent).toBe('CopiedCopy')

    fireEvent.click(button)

    expect(button.textContent).toBe('CopiedCopied')
  })

  it('names the four events in both widths', () => {
    // The letters are the mobile column headings and the words are the desktop
    // ones; both are always in the DOM, and CSS picks.
    renderPage()

    const headers = [...guestTable().querySelectorAll('thead th')].map((cell) => cell.textContent)
    expect(headers).toEqual([
      'Name',
      'PPellikuthuru',
      'SSangeet',
      'MMuhurtham',
      'RReception',
      'Invite',
    ])
  })

  it('says which events each guest is invited to', () => {
    renderPage()

    expect(invitedTo('Full Tadanki')).toEqual(['Pellikuthuru', 'Sangeet', 'Muhurtham', 'Reception'])
    expect(invitedTo('Reception Tadanki')).toEqual(['Muhurtham', 'Reception'])
    expect(invitedTo('Muhurtham Tadanki')).toEqual(['Muhurtham'])
  })

  it('lights up the row under the pointer, and the one holding focus', () => {
    // CSS-only, so the class is all there is to assert on here; the rendered
    // colour is checked in the browser.
    renderPage()

    expect(rowFor('Full Tadanki').className).toContain('hover:bg-lily/15')
    expect(rowFor('Full Tadanki').className).toContain('focus-within:bg-lily/15')
    // Not the heading row — it is pinned and opaque, and has nothing to select.
    expect(guestTable().querySelector('thead tr')!.className).toBe('')
  })

  it('marks the events with a dot rather than repeating the letter', () => {
    // The heading already says which event the column is; 352 rows spelling it
    // out again is noise. None of these four has answered, so the invited
    // events are all the same mark and the uninvited one is not.
    renderPage()

    expect(new Set(marksOf('Reception Tadanki')).size).toBe(2)
    expect(new Set(marksOf('Full Tadanki')).size).toBe(1)
    // The mark carries no text; the letter survives only in the column heading.
    for (const cell of eventCells('Full Tadanki'))
      expect(cell.querySelector('[aria-hidden]')!.textContent).toBe('')
  })

  it.each([
    ['Full Tadanki', '/invites/tadanki/'],
    ['Reception Tadanki', '/invites/tadanki/reception/'],
    ['Muhurtham Tadanki', '/invites/tadanki/muhurtham/'],
    ['Full Wearn', '/invites/wearn/'],
  ])('offers %s their own invitation', (name, path) => {
    renderPage()

    // The absolute URL, not the relative path: this is copied to be pasted
    // into a message, where a relative path means nothing.
    expect(within(rowFor(name)).getByRole('button')).toHaveAttribute(
      'aria-label',
      `Copy ${SITE_ORIGIN}${path}`,
    )
  })

  it('copies the invitation to the clipboard', () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    renderPage()

    fireEvent.click(within(rowFor('Reception Tadanki')).getByRole('button'))

    expect(writeText).toHaveBeenCalledWith(`${SITE_ORIGIN}/invites/tadanki/reception/`)
    expect(within(rowFor('Reception Tadanki')).getByRole('button')).toHaveAttribute(
      'aria-label',
      'Link copied',
    )
  })

  it('shows a dash rather than a link for a guest the index cannot place', () => {
    // The sync fails rather than publish one of these, but this bundle and
    // schedule-index.json deploy separately — so between the two the page is
    // reading entries that have neither field, and it has to render something.
    setUnlock('unlocked', { summary: [{ name: 'Unsynced Guest', status: 'none' }] })
    renderPage()

    expect(within(rowFor('Unsynced Guest')).queryByRole('button')).not.toBeInTheDocument()
    expect(invitedTo('Unsynced Guest')).toEqual([])
    expect(rowFor('Unsynced Guest').textContent).toContain('—')
  })
})

describe('GuestSummary attendance', () => {
  beforeEach(() => {
    asAdmin()
    setUnlock('unlocked', {
      summary: [
        {
          name: 'Grace Hopper',
          side: 'anupama',
          events: 'PSMR',
          attending: 'PSMR',
          status: 'attending',
        },
        // The row the whole thing exists for: coming to one, not to another,
        // and silent on the third.
        {
          name: 'Ada Lovelace',
          side: 'anupama',
          events: 'PSMR',
          attending: 'PM',
          declined: 'R',
          status: 'attending',
        },
        { name: 'Alan Turing', side: 'anupama', events: 'MR', declined: 'MR', status: 'declined' },
        { name: 'Vera Rubin', side: 'anupama', events: 'M', status: 'none' },
      ],
    })
  })

  /**
   * Clear the RSVP row. The page opens on No Response, and three of these four
   * have answered — clicking the chip you are already on is how a row says
   * "no filter", which is the opposite of what `choose` does.
   */
  const showEveryone = () => fireEvent.click(screen.getByRole('button', { name: 'No Response' }))

  it('colours each dot by the answer to that event, not by the guest', () => {
    // Ada is 'attending' as a whole guest and still has a decline among her
    // three dots. Reading her row off her verdict would paint all three green
    // and lose the only thing on it worth knowing.
    renderPage()
    showEveryone()

    const states = (name: string) => answers(name).map(({ state: dot }) => dot)

    expect(states('Ada Lovelace')).toEqual(['attending', 'none', 'attending', 'declined'])
    expect(states('Grace Hopper')).toEqual(['attending', 'attending', 'attending', 'attending'])
    expect(states('Alan Turing')).toEqual(['uninvited', 'uninvited', 'declined', 'declined'])
    expect(states('Vera Rubin')).toEqual(['uninvited', 'uninvited', 'none', 'uninvited'])
  })

  it('keeps the four states visibly apart', () => {
    // Which colour each one is belongs to the eye, not to a test. That no two
    // are the same mark does not — with four states and three colours the page
    // would be lying about one of them.
    renderPage()
    showEveryone()

    expect(
      new Set(['Grace Hopper', 'Ada Lovelace', 'Alan Turing', 'Vera Rubin'].flatMap(marksOf)).size,
    ).toBe(4)
  })

  it('says the answer in words beside the mark', () => {
    // The colour is the whole message for everyone else, so this line has to
    // carry all four states on its own rather than only naming the invitation.
    renderPage()
    showEveryone()

    expect(
      eventCells('Ada Lovelace').map((cell) => cell.querySelector('.sr-only')!.textContent),
    ).toEqual([
      'Attending Pellikuthuru',
      'No response for Sangeet',
      'Attending Muhurtham',
      'Not attending Reception',
    ])
  })

  it('reads an index built before the answers existed as no response, not as a no', () => {
    // This bundle and schedule-index.json deploy separately, so between
    // shipping the JS and the next sync every entry the page sees has neither
    // field. Grey says "we have not heard", which is true of that index; red
    // would be the page inventing a decline for 649 people at once.
    setUnlock('unlocked', {
      summary: [{ name: 'Emmy Noether', side: 'anupama', events: 'PSMR', status: 'attending' }],
    })
    renderPage()
    showEveryone()

    expect(answers('Emmy Noether').map(({ state: dot }) => dot)).toEqual([
      'none',
      'none',
      'none',
      'none',
    ])
  })

  it('keys the marks it draws', () => {
    // Four marks nobody chose to learn, on a table whose headings only say
    // which event each column is.
    renderPage()
    showEveryone()

    const legend = screen.getByRole('list')
    // The three answers in the same order as the RSVP chips above them, which
    // is the whole reason the order is worth asserting: the two rows say almost
    // the same words a few pixels apart, and a reader lines them up.
    expect([...legend.querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      'Dots:',
      'Attending',
      'Not attending',
      'No response',
      'Not invited',
    ])
    expect(
      [...screen.getByRole('group', { name: 'RSVP' }).querySelectorAll('button')].map(
        (chip) => chip.textContent,
      ),
    ).toEqual(['Attending', 'Not Attending', 'No Response'])
    // Every mark in the key is one the table actually draws, and every mark the
    // table draws is in the key — a legend that keys three of four states would
    // be worse than none.
    const keyed = [...legend.querySelectorAll('li [aria-hidden]')].map((mark) => mark.className)
    const drawn = ['Grace Hopper', 'Ada Lovelace', 'Alan Turing', 'Vera Rubin'].flatMap(marksOf)
    expect(new Set(keyed)).toEqual(new Set(drawn))
  })
})

describe('GuestSummary event filter', () => {
  beforeEach(() => {
    asAdmin()
    setUnlock('unlocked', {
      summary: [
        // Invited to everything and coming to everything.
        {
          name: 'Ada Lovelace',
          side: 'anupama',
          events: 'PSMR',
          attending: 'PSMR',
          status: 'attending',
        },
        // The disagreement the chips exist for: 'attending' as a whole guest,
        // and a decline sitting inside it.
        {
          name: 'Grace Hopper',
          side: 'anupama',
          events: 'PSMR',
          attending: 'PSM',
          declined: 'R',
          status: 'attending',
        },
        // Invited to both and silent about both — the phone call worth making.
        { name: 'Alan Turing', side: 'jackson', events: 'MR', status: 'none' },
        // Invited to both, has answered about one. Under OR she would join Alan
        // on the 'no response' list, which is the reading the AND rules out.
        { name: 'Vera Rubin', side: 'jackson', events: 'MR', attending: 'M', status: 'attending' },
        // Never asked about the reception, so it must never claim her.
        { name: 'Emmy Noether', side: 'jackson', events: 'M', declined: 'M', status: 'declined' },
        // An index built before the answers existed: no events, no answers.
        { name: 'Carl Sagan', side: 'jackson', status: 'none' },
      ],
    })
  })

  /** Clear the RSVP row, which opens on No Response. */
  const showEveryone = () => fireEvent.click(screen.getByRole('button', { name: 'No Response' }))

  const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

  it('opens with no event pressed, on the whole-guest reading', () => {
    // The row is an addition to the page, not a change of default: the page
    // still lands on everyone who has answered nothing at all, and draws no
    // breakdown until an event is asked about.
    renderPage()

    for (const chip of ['Pellikuthuru', 'Sangeet', 'Muhurtham', 'Reception']) {
      expect(screen.getByRole('button', { name: chip })).toHaveAttribute('aria-pressed', 'false')
    }
    expect(listed()).toEqual(['Alan Turing', 'Carl Sagan'])
    expect(breakdown()).toBeNull()
  })

  it('narrows to the guests invited to the chosen event', () => {
    renderPage()
    showEveryone()
    press('Reception')

    // Emmy was never asked about the reception and Carl's index is too old to
    // say he was asked about anything. Neither belongs on a reception list.
    expect(listed()).toEqual(['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Vera Rubin'])
  })

  it('answers about the event, not about the guest', () => {
    // Grace is 'attending' as a whole guest and has declined the reception.
    // The RSVP row alone could never find her; that is the whole point.
    renderPage()
    press('Reception')
    choose('Not Attending')

    expect(listed()).toEqual(['Grace Hopper'])

    choose('Attending')
    expect(listed()).toEqual(['Ada Lovelace'])

    choose('No Response')
    expect(listed()).toEqual(['Alan Turing', 'Vera Rubin'])
  })

  it('presses events independently rather than one at a time', () => {
    renderPage()

    press('Muhurtham')
    press('Reception')
    const pressed = () =>
      ['Pellikuthuru', 'Sangeet', 'Muhurtham', 'Reception'].filter(
        (chip) =>
          screen.getByRole('button', { name: chip }).getAttribute('aria-pressed') === 'true',
      )
    expect(pressed()).toEqual(['Muhurtham', 'Reception'])

    // And pressing a pressed one releases just that one, the way the other two
    // rows release the chip you are already on.
    press('Muhurtham')
    expect(pressed()).toEqual(['Reception'])
  })

  it('combines several events with AND, on the invitation and on the answer', () => {
    renderPage()
    showEveryone()
    press('Muhurtham')
    press('Reception')

    // Invited to both. Emmy carries the muhurtham alone, so an OR would keep
    // her here and put a reception answer beside a question nobody asked her.
    expect(listed()).toEqual(['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Vera Rubin'])

    // Silent on both. Vera has answered the muhurtham, so she owes one reply
    // rather than two and this is not her list.
    choose('No Response')
    expect(listed()).toEqual(['Alan Turing'])
  })

  it('gives the whole-guest reading back when the last event is released', () => {
    renderPage()
    press('Reception')
    press('Reception')

    expect(listed()).toEqual(['Alan Turing', 'Carl Sagan'])
    expect(breakdown()).toBeNull()
  })

  it('breaks the cohort down by event, in the table’s order', () => {
    renderPage()
    showEveryone()
    // Pressed out of order on purpose: the lines still come out in the order
    // the columns run, so the breakdown can be read against the dots.
    press('Reception')
    press('Muhurtham')

    expect(breakdown()).toEqual({
      cohort: '4 invited to the Muhurtham and the Reception',
      events: [
        'Muhurtham — 3 attending · 0 not attending · 1 no response',
        'Reception — 1 attending · 1 not attending · 2 no response',
      ],
    })
  })

  it('holds the breakdown still while the RSVP row moves', () => {
    // The three numbers describe the event. Counted off the rows on screen they
    // would describe the chip instead, and 'Not Attending' would report nought
    // attending — which is true of the list and false about the reception.
    renderPage()
    showEveryone()
    press('Reception')

    const released = breakdown()
    choose('Not Attending')
    expect(listed()).toEqual(['Grace Hopper'])
    expect(breakdown()).toEqual(released)
  })

  it('follows the guest list chip and the search box', () => {
    // A breakdown counting people the other chips say are not on this list
    // would be a lie about the list you are reading.
    renderPage()
    showEveryone()
    press('Reception')
    choose('Jackson')

    expect(breakdown()).toEqual({
      cohort: '2 invited to the Reception',
      events: ['Reception — 0 attending · 0 not attending · 2 no response'],
    })

    choose('Jackson')
    search('vera')
    expect(breakdown()).toEqual({
      cohort: '1 invited to the Reception',
      events: ['Reception — 0 attending · 0 not attending · 1 no response'],
    })
  })

  it('lets no event claim a guest whose index predates the answers', () => {
    // Carl's record has no `events` at all, which reads as invited to nothing.
    // Every chip has to leave him out rather than file him under an answer he
    // was never asked for.
    renderPage()
    showEveryone()

    for (const chip of ['Pellikuthuru', 'Sangeet', 'Muhurtham', 'Reception']) {
      press(chip)
      expect(listed()).not.toContain('Carl Sagan')
      press(chip)
    }

    expect(listed()).toContain('Carl Sagan')
  })
})
