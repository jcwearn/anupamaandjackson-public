import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminKeralaTrip from './AdminKeralaTrip'
import AdminLayout from '../layouts/AdminLayout'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { universalEvents } from '../data/scheduleEvents'
import type { GuestScheduleState } from '../lib/useGuestSchedule'
import type { AdminUnlockState, AdminUnlockStatus, KeralaTrip } from '../lib/adminUnlock'
import type { TableImageSpec } from '../lib/tableImage'
import { NO_BED_ASKED } from '../lib/keralaTripSummary'

const state = vi.hoisted(() => ({ current: null as GuestScheduleState | null }))
const unlockState = vi.hoisted(() => ({ current: null as AdminUnlockState | null }))

vi.mock('../lib/useGuestSchedule', () => ({
  useGuestSchedule: () => state.current,
}))

// The passphrase layer is stubbed, as it is on the other two tools; its crypto
// is the subject of adminUnlock.test.tsx. What matters here is the arithmetic
// the page does with what comes out of it.
vi.mock('../lib/adminUnlock', () => ({
  useAdminUnlock: () => unlockState.current,
}))

// jsdom has no 2D canvas context, so the real drawing cannot run here; it is
// the subject of tableImage.test.ts, against a stubbed one. What this file
// cares about is that the button hands it the table that is on screen.
const downloadTableImage = vi.hoisted(() =>
  vi.fn<(spec: TableImageSpec, filename: string) => Promise<void>>(() => Promise.resolve()),
)
vi.mock('../lib/tableImage', () => ({ downloadTableImage }))

const writeText = vi.fn(() => Promise.resolve())

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

const setUnlock = (
  status: AdminUnlockStatus = 'locked',
  overrides: Partial<AdminUnlockState> = {},
) => {
  unlockState.current = {
    status,
    summary: [],
    kerala: null,
    unlock: vi.fn(),
    forget: vi.fn(),
    ...overrides,
  }
}

/**
 * A miniature of the real trip: two rooms that last the whole way, one that
 * loses a roommate on the final night, one that empties, and a single. Small
 * enough to check by hand, and it exercises every branch the real 24 rooms do.
 */
const kerala: KeralaTrip = {
  rooms: [
    {
      room: 1,
      bed: 'double',
      // Whose trip it is. Their two places are not money any guest owes.
      occupants: [
        { name: 'Ada Lovelace', trip: 'full', flight: 'rt', occupancy: 'double', host: true },
        { name: 'Grace Hopper', trip: 'full', flight: 'rt', occupancy: 'double', host: true },
      ],
    },
    {
      room: 2,
      bed: 'twin',
      occupants: [
        // One payment covering the room: $506 each, settling exactly.
        {
          name: 'Alan Turing',
          trip: 'full',
          flight: 'ow',
          occupancy: 'double',
          payment: { usd: 1012, to: 'anupama', via: 'zelle' },
        },
        {
          name: 'Vera Rubin',
          trip: 'full',
          flight: 'ow',
          occupancy: 'double',
          payment: { via: 'roommate', paidBy: 'Alan' },
        },
      ],
    },
    {
      room: 3,
      bed: 'twin',
      occupants: [
        {
          name: 'Carl Sagan',
          trip: 'full',
          flight: 'rt',
          occupancy: 'double',
          // Quoted and paid before the sole-use night was costed properly, so
          // what he paid and what the agent bills have come apart.
          priceOverride: 67440,
          soleUseNights: 1,
          // Asked $708, sent $710 — two dollars back to us.
          payment: { usd: 710, to: 'jackson', via: 'paypal' },
        },
        { name: 'Enrico Fermi', trip: 'short', flight: 'rt', occupancy: 'double' },
      ],
    },
    {
      room: 4,
      bed: 'double',
      occupants: [
        { name: 'Marie Curie', trip: 'short', flight: 'ow', occupancy: 'double' },
        { name: 'Lise Meitner', trip: 'short', flight: 'ow', occupancy: 'double' },
      ],
    },
    {
      room: 5,
      // Asked $944, sent $900 — forty-four dollars we absorb.
      occupants: [
        {
          name: 'Emmy Noether',
          trip: 'full',
          flight: 'rt',
          occupancy: 'single',
          payment: { usd: 900, to: 'anupama', via: 'venmo' },
        },
      ],
    },
  ],
  billing: {
    payments: [{ amount: 100000, note: 'Advance' }],
    schedule: [
      { due: '2026-09-05', pct: 40, note: '40% of the total' },
      { due: '2026-09-30', note: 'Balance' },
    ],
  },
}

/**
 * What the fixture comes to, spelled out from the rates so a changed rate card
 * breaks this in one place rather than drifting quietly.
 *
 * 2 × full/double/rt + 2 × full/double/ow + 1 short/double/rt + 2 ×
 * short/double/ow + 1 full/single/rt, and then Carl twice over: what the agent
 * bills for him against what he was quoted and has paid.
 */
const PLAIN = 56160 * 2 + 48192 * 2 + 41020 + 33052 * 2 + 90000
const AGENT_TOTAL = PLAIN + 56160 + 14000
// The two hosts are on full/double/rt, so their own places come out of what
// the guests owe and land in what we are covering, along with the shortfall.
const HOSTS = 56160 * 2
// Three payments: the room-2 pair settles exactly, room 3 overpaid by $2 and
// room 5 underpaid by $44. Settlement converts at the rate guests were quoted.
const TRANSFERRED = 1012 + 710 + 900
// Rounded the way the page rounds them: a dollar gap converts to a fractional
// number of rupees, and `inr` shows whole ones.
const SETTLEMENT = (44 - 2) * 95.31
const COVERED = Math.round(HOSTS + 2720 + SETTLEMENT)
const GUEST_TOTAL = Math.round(AGENT_TOTAL - (HOSTS + 2720 + SETTLEMENT))
// Enrico, Marie and Lise have sent nothing.
const TO_COLLECT = 430 + 347 + 347

beforeEach(() => {
  vi.clearAllMocks()
  setState({ status: 'identified', displayName: 'Anupama', isAdmin: true })
  setUnlock('unlocked', { kerala })
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
})

// Through the real provider and the real layout, with only the underlying hooks
// stubbed, so the page is reached the way it is in the app: past both gates.
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/kerala-trip']}>
      <GuestScheduleProvider>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="kerala-trip" element={<AdminKeralaTrip />} />
          </Route>
        </Routes>
      </GuestScheduleProvider>
    </MemoryRouter>,
  )

/**
 * The cells of the row whose heading is `head`, in order.
 *
 * `table` narrows the search when a heading is not unique on the page — both
 * rooming tables have a "Day 1 and 2" row, which is the whole point of them.
 */
const rowCells = (head: string, table?: string) => {
  const scope = table ? within(screen.getByRole('table', { name: table })) : screen
  return within(scope.getByRole('rowheader', { name: head }).closest('tr') as HTMLElement)
    .getAllByRole('cell')
    .map((cell) => cell.textContent)
}

/**
 * The figure beside a label in one of the money lists.
 *
 * Via `closest('dt')` rather than the label's own next sibling: an expandable
 * label is a button inside the dt, and has no sibling of its own.
 */
const moneyFor = (label: string | RegExp) =>
  screen.getByText(label).closest('dt')?.nextElementSibling

/**
 * The figure beside a name in the "you are covering" breakdown.
 *
 * Scoped to that list, because the room-by-room table names every guest too and
 * a bare text lookup would find whichever came first in the DOM.
 */
const coveredRow = (name: string) => {
  const list = screen.getByText('You are covering').closest('dl')
  return [...(list?.querySelectorAll('dt') ?? [])].find((dt) => dt.textContent?.startsWith(name))
    ?.nextElementSibling as HTMLElement | undefined
}

describe('rooming', () => {
  const ROOMS = 'Rooms needed on each set of nights'
  const BEDS = 'Bed type in the double-occupancy rooms'

  it('counts the rooms each set of nights needs', () => {
    renderPage()
    // Days 1-2: five rooms, four shared. Day 3: room 4 has emptied, and room 3
    // is down to one person, so it moves out of the double column and into the
    // single one.
    expect(rowCells('Day 1 and 2', ROOMS)).toEqual(['5', '4', '1'])
    expect(rowCells('Day 3', ROOMS)).toEqual(['4', '2', '2'])
  })

  it('splits the shared rooms by bed type', () => {
    renderPage()
    // Two columns, not three: the double-occupancy count is the table above's
    // to state, and repeating it here invited reading the row as a total.
    expect(rowCells('Day 1 and 2', BEDS)).toEqual(['2', '2'])
    expect(rowCells('Day 3', BEDS)).toEqual(['1', '1'])
  })

  it('tickets everyone out and only the round trips home', () => {
    renderPage()
    // Nine travellers fly out. Only Enrico holds a return on the 31st; Ada,
    // Grace, Carl and Emmy hold one on the 1st — Alan, Vera, Marie and Lise
    // booked one way and get themselves home.
    expect(rowCells('29 Oct')[0]).toBe('9')
    expect(rowCells('31 Oct')[0]).toBe('1')
    expect(rowCells('1 Nov')[0]).toBe('4')
  })

  it('counts the heads in each room per stage rather than naming an occupancy', () => {
    // "Double" beside "Double" read as one fact stated twice, when one is
    // the furniture and the other is how many people are in it. Room 3 is the
    // case that makes the split earn its column: two people on two twin beds
    // for the first two nights, one for the last.
    renderPage()
    const cells = (room: string) => rowCells(room)
    expect(cells('1')[0]).toBe('Double')
    expect(cells('1')[1]).toContain('Ada Lovelace')
    expect(cells('1')[1]).toContain('Grace Hopper')
    expect(cells('1').slice(2)).toEqual(['—', '2', '2'])
    expect(cells('3').slice(2)).toEqual(['Partial', '2', '1'])
    expect(cells('4').slice(2)).toEqual(['No', '2', '—'])
  })

  it('dashes the bed for a room nobody was asked about', () => {
    // A single-occupancy guest never chose a bed, so there is nothing to
    // report — but a blank among columns that all dash their gaps reads as
    // data lost rather than data never collected. The word "Single" belongs in
    // the filter menu, not the cell, where it would name a bed type.
    renderPage()
    const cells = rowCells('5')
    expect(cells[0]).toBe(NO_BED_ASKED)
    expect(cells[1]).toContain('Emmy Noether')
    expect(cells.slice(2)).toEqual(['Yes', '1', '1'])
  })
})

describe('payments', () => {
  const total = AGENT_TOTAL

  it('totals the party off the rate card', () => {
    renderPage()
    expect(moneyFor('Total quoted')?.textContent).toContain(total.toLocaleString('en-IN'))
  })

  it('works the schedule out of that total', () => {
    renderPage()
    const forty = Math.round(total * 0.4)
    expect(rowCells('Sep 5, 2026')).toEqual([
      `₹${forty.toLocaleString('en-IN')}`,
      '40% of the total',
    ])
    expect(rowCells('Sep 30, 2026')).toEqual([
      `₹${(total - 100000 - forty).toLocaleString('en-IN')}`,
      'Balance',
    ])
  })

  it('renders a payment with no date as a dash rather than inventing one', () => {
    renderPage()
    expect(rowCells('—')).toEqual(['₹1,00,000', 'Advance'])
  })

  it('shows one currency at a time, since the switch is what picks it', () => {
    // Both at once was two figures for the same money on every line, and the
    // switch above them already answers which one you want.
    renderPage()
    expect(moneyFor('Total quoted')?.textContent).toBe(`₹${AGENT_TOTAL.toLocaleString('en-IN')}`)

    fireEvent.click(screen.getByRole('button', { name: '$ USD' }))
    expect(moneyFor('Total quoted')?.textContent).toBe(
      `$${(AGENT_TOTAL / 95.31).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    )
  })

  it('ends every line on its figure, so the column lines up', () => {
    // The percentage used to trail the amount on this one row, pushing the one
    // number on the line out of the column every other number sits in.
    renderPage()
    const paid = moneyFor('Paid to date')?.textContent ?? ''
    const pct = `${((100000 / AGENT_TOTAL) * 100).toFixed(1)}%`
    expect(paid).toBe(`${pct}₹1,00,000`)
    expect(paid.endsWith('₹1,00,000')).toBe(true)
  })

  it('lights up every row on hover, not only the one that opens', () => {
    // The tint is what keeps your eye on one line while it travels the leader
    // to a figure several inches away, which every row needs and not just the
    // clickable one. Only that one gets the pointer, though.
    renderPage()
    const row = (label: string) => screen.getByText(label).closest('dt')?.parentElement
    for (const label of ['Total quoted', 'Guests are paying', 'Paid to date', 'Outstanding']) {
      expect(row(label)?.className).toContain('hover:bg-lily/20')
      expect(row(label)?.className).not.toContain('cursor-pointer')
    }
    expect(row('You are covering')?.className).toContain('hover:bg-lily/20')
    expect(row('You are covering')?.className).toContain('cursor-pointer')
  })

  it('runs a leader from each label to its figure', () => {
    // What ties a label to a figure several inches away, and what takes up the
    // slack that pins them all to the same right edge.
    renderPage()
    const leader = screen.getByText('Total quoted').closest('dt')?.querySelector('[aria-hidden]')
    expect(leader?.className).toContain('border-dotted')
    expect(leader?.className).toContain('flex-1')
  })

  it('breaks the total down by rate, keeping the exception separate', () => {
    renderPage()
    expect(rowCells('Full · double occupancy · one way')).toEqual(['2', '₹48,192', '₹96,384'])
  })

  it('drops the unit price on a row that prices one person', () => {
    // The rate and the row total are the same figure there, and printing both
    // invites reading the pair as a quantity.
    renderPage()
    expect(rowCells('Price exception · Carl Sagan')).toEqual(['1', '—', '₹70,160'])
    expect(rowCells('Full · single occupancy · round trip')).toEqual(['1', '—', '₹90,000'])
  })

  it('foots the breakdown with the total it is a breakdown of', () => {
    renderPage()
    // Nine travellers, no per-person figure — an average across seven rates is
    // a number nobody was charged.
    expect(rowCells('Total')).toEqual(['9', '—', `₹${total.toLocaleString('en-IN')}`])
    expect(
      screen
        .getByRole('table', { name: 'The total, by rate' })
        .querySelector('tfoot')
        ?.textContent?.startsWith('Total'),
    ).toBe(true)
  })
})

describe('the copy buttons', () => {
  it('copies the rooming message the agent is sent', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Copy the rooming summary' }))

    expect(writeText).toHaveBeenCalledWith(
      [
        'Day 1 and 2: 5 rooms total — 4 double and 1 single occupancy',
        'Day 3: 4 rooms total — 2 double and 2 single occupancy',
        '',
        'Day 1 and 2: 4 double occupancy rooms — 2 double bed and 2 twin bed',
        'Day 3: 2 double occupancy rooms — 1 double bed and 1 twin bed',
        '',
        'Air tickets',
        '29 Oct: 9 members',
        '31 Oct: 1 members',
        '1 Nov: 4 members',
      ].join('\n'),
    )
  })

  it('names what it copies rather than reading the whole message out', () => {
    // An aria-label carrying ten lines of prose is worse than none; the label
    // prop on CopyButton exists for exactly this.
    renderPage()
    expect(screen.getByRole('button', { name: 'Copy the payment summary' })).toBeInTheDocument()
  })
})

describe('the price breakdown', () => {
  const expand = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }))

  /**
   * Just the expanded row's itemisation. Scoped, because the reference table
   * below lists the same figures under the same names — which is the point of
   * it, and would otherwise make every lookup here ambiguous.
   */
  const detail = () => {
    const dl = document.querySelector('td[colspan] dl')
    return dl ? within(dl as HTMLElement) : null
  }

  it('itemises a rate into parts that add back up to it', () => {
    renderPage()
    expand('Full · double occupancy · round trip')

    // Their land cost for three nights shared, plus their two airfares —
    // 39,840 + 8,352 + 7,968. All three are figures they sent.
    const rows = detail()!
    expect(
      rows.getByText(/Land · 3 nights, double occupancy/).nextElementSibling,
    ).toHaveTextContent('₹39,840')
    expect(rows.getByText(/Airfare · HYD → COK/).nextElementSibling).toHaveTextContent('₹8,352')
    expect(rows.getByText(/Airfare · COK → HYD/).nextElementSibling).toHaveTextContent('₹7,968')
    expect(rows.getByText('Per person').nextElementSibling).toHaveTextContent('₹56,160')
    expect(rows.getByText('× 2 people').nextElementSibling).toHaveTextContent('₹1,12,320')
  })

  it('itemises a price exception as their figures too, sole-use night included', () => {
    renderPage()
    expand('Price exception · Carl Sagan')
    const rows = detail()!

    expect(
      rows.getByText(/Sole use of the room · final night/).nextElementSibling,
    ).toHaveTextContent('₹14,000')
    // 56,160 + 14,000.
    expect(rows.getByText('Per person').nextElementSibling).toHaveTextContent('₹70,160')
    // Three badges, not four: the sole-use night is their figures subtracted
    // from each other rather than one they sent, and it shows its working
    // instead of claiming to be quoted.
    expect(rows.getAllByText('Quoted')).toHaveLength(3)
    expect(rows.getByText(/Sole use of the room/).textContent).not.toContain('Quoted')
  })

  it('expands a breakdown row from a click on its figures', () => {
    renderPage()
    const row = screen
      .getByRole('rowheader', { name: /Full · double occupancy · round trip/ })
      .closest('tr') as HTMLElement
    // The People cell, well away from the label.
    fireEvent.click(within(row).getAllByRole('cell')[0])

    expect(detail()!.getByText(/Land · 3 nights, double occupancy/)).toBeInTheDocument()
  })

  it('shows how the sole-use night was costed', () => {
    // The arithmetic that replaced an assumed 11,280: the same night at each
    // occupancy, differenced, so the day's non-room costs cancel.
    renderPage()
    expand('Price exception · Carl Sagan')

    expect(screen.getByText(/The final night, alone in a shared room/)).toBeInTheDocument()
    expect(screen.getByText(/₹29,140 single \(₹73,680 − ₹44,540\)/)).toBeInTheDocument()
    expect(screen.getByText(/₹15,140 double \(₹39,840 − ₹24,700\)/)).toBeInTheDocument()
    expect(screen.getByText(/occupancy is worth ₹14,000/)).toBeInTheDocument()
  })

  it('shows what the guest paid and what we absorb, where those differ', () => {
    // He was quoted before the sole-use night was worked out properly, has
    // paid that figure, and is not being re-invoiced.
    renderPage()
    expand('Price exception · Carl Sagan')

    expect(moneyFor('Quoted to the guest, and paid')).toHaveTextContent('₹67,440')
    expect(moneyFor('You cover the difference')).toHaveTextContent('₹2,720')
  })

  it('takes your own two places out of what the guests owe', () => {
    // Their trip. Those two places were never anyone's to pay, so counting
    // them under "guests are paying" overstated what is coming in.
    renderPage()
    expect(moneyFor('Guests are paying')).toHaveTextContent(
      `₹${GUEST_TOTAL.toLocaleString('en-IN')}`,
    )
    expect(moneyFor('You are covering')).toHaveTextContent(`₹${COVERED.toLocaleString('en-IN')}`)
    // And the two still add up to what the agent bills.
    expect(GUEST_TOTAL + COVERED).toBe(AGENT_TOTAL)
  })

  it('takes a click anywhere on the row, not just on the words', () => {
    // The figure is as much the thing you are asking about as the label is,
    // and a click on it used to land on dead space.
    renderPage()
    fireEvent.click(moneyFor('You are covering') as HTMLElement)
    expect(coveredRow('Ada Lovelace')).toHaveTextContent('₹56,160')
  })

  it('does not toggle twice when the click lands on the button itself', () => {
    // The button's own click bubbles to the row, so a row handler that did not
    // stand aside would open and immediately close again.
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /You are covering/ }))
    expect(coveredRow('Ada Lovelace')).toBeDefined()
  })

  it('opens what you are covering into who it is for', () => {
    renderPage()
    // The room table names everyone, so ask the payments list specifically.
    expect(coveredRow('Ada Lovelace')).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: /You are covering/ }))
    // Two of our own places at the full rate, and the gap on the aged quote.
    expect(coveredRow('Ada Lovelace')).toHaveTextContent('₹56,160')
    expect(coveredRow('Grace Hopper')).toHaveTextContent('₹56,160')
    expect(coveredRow('Carl Sagan')).toHaveTextContent('₹2,720')
  })

  it('says why each of those falls to you, since the reasons differ', () => {
    // One pair is ours by definition; the other is a quote that aged. They are
    // owed different follow-ups, so the line says which is which.
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /You are covering/ }))

    const list = screen.getByText('You are covering').closest('dl') as HTMLElement
    expect(within(list).getAllByText('your own place')).toHaveLength(2)
    expect(screen.getByText('quoted before the sole-use night was costed')).toBeInTheDocument()
  })

  it('carries that gap up to the money at the top of the card', () => {
    // Real money, and it belongs where the money is rather than behind a row
    // you have to expand to find.
    renderPage()
    expect(moneyFor('Total quoted')).toHaveTextContent(`₹${AGENT_TOTAL.toLocaleString('en-IN')}`)
    expect(moneyFor('Guests are paying')).toHaveTextContent(
      `₹${GUEST_TOTAL.toLocaleString('en-IN')}`,
    )
    expect(moneyFor('You are covering')).toHaveTextContent(`₹${COVERED.toLocaleString('en-IN')}`)
  })

  it('opens one row at a time', () => {
    renderPage()
    expand('Full · double occupancy · round trip')
    expand('Full · double occupancy · one way')
    // The second row is one way, so it has no return leg to show.
    expect(detail()!.getAllByText(/Land · 3 nights, double occupancy/)).toHaveLength(1)
    expect(detail()!.queryByText(/Airfare · COK → HYD/)).not.toBeInTheDocument()
  })

  it('closes a row that is already open', () => {
    renderPage()
    expand('Full · double occupancy · round trip')
    expand('Full · double occupancy · round trip')
    expect(detail()).toBeNull()
  })

  it('lists every figure the agent has actually sent, and only those', () => {
    // Four land costs and two airfares. Everything else on the page is these
    // six applied to the rooming, so the rates they add up to are not repeated
    // here — those are on the guest-facing itinerary page already.
    renderPage()
    const quoted = screen.getByRole('table', { name: 'What the agent charges, per person' })
    // Six figures and the heading row.
    expect(within(quoted).getAllByRole('row')).toHaveLength(7)
    expect(rowCells('Land · Shortened itinerary, double occupancy')).toEqual(['₹24,700'])
    expect(rowCells('Land · Full itinerary, single occupancy')).toEqual(['₹73,680'])
    expect(rowCells('Airfare · HYD → COK', 'What the agent charges, per person')).toEqual([
      '₹8,352',
    ])
    expect(rowCells('Airfare · COK → HYD', 'What the agent charges, per person')).toEqual([
      '₹7,968',
    ])
  })
})

describe('guest money', () => {
  it('shows what has come in and what is still owed', () => {
    renderPage()
    expect(moneyFor('Guests have transferred')).toHaveTextContent(
      `₹${Math.round(TRANSFERRED * 95.31).toLocaleString('en-IN')}`,
    )
    expect(moneyFor('Still to collect')).toHaveTextContent(
      `₹${Math.round(TO_COLLECT * 95.31).toLocaleString('en-IN')}`,
    )
  })

  it('leaves what the agent is owed exactly where it was', () => {
    // The whole reason these two lines are set apart from the ones above: guest
    // money reaches us and never the agent.
    renderPage()
    expect(moneyFor('Outstanding')).toHaveTextContent(
      `₹${(AGENT_TOTAL - 100000).toLocaleString('en-IN')}`,
    )
    expect(screen.getByText(/none of this changes what is outstanding/)).toBeInTheDocument()
  })

  it('opens what is still to collect into who owes it', () => {
    renderPage()
    expect(screen.queryByText('room 4')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Still to collect/ }))
    // Enrico shares room 3 and has sent nothing; the room-4 pair likewise.
    expect(screen.getAllByText(/^room \d+$/)).toHaveLength(3)
  })

  it('answers at a glance whether a room has settled', () => {
    renderPage()
    // Room 2 both paid, room 4 neither, room 1 is ours and owes nothing.
    expect(rowCells('2')[2]).toBe('Yes')
    expect(rowCells('4')[2]).toBe('No')
    expect(rowCells('1')[2]).toBe('—')
  })

  it('puts each payment on the line with the guest who made it', () => {
    renderPage()
    const guests = rowCells('2')[1] ?? ''
    expect(guests).toContain('Alan Turing')
    expect(guests).toContain('$1,012')
    // Not "covered by Alan": his name is the line directly above it, so
    // repeating it spends width saying what the grouping already says.
    expect(guests).toContain('Covered')
    expect(guests).not.toContain('covered by Alan')
  })

  it('says so plainly for a guest who has sent nothing', () => {
    renderPage()
    expect(rowCells('4')[1]).toContain('—')
  })

  it('spells the shorthand out, since an initial and an icon are not a label', () => {
    renderPage()
    expect(screen.getByTitle('Paid Jackson by PayPal')).toBeInTheDocument()
    expect(screen.getByTitle('Paid Anupama by Venmo')).toBeInTheDocument()
    expect(screen.getByTitle('Covered by Alan')).toBeInTheDocument()
  })
})

describe('the PNG export', () => {
  const total = AGENT_TOTAL

  it('hands over the table as it reads, not as it is expanded', () => {
    // An export whose contents depend on which rows you happened to have open
    // is one nobody else can reproduce.
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Full · double occupancy · one way' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save as PNG' }))

    expect(downloadTableImage).toHaveBeenCalledTimes(1)
    const [spec, filename] = downloadTableImage.mock.calls[0]
    expect(filename).toBe('kerala-price-breakdown-inr')
    expect(spec.columns.map((column) => column.header)).toEqual(['Rate', 'People', 'Each', 'Total'])
    expect(spec.rows).toHaveLength(6)
    expect(spec.rows[0]).toEqual([
      'Full · double occupancy · round trip',
      '2',
      '₹56,160',
      '₹1,12,320',
    ])
    // The exception is billed at what the agent charges, not what he paid.
    expect(spec.rows).toContainEqual(['Price exception · Carl Sagan', '1', '—', '₹70,160'])
    expect(spec.footer).toEqual(['Total', '9', '—', `₹${total.toLocaleString('en-IN')}`])
  })

  it('exports whichever currency is on screen', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '$ USD' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save as PNG' }))

    const [spec, filename] = downloadTableImage.mock.calls[0]
    expect(filename).toBe('kerala-price-breakdown-usd')
    expect(spec.subtitle).toContain('US dollars')
    expect(spec.footer?.[3]).toMatch(/^\$/)
  })
})

describe('the currency switch', () => {
  it('converts the whole page, breakdown included, at the default rate', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '$ USD' }))

    expect(moneyFor('Total quoted')?.textContent).toContain(
      `$${(AGENT_TOTAL / 95.31).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    )
    // The breakdown is a separate card below, and follows the same switch —
    // two controls able to disagree would let the page contradict itself.
    expect(rowCells('Price exception · Carl Sagan')).toEqual(['1', '—', '$736.12'])
  })

  it('recalculates from a rate typed in over the baked-in one', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '$ USD' }))
    fireEvent.change(screen.getByLabelText('Rupees per dollar'), { target: { value: '80' } })

    expect(rowCells('Price exception · Carl Sagan')).toEqual(['1', '—', '$877.00'])
  })

  it('ignores a rate box mid-retype rather than dividing by nothing', () => {
    // Without the guard an emptied box turns every figure on the page into
    // Infinity for as long as it takes to type the next one.
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '$ USD' }))
    fireEvent.change(screen.getByLabelText('Rupees per dollar'), { target: { value: '' } })

    expect(screen.queryByText(/Infinity|NaN/)).not.toBeInTheDocument()
  })

  it('offers no rate box in rupees, where nothing is converted', () => {
    renderPage()
    expect(screen.queryByLabelText('Rupees per dollar')).not.toBeInTheDocument()
  })

  it('opens the rate box to the left, so the switch does not slide out from under the pointer', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '$ USD' }))

    // The row is right-aligned, so DOM order is what decides which way it
    // grows: after the switch and pressing "$ USD" shoves the switch left.
    const control = screen.getByRole('group', { name: 'Currency' })
    const rate = screen.getByLabelText('Rupees per dollar')
    expect(rate.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('copies the payment summary in the currency on screen', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '$ USD' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy the payment summary' }))

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Paid to date: $1,049.21'))
  })

  it('leaves the rooming message alone, which has no money in it', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: '$ USD' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy the rooming summary' }))

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('29 Oct: 9 members'))
  })
})

describe('the room-by-room column menus', () => {
  // The caption doubles as the filter's read-out, so it is one of two strings.
  // Anchored, because "Bed type in the double-occupancy rooms" also ends in
  // "rooms" and a loose pattern picks that table instead.
  const ROOM_TABLE = /^(Every room and who is in it|\d+ of \d+ rooms)$/

  const roomNumbers = () =>
    within(screen.getByRole('table', { name: ROOM_TABLE }))
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent)

  const openMenu = (column: string) =>
    fireEvent.click(screen.getByRole('button', { name: `Sort and filter ${column}` }))

  it('lists the rooms in number order to start with', () => {
    renderPage()
    expect(roomNumbers()).toEqual(['1', '2', '3', '4', '5'])
  })

  it('sorts a column both ways', () => {
    renderPage()
    openMenu('Room')
    fireEvent.click(screen.getByRole('button', { name: 'Sort 9 → 1' }))
    expect(roomNumbers()).toEqual(['5', '4', '3', '2', '1'])
  })

  it('breaks ties on the room number so equal rows never shuffle', () => {
    renderPage()
    openMenu('Beds')
    fireEvent.click(screen.getByRole('button', { name: 'Sort A → Z' }))
    // Room 5's bed is blank and sorts first; 1 and 4 are both "Double" and
    // 2 and 3 both "Twin". Within each group the room number decides, so
    // the order is fully determined.
    expect(roomNumbers()).toEqual(['5', '1', '4', '2', '3'])
  })

  it('offers the values the column actually holds', () => {
    renderPage()
    openMenu('Beds')
    // The dash is tickable too, under the name the menu gives it: the cell
    // cannot say "Single" without reading as a bed type, but the menu can.
    for (const value of ['Double', 'Twin', 'Single']) {
      expect(screen.getByRole('checkbox', { name: value })).toBeChecked()
    }
    expect(screen.getByText('Showing 3 of 3')).toBeInTheDocument()
  })

  it('hides the rooms whose value is unticked', () => {
    renderPage()
    openMenu('Beds')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Double' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Single' }))

    // Rooms 2 and 3 are the twins.
    expect(roomNumbers()).toEqual(['2', '3'])
    expect(screen.getByText('2 of 5 rooms')).toBeInTheDocument()
  })

  it('narrows to one value in a click when asked for only that one', () => {
    // The tickboxes take away; this keeps. Same filter underneath — everything
    // but the chosen value goes into `hidden` — so undoing it is the same
    // Select all as any other filter.
    renderPage()
    openMenu('Beds')
    fireEvent.click(screen.getByRole('button', { name: 'Show only Twin' }))

    expect(roomNumbers()).toEqual(['2', '3'])
    expect(screen.getByRole('checkbox', { name: 'Twin' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Double' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Single' })).not.toBeChecked()
    expect(screen.getByText('Showing 1 of 3')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(roomNumbers()).toEqual(['1', '2', '3', '4', '5'])
  })

  it('names the value in the only button, since the word alone says nothing', () => {
    // Every row's button reads "Only" on screen, which is the whole point of
    // it sitting in a row — and no help at all to anyone who cannot see which
    // row it is in.
    renderPage()
    openMenu('Beds')
    for (const name of ['Single', 'Double', 'Twin']) {
      expect(screen.getByRole('button', { name: `Show only ${name}` })).toHaveTextContent('Only')
    }
  })

  it('filters on how many are left on the last night', () => {
    renderPage()
    openMenu('Night 3')
    // The em dash is spelled out in the menu, where there is room for words.
    fireEvent.click(screen.getByRole('checkbox', { name: '2' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '1' }))

    expect(roomNumbers()).toEqual(['4'])
  })

  it('sorts the emptied rooms with the smallest counts, not off in punctuation', () => {
    // Night 3 holds an em dash for a room nobody is left in. Sorted as text it
    // lands wherever the collator files punctuation; as a number it falls to 0,
    // which is what an empty room actually holds.
    renderPage()
    openMenu('Night 3')
    fireEvent.click(screen.getByRole('button', { name: 'Sort 1 → 9' }))
    // Room 4 is empty, then the ones down to one guest, then the full ones.
    expect(roomNumbers()).toEqual(['4', '3', '5', '1', '2'])
  })

  it('keeps offering a value it has filtered out, so the filter can be undone', () => {
    renderPage()
    openMenu('Beds')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Double' }))
    expect(screen.getByRole('checkbox', { name: 'Double' })).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(roomNumbers()).toEqual(['1', '2', '3', '4', '5'])
  })

  it('pins its column widths so filtering does not slide them sideways', () => {
    // jsdom computes no layout, so this asserts the mechanism rather than the
    // pixels: without a colgroup and fixed layout the browser sizes columns
    // from their contents, and filtering to nothing leaves only the headings to
    // divide the width between. Auto below `sm`, where the headings are already
    // the wider thing and these ratios would squeeze "Room" narrower than the
    // word.
    renderPage()
    const table = screen.getByRole('table', { name: ROOM_TABLE })
    expect(table.className).toContain('table-auto')
    expect(table.className).toContain('sm:table-fixed')
    const widths = [...table.querySelectorAll('colgroup col')].map((col) => col.className)
    expect(widths).toEqual([
      'sm:w-[12.1%]',
      'sm:w-[12.4%]',
      'sm:w-[35.2%]',
      'sm:w-[11.7%]',
      'sm:w-[14.6%]',
      'sm:w-[14%]',
    ])
    // They have to come to 100 exactly. Anything less and the table stops short
    // of its own bleed; anything more and the last column is quietly clipped,
    // which looks like a wrapping bug rather than an arithmetic one.
    expect(
      widths.reduce((sum, width) => sum + Number(width.match(/([\d.]+)%/)![1]), 0),
    ).toBeCloseTo(100, 5)

    // The header survives an emptied table — it carries the menus that are the
    // only way back — so the widths have to hold with no rows under them.
    openMenu('Beds')
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    const emptied = screen.getByRole('table', { name: '0 of 5 rooms' })
    expect(within(emptied).getAllByRole('columnheader')).toHaveLength(6)
    expect(emptied.querySelectorAll('colgroup col')).toHaveLength(6)
  })

  it('lets a heading wrap but never squeezes it under its own menu button', () => {
    // jsdom lays nothing out, so this asserts the two rules that decide it. The
    // label keeps `min-width: auto`, which wraps it at a space and stops there;
    // `min-w-0` let "Nights 1–2" render into a box narrower than "NIGHTS" and
    // the overflow ran under the button, which reads as the gap disappearing.
    // The button holds its own size, so what gives is always the words.
    renderPage()
    for (const heading of within(screen.getByRole('table', { name: ROOM_TABLE })).getAllByRole(
      'columnheader',
    )) {
      const [label, menu] = [...heading.firstElementChild!.children]
      expect(label.className).not.toContain('min-w-0')
      expect(menu.className).toContain('shrink-0')
    }
  })

  it('leaves the fixed-width machinery off the tables that never change', () => {
    // The other six hold two or three rows that are always there; a colgroup
    // on them would be a width to maintain for no reason.
    renderPage()
    const air = screen.getByRole('table', { name: 'Air tickets' })
    expect(air.className).not.toContain('table-fixed')
    expect(air.querySelector('colgroup')).toBeNull()
  })

  it('says so rather than showing an empty table when nothing matches', () => {
    renderPage()
    openMenu('Beds')
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(screen.getByText(/No rooms match those filters/)).toBeInTheDocument()
  })

  it('narrows one column’s options to what the other filters have left', () => {
    renderPage()
    // Keep only the rooms down to one guest on the last night: 3 (a roommate
    // leaves) and 5 (a single all along). Neither is a double bed, so the Beds
    // menu must stop offering one.
    openMenu('Night 3')
    fireEvent.click(screen.getByRole('checkbox', { name: '2' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Checked out' }))
    fireEvent.keyDown(window, { key: 'Escape' })

    openMenu('Beds')
    expect(screen.getByRole('checkbox', { name: 'Twin' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Single' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Double' })).not.toBeInTheDocument()
  })

  it('keeps showing what it is itself hiding, even once nothing carries it', () => {
    // The value a column excludes has to stay on its own list: otherwise the
    // tickbox you just cleared vanishes and there is nothing left to click.
    renderPage()
    // Down to the one room that empties — room 4, a double bed.
    openMenu('Night 3')
    fireEvent.click(screen.getByRole('checkbox', { name: '2' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '1' }))
    fireEvent.keyDown(window, { key: 'Escape' })

    // Unticking its bed leaves nothing at all, so nothing carries "Double"
    // any more — and the cascade would drop it from the list that is excluding
    // it, stranding the filter.
    openMenu('Beds')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Double' }))
    expect(screen.getByText(/No rooms match those filters/)).toBeInTheDocument()

    const box = screen.getByRole('checkbox', { name: 'Double' })
    expect(box).not.toBeChecked()
    fireEvent.click(box)
    expect(screen.getByRole('checkbox', { name: 'Double' })).toBeChecked()
  })

  it('marks a filtered column so it reads as filtered from across the table', () => {
    renderPage()
    // Sorting is not filtering: the Room column is sorted from the start, and
    // must not claim to be withholding anything.
    expect(screen.getByRole('button', { name: 'Sort and filter Room' })).toBeInTheDocument()

    openMenu('Beds')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Double' }))
    expect(
      screen.getByRole('button', { name: 'Sort and filter Beds (filtered to 2 of 3)' }),
    ).toBeInTheDocument()
  })

  it('labels a value by what it means in its own column', () => {
    // Night 3 and Paid both show an em dash and mean different things by it.
    // One shared label map spelled the Paid one out as "checked out".
    renderPage()
    openMenu('Night 3')
    expect(screen.getByRole('checkbox', { name: 'Checked out' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })

    openMenu('Paid')
    expect(screen.getByRole('checkbox', { name: 'Nobody owes' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Checked out' })).not.toBeInTheDocument()
  })

  it('filters the rooms that still owe something', () => {
    renderPage()
    openMenu('Paid')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Yes' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Nobody owes' }))
    // Room 3 is Partial and room 4 has paid nothing.
    expect(roomNumbers()).toEqual(['3', '4'])
  })

  it('reads the word columns from the left and the counts from the right', () => {
    // Beds, Guests and Paid hold words; only the two night counts are numbers,
    // and only numbers want lining up on the right.
    renderPage()
    const headers = within(screen.getByRole('table', { name: ROOM_TABLE })).getAllByRole(
      'columnheader',
    )
    for (const index of [1, 2, 3]) expect(headers[index].className).toContain('text-left')
    for (const index of [4, 5]) expect(headers[index].className).toContain('text-right')
  })

  it('offers no value filter on the room number', () => {
    // Twenty-four tickboxes answering nothing; sorting is the useful half.
    renderPage()
    openMenu('Room')
    expect(screen.getByRole('button', { name: 'Sort 1 → 9' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    renderPage()
    openMenu('Beds')
    expect(screen.getByRole('button', { name: 'Sort A → Z' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('button', { name: 'Sort A → Z' })).not.toBeInTheDocument()
  })
})

describe('an index built before this page shipped', () => {
  it('says to run the sync rather than rendering a table of nothing', () => {
    setUnlock('unlocked', { kerala: null })
    renderPage()

    expect(screen.getByText(/no trip data in it yet/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('the gate', () => {
  it('shows nothing to someone who has not unlocked', () => {
    setUnlock('locked', { kerala })
    renderPage()

    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
