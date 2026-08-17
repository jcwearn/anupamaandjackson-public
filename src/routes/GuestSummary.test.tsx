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
 * The names on screen, in order.
 *
 * The name is each row's header cell, so this reads the column without having
 * to know anything about the three event cells and the button beside it.
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
 * Which of the three event columns a row reads as invited to.
 *
 * Both states render the letter — a blank cell reads as missing data where a
 * faint one reads as a no — so this goes by the screen-reader text, which is
 * the row's actual claim rather than its opacity.
 */
const invitedTo = (name: string) =>
  [...rowFor(name).querySelectorAll('td')]
    .map((cell) => cell.querySelector('.sr-only')?.textContent ?? '')
    .filter((label) => label.startsWith('Invited to'))
    .map((label) => label.replace('Invited to ', ''))

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
    ['Everyone', 'Attending', ['Vidya Yes', 'Venkat Yes', 'Anupama Yes', 'Jackson Yes']],
    ['Everyone', 'Not Attending', ['Vidya No', 'Venkat No', 'Anupama No', 'Jackson No']],
    [
      'Everyone',
      'No Response',
      ['Vidya Silent', 'Venkat Silent', 'Anupama Silent', 'Jackson Silent'],
    ],
    // Anupama's chip is her side less the two lists within it, so none of the
    // Vidya or Venkat rows above may appear under it.
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

    fireEvent.click(screen.getByRole('button', { name: side }))
    fireEvent.click(screen.getByRole('button', { name: status }))

    expect(listed()).toEqual(expected)
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
      'Guest listEveryoneAnupamaJacksonVidyaVenkat',
      'RSVPAttendingNot AttendingNo Response',
    ])
    expect(screen.getByRole('group', { name: 'Guest list' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'RSVP' })).toBeInTheDocument()
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

  it('shows a guest with no side under Everyone and nowhere else', () => {
    // What an index built before `side` existed looks like: this bundle and
    // schedule-index.json deploy separately, so for a moment the index in front
    // of the page is a version behind. Everyone still finds them, which beats
    // filing them under a list that is not theirs.
    setUnlock('unlocked', { summary: [{ name: 'Unsynced Guest', status: 'none' }] })
    renderPage()

    expect(listed()).toEqual(['Unsynced Guest'])

    for (const chip of ['Anupama', 'Jackson', 'Vidya', 'Venkat']) {
      fireEvent.click(screen.getByRole('button', { name: chip }))
      expect(screen.getByText('0 guests')).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole('button', { name: 'Everyone' }))
    expect(listed()).toEqual(['Unsynced Guest'])
  })

  it('says so plainly when a combination is empty', () => {
    setUnlock('unlocked', { summary: [{ name: 'Vidya Yes', tag: 'vidya', status: 'attending' }] })
    renderPage()

    expect(screen.getByText('0 guests')).toBeInTheDocument()
    expect(screen.getByText('Nobody on this list right now.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
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
    expect(rest).toEqual(['', '', '', ''])
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

describe('GuestSummary invitations', () => {
  beforeEach(() => {
    asAdmin()
    setUnlock('unlocked', {
      summary: [
        { name: 'Full Tadanki', side: 'anupama', events: 'SMR', status: 'none' },
        { name: 'Reception Tadanki', side: 'anupama', events: 'MR', status: 'none' },
        { name: 'Muhurtham Tadanki', side: 'anupama', events: 'M', status: 'none' },
        { name: 'Full Wearn', side: 'jackson', events: 'SMR', status: 'none' },
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

  it('names the three events in both widths', () => {
    // The letters are the mobile column headings and the words are the desktop
    // ones; both are always in the DOM, and CSS picks.
    renderPage()

    const headers = [...guestTable().querySelectorAll('thead th')].map((cell) => cell.textContent)
    expect(headers).toEqual(['Name', 'SSangeet', 'MMuhurtham', 'RReception', 'Invite'])
  })

  it('says which events each guest is invited to', () => {
    renderPage()

    expect(invitedTo('Full Tadanki')).toEqual(['Sangeet', 'Muhurtham', 'Reception'])
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
    // out again is noise. Filled for yes, hollow for no.
    renderPage()

    // The three event cells, not the Invite one beside them — its copy button
    // has an aria-hidden span of its own.
    const eventCells = (name: string) => [...rowFor(name).querySelectorAll('td')].slice(0, 3)
    const dots = (name: string) =>
      eventCells(name).map((cell) =>
        cell.querySelector('[aria-hidden]')!.className.includes('bg-fern') ? 'filled' : 'hollow',
      )

    expect(dots('Reception Tadanki')).toEqual(['hollow', 'filled', 'filled'])
    expect(dots('Full Tadanki')).toEqual(['filled', 'filled', 'filled'])
    // The dot carries no text; the letter survives only in the column heading.
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
