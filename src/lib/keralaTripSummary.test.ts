import { describe, expect, it } from 'vitest'
import type { KeralaRoom } from './adminUnlock'
import {
  CHECKED_OUT,
  NO_BED_ASKED,
  inr,
  longDate,
  money,
  paymentsBlurb,
  roomRows,
  roomingBlurb,
  shortDate,
  summarizeKeralaTrip,
} from './keralaTripSummary'

/**
 * A room, spelled the way the generator emits one.
 *
 * `trips` is what does the work: two 'full' occupants is a room that lasts the
 * whole trip, 'full' and 'short' is one that loses a roommate for the last
 * night, and two 'short' is one that empties.
 */
const room = (
  number: number,
  bed: 'double' | 'twin',
  trips: ('full' | 'short')[],
  flights: ('rt' | 'ow')[] = trips.map(() => 'rt'),
): KeralaRoom => ({
  room: number,
  bed,
  occupants: trips.map((trip, index) => ({
    name: `Guest ${number}.${index}`,
    trip,
    flight: flights[index],
    occupancy: 'double' as const,
  })),
})

const single = (number: number, trip: 'full' | 'short' = 'full'): KeralaRoom => ({
  room: number,
  occupants: [{ name: `Solo ${number}`, trip, flight: 'rt', occupancy: 'single' }],
})

describe('rooming stages', () => {
  it('counts days 1-2 by who is in the room and day 3 by who is left', () => {
    const summary = summarizeKeralaTrip(
      [
        room(1, 'double', ['full', 'full']),
        room(2, 'twin', ['full', 'short']),
        room(3, 'twin', ['short', 'short']),
        single(4),
      ],
      null,
    )

    expect(summary.travellers).toBe(7)
    const [early, late] = summary.stages
    expect(early).toEqual({
      label: 'Day 1 and 2',
      rooms: 4,
      double: 3,
      single: 1,
      doubleBed: 1,
      twinBed: 2,
    })
    // Room 2 loses a roommate and becomes a single for the last night — which
    // is why day 3 has *more* singles than days 1 and 2, not fewer. Room 3
    // empties and is gone.
    expect(late).toEqual({
      label: 'Day 3',
      rooms: 3,
      double: 1,
      single: 2,
      doubleBed: 1,
      twinBed: 0,
    })
  })

  it('leaves a room out of day 3 when everyone in it has gone home', () => {
    const summary = summarizeKeralaTrip([room(1, 'double', ['short', 'short']), single(2)], null)
    expect(summary.stages[0].rooms).toBe(2)
    expect(summary.stages[1].rooms).toBe(1)
  })
})

describe('air legs', () => {
  it('puts everyone on the outbound and only the round trips on the way back', () => {
    // One-way guests make their own way onward, so they are on the 29th and
    // nothing else — that is the whole difference between the two answers.
    const summary = summarizeKeralaTrip(
      [
        room(1, 'double', ['full', 'full'], ['rt', 'ow']),
        room(2, 'twin', ['short', 'short'], ['rt', 'ow']),
      ],
      null,
    )

    expect(summary.air).toEqual([
      {
        date: '2026-10-29',
        members: 4,
        detail: 'Both itineraries, HYD → COK',
      },
      {
        date: '2026-10-31',
        members: 1,
        detail: 'Shortened itinerary, COK → HYD',
      },
      {
        date: '2026-11-01',
        members: 1,
        detail: 'Full itinerary, COK → HYD',
      },
    ])
  })
})

describe('billing', () => {
  const rooms = [room(1, 'double', ['full', 'full']), single(2)]

  it('totals the party off the same rate card the guests are quoted', () => {
    // full/double/rt is 56,160 each and full/single/rt is 90,000.
    const { billing } = summarizeKeralaTrip(rooms, null)
    expect(billing.total).toBe(56160 * 2 + 90000)
    expect(billing.paid).toBe(0)
    expect(billing.outstanding).toBe(billing.total)
  })

  it('gives an override a bucket of its own rather than folding it into a rate', () => {
    const withOverride: KeralaRoom[] = [
      {
        ...rooms[0],
        occupants: [{ ...rooms[0].occupants[0], priceOverride: 67440 }, rooms[0].occupants[1]],
      },
    ]
    const { billing } = summarizeKeralaTrip(withOverride, null)
    expect(billing.total).toBe(67440 + 56160)
    expect(billing.buckets.map((bucket) => bucket.label)).toEqual([
      'Price exception · Guest 1.0',
      'Full · double occupancy · round trip',
    ])
    expect(billing.buckets.every((bucket) => bucket.people * bucket.each === bucket.total)).toBe(
      true,
    )
  })

  it('counts how many of a rate row are your own places', () => {
    // A row's total and its guest price come apart for two unlike reasons, and
    // this is what lets the row tell them apart: a host place was never money a
    // guest owed us, and the rest is a share we took on.
    const mixed: KeralaRoom[] = [
      {
        ...room(1, 'double', ['full', 'full']),
        occupants: [
          { ...room(1, 'double', ['full', 'full']).occupants[0], host: true },
          room(1, 'double', ['full', 'full']).occupants[1],
        ],
      },
    ]
    const { billing } = summarizeKeralaTrip(mixed, null)

    expect(billing.buckets[0]).toMatchObject({ people: 2, hosts: 1, total: 56160 * 2 })
    // One of the two owes us; the other place is ours.
    expect(billing.buckets[0].guestPrice).toBe(56160)
  })

  it('leaves a subsidised guest in the rate they are billed at', () => {
    // The point of the field, stated as a test: this table gets read back
    // against the agent's invoice, so a guest whose share we are partly paying
    // has to stay an ordinary line on it at an ordinary rate. Only what the
    // guest owes moves.
    const subsidised: KeralaRoom[] = [
      { ...single(2), occupants: [{ ...single(2).occupants[0], hostCovers: 23283 }] },
    ]
    const { billing } = summarizeKeralaTrip(subsidised, null)

    expect(billing.total).toBe(90000)
    expect(billing.buckets.map((bucket) => bucket.label)).toEqual([
      'Full · single occupancy · round trip',
    ])
    expect(billing.buckets[0]).toMatchObject({ people: 1, each: 90000, total: 90000, hosts: 0 })
    // What the guest owes is the only figure that moved.
    expect(billing.buckets[0].guestPrice).toBe(66717)
    expect(billing.coveredBy).toEqual([{ name: 'Solo 2', amount: 23283, reason: 'gift' }])
    expect(billing.covered).toBe(23283)
    expect(billing.guestPrices).toBe(66717)
    expect(billing.guestPrices + billing.covered).toBe(billing.total)
    // Nothing of ours reaches the itemisation, which has to foot to the agent's
    // figure rather than to what anyone was asked for.
    expect(billing.buckets[0].choice).not.toHaveProperty('hostCovers')
  })

  it('asks a subsidised guest for the reduced figure, not the card rate', () => {
    const subsidised: KeralaRoom[] = [
      { ...single(2), occupants: [{ ...single(2).occupants[0], hostCovers: 23283 }] },
    ]
    const { billing } = summarizeKeralaTrip(subsidised, null)

    expect(billing.toCollectFrom).toEqual([{ name: 'Solo 2', room: 2, usd: 700 }])
    expect(billing.toCollect).toBe(700)
  })

  it('separates what we chose to cover from what a quote got wrong', () => {
    // Two reasons, two lines, one person — and they must not double-count. The
    // gift comes out of the shortfall so the pair still sums to the gap between
    // what the agent charges for them and what they were asked for.
    const bothReasons: KeralaRoom[] = [
      {
        ...room(1, 'twin', ['full', 'short']),
        occupants: [
          {
            ...room(1, 'twin', ['full', 'short']).occupants[0],
            priceOverride: 67440,
            soleUseNights: 1,
            hostCovers: 7440,
          },
          room(1, 'twin', ['full', 'short']).occupants[1],
        ],
      },
    ]
    const { billing } = summarizeKeralaTrip(bothReasons, null)

    // The roommate is a shortened round trip, so they bring the third reason
    // along: quoted off the rate card's single return fare, invoiced at the
    // cheaper one the shortened itinerary actually flies.
    expect(billing.coveredBy).toEqual([
      { name: 'Guest 1.0', amount: 7440, reason: 'gift' },
      { name: 'Guest 1.0', amount: 3860, reason: 'shortfall' },
      { name: 'Guest 1.1', amount: -1073, reason: 'surplus' },
    ])
    expect(billing.covered).toBe(7440 + 3860 - 1073)
    expect(billing.guestPrices + billing.covered).toBe(billing.total)
  })

  it('files a guest quoted above the invoice as a negative, not as nothing', () => {
    // The direction this only ever tested one way. `guestPrices` is derived as
    // `total - covered`, so a surplus that never reaches `coveredBy` does not
    // round to zero — it silently overstates what the guests here are paying by
    // exactly the amount we are holding.
    const { billing } = summarizeKeralaTrip([room(1, 'twin', ['short', 'short'])], null)

    expect(billing.total).toBe(39947 * 2)
    expect(billing.buckets[0]).toMatchObject({ people: 2, each: 39947, guestPrice: 41020 * 2 })
    expect(billing.coveredBy).toEqual([
      { name: 'Guest 1.0', amount: -1073, reason: 'surplus' },
      { name: 'Guest 1.1', amount: -1073, reason: 'surplus' },
    ])
    expect(billing.covered).toBe(-2146)
    expect(billing.guestPrices).toBe(41020 * 2)
    expect(billing.guestPrices + billing.covered).toBe(billing.total)
  })

  it('nets a percentage row against what has already been paid', () => {
    // `pct` is the share of the total that should stand settled *by* that date,
    // not the size of the instalment: the payment is whatever brings the running
    // total up to it. The agent writes their September call as 70% of the whole
    // and then subtracts the advances; read as a slice standing on its own it
    // asks for 70% on top of them, which on the real figures is 57,810 more than
    // they are owed.
    const { billing } = summarizeKeralaTrip(rooms, {
      payments: [{ amount: 50000, note: 'Advance' }],
      schedule: [
        { due: '2026-09-05', pct: 70, note: 'Brings what has been paid to 70% of the total' },
        { due: '2026-09-30', note: 'Balance' },
      ],
    })

    expect(billing.paid).toBe(50000)
    expect(billing.outstanding).toBe(billing.total - 50000)
    expect(billing.due[0].amount).toBe(Math.round(billing.total * 0.7) - 50000)
    // The balance is what is left once the advance and the fixed share are
    // accounted for — not another percentage, and not the whole remainder.
    expect(billing.due[1].amount).toBe(billing.total - 50000 - billing.due[0].amount)
    // The invariant that catches a cumulative/slice mix-up from either side.
    expect(billing.paid + billing.due[0].amount + billing.due[1].amount).toBe(billing.total)
  })

  it('nets each percentage row against the ones scheduled before it too', () => {
    // Two in sequence, because "brings the running total to" has to count what
    // is scheduled as well as what is received, or the second call re-bills the
    // whole of the first.
    const { billing } = summarizeKeralaTrip(rooms, {
      payments: [{ amount: 50000 }],
      schedule: [
        { due: '2026-09-05', pct: 40 },
        { due: '2026-09-30', pct: 70 },
        { due: '2026-10-15', note: 'Balance' },
      ],
    })

    expect(billing.due.map((row) => row.amount)).toEqual([
      Math.round(billing.total * 0.4) - 50000,
      Math.round(billing.total * 0.7) - Math.round(billing.total * 0.4),
      billing.total - Math.round(billing.total * 0.7),
    ])
    expect(billing.paid + billing.due.reduce((sum, row) => sum + row.amount, 0)).toBe(billing.total)
  })

  it('survives an index with no billing recorded at all', () => {
    const { billing } = summarizeKeralaTrip(rooms, null)
    expect(billing.payments).toEqual([])
    expect(billing.due).toEqual([])
    expect(billing.paidPct).toBe(0)
  })
})

describe('the blurbs', () => {
  const summary = summarizeKeralaTrip(
    [room(1, 'double', ['full', 'full']), room(2, 'twin', ['full', 'short']), single(3)],
    {
      payments: [{ amount: 50000, note: 'Advance' }],
      schedule: [{ due: '2026-09-05', pct: 40, note: '40% of the total' }],
    },
  )

  it('writes the rooming message in the agent’s own wording', () => {
    expect(roomingBlurb(summary)).toBe(
      [
        'Day 1 and 2: 3 rooms total — 2 double and 1 single occupancy',
        'Day 3: 3 rooms total — 1 double and 2 single occupancy',
        '',
        'Day 1 and 2: 2 double occupancy rooms — 1 double bed and 1 twin bed',
        'Day 3: 1 double occupancy rooms — 1 double bed and 0 twin bed',
        '',
        'Air tickets',
        '29 Oct: 5 members',
        '31 Oct: 1 members',
        '1 Nov: 4 members',
      ].join('\n'),
    )
  })

  it('writes the payment message in whichever currency the page is showing', () => {
    const rupees = paymentsBlurb(summary, money('inr', 95.31))
    expect(rupees).toContain('Paid to date: ₹50,000')
    expect(rupees).toContain('Sep 5, 2026: ')
    expect(rupees).toContain('(40% of the total)')

    // The switch is on the page beside this button; a blurb that ignored it
    // would hand over figures in the currency you just switched away from.
    expect(paymentsBlurb(summary, money('usd', 100))).toContain('Paid to date: $500')
  })
})

describe('room rows', () => {
  it('flattens each room into the values the column menus filter on', () => {
    // Strings, not the raw enums: a menu built from `'twin' | undefined` would
    // offer to filter on "undefined". Occupancy is a head count per stage
    // rather than the words "double" and "single", which in a row that also
    // names a bed read as the same fact stated twice.
    expect(
      roomRows([
        room(1, 'double', ['full', 'full']),
        room(2, 'twin', ['full', 'short']),
        room(3, 'twin', ['short', 'short']),
        single(4),
      ]),
    ).toMatchObject([
      { room: 1, beds: 'Double', guests: 'Guest 1.0, Guest 1.1', nights12: '2', night3: '2' },
      { room: 2, beds: 'Twin', guests: 'Guest 2.0, Guest 2.1', nights12: '2', night3: '1' },
      {
        room: 3,
        beds: 'Twin',
        guests: 'Guest 3.0, Guest 3.1',
        nights12: '2',
        night3: CHECKED_OUT,
      },
      // A dash, not "Single": nobody asked a single-occupancy guest which bed
      // they wanted, so there is nothing to report, and in this column the word
      // would name a bed type. The filter menu is where it gets its name.
      { room: 4, beds: NO_BED_ASKED, guests: 'Solo 4', nights12: '1', night3: '1' },
    ])
  })
})

describe('what each guest has sent', () => {
  const paid = (usd: number, via: 'zelle' | 'venmo' | 'paypal' = 'zelle') => ({
    payment: { usd, to: 'anupama' as const, via },
  })

  it('reads a payment out in shorthand, and spelled out too', () => {
    // An initial for who it reached and an icon for how; the words go in a
    // title and to a screen reader, since neither is a label on its own.
    const [row] = roomRows([
      {
        room: 1,
        bed: 'double',
        occupants: [
          { name: 'A Guest', trip: 'full', flight: 'rt', occupancy: 'double', ...paid(589) },
          {
            name: 'B Guest',
            trip: 'full',
            flight: 'rt',
            occupancy: 'double',
            payment: { usd: 710, to: 'jackson', via: 'paypal' },
          },
        ],
      },
    ])
    expect(row.people[0]).toEqual({
      name: 'A Guest',
      paid: '$589',
      via: 'zelle',
      to: 'A',
      note: '',
      hint: 'Paid Anupama by Zelle',
    })
    expect(row.people[1]).toMatchObject({
      paid: '$710',
      via: 'paypal',
      to: 'J',
      hint: 'Paid Jackson by PayPal',
    })
  })

  it('names whoever covered a guest whose share went in with a roommate', () => {
    const [row] = roomRows([
      {
        room: 1,
        bed: 'twin',
        occupants: [
          { name: 'A Guest', trip: 'full', flight: 'rt', occupancy: 'double', ...paid(1178) },
          {
            name: 'B Guest',
            trip: 'full',
            flight: 'rt',
            occupancy: 'double',
            payment: { via: 'roommate', paidBy: 'A' },
          },
        ],
      },
    ])
    // "Covered" alone in the cell — the roommate is the line above it — with
    // the full sentence kept for the title and the screen reader.
    expect(row.people[1]).toMatchObject({ paid: '', note: 'Covered', hint: 'Covered by A' })
  })

  it('leaves a guest who has sent nothing visibly empty rather than silent', () => {
    const [row] = roomRows([single(1)])
    expect(row.people[0]).toMatchObject({ paid: '', note: '', hint: 'Has not paid yet' })
  })

  it('does not chase a host for their own place', () => {
    // Their place was never money anyone was going to send us, so reading it
    // as unpaid is reading it as us owing ourselves.
    const [row] = roomRows([
      {
        room: 1,
        bed: 'double',
        occupants: [
          { name: 'Host', trip: 'full', flight: 'rt', occupancy: 'double', host: true },
          { name: 'Guest', trip: 'full', flight: 'rt', occupancy: 'double' },
        ],
      },
    ])
    expect(row.people[0].note).toBe('To be paid')
    expect(row.people[0].hint).toBe('Your own place, still to be paid')
    expect(row.people[1].hint).toBe('Has not paid yet')
  })

  it('totals what has come in and what is still owed, and leaves the agent alone', () => {
    // Guest money reaches us, never the agent, so none of it may move what the
    // agent is owed.
    const rooms: KeralaRoom[] = [
      {
        room: 1,
        bed: 'double',
        occupants: [
          // full/double/rt is asked as $589; this settles exactly.
          { name: 'Paid Up', trip: 'full', flight: 'rt', occupancy: 'double', ...paid(589) },
          { name: 'Owes', trip: 'full', flight: 'rt', occupancy: 'double' },
        ],
      },
    ]
    const before = summarizeKeralaTrip(rooms, null).billing
    expect(before.transferred).toBe(589)
    expect(before.toCollect).toBe(589)
    expect(before.toCollectFrom).toEqual([{ name: 'Owes', room: 1, usd: 589 }])
    expect(before.outstanding).toBe(before.total)
    expect(before.coveredBy).toEqual([])
  })

  it('puts a guest who sent too little into what you are covering', () => {
    const short = summarizeKeralaTrip(
      [
        {
          room: 1,
          bed: 'double',
          occupants: [
            { name: 'Short', trip: 'full', flight: 'rt', occupancy: 'double', ...paid(500) },
            { name: 'Over', trip: 'full', flight: 'rt', occupancy: 'double', ...paid(600) },
          ],
        },
      ],
      null,
    ).billing
    // Asked $589 each: one is $89 short, the other $11 over. At the rate they
    // were quoted, not today's — the gap is a fact about a past transaction.
    expect(short.coveredBy).toEqual([
      { name: 'Short', amount: 89 * 95.31, reason: 'settlement' },
      { name: 'Over', amount: -11 * 95.31, reason: 'settlement' },
    ])
    expect(short.covered).toBeCloseTo(78 * 95.31, 6)
    // And the breakdown adds up to the figure it breaks down.
    expect(short.guestPrices + short.covered).toBeCloseTo(short.total, 6)
  })

  it('settles a payment against everyone it covered, not just the payer', () => {
    const both = summarizeKeralaTrip(
      [
        {
          room: 1,
          bed: 'double',
          occupants: [
            { name: 'Payer', trip: 'full', flight: 'rt', occupancy: 'double', ...paid(1178) },
            {
              name: 'Covered',
              trip: 'full',
              flight: 'rt',
              occupancy: 'double',
              payment: { via: 'roommate', paidBy: 'Payer' },
            },
          ],
        },
      ],
      null,
    ).billing
    // $589 × 2. Settled, so nothing to cover and nothing to collect.
    expect(both.transferred).toBe(1178)
    expect(both.coveredBy).toEqual([])
    expect(both.toCollect).toBe(0)
  })
})

describe('whether a room has settled', () => {
  const guest = (name: string, payment?: object) => ({
    name,
    trip: 'full' as const,
    flight: 'rt' as const,
    occupancy: 'double' as const,
    ...(payment ? { payment } : {}),
  })
  const withGuests = (...people: object[]) =>
    roomRows([{ room: 1, bed: 'double', occupants: people as never }])[0].paid

  it('is Yes only when everyone who owes has settled', () => {
    const zelle = { usd: 589, to: 'anupama', via: 'zelle' }
    expect(withGuests(guest('A', zelle), guest('B', zelle))).toBe('Yes')
    // A roommate whose share went in with the other's payment counts too.
    expect(withGuests(guest('A', zelle), guest('B', { via: 'roommate', paidBy: 'A' }))).toBe('Yes')
  })

  it('tells No apart from Partial, which is the useful distinction', () => {
    expect(withGuests(guest('A'), guest('B'))).toBe('No')
    expect(withGuests(guest('A', { usd: 589, to: 'anupama', via: 'zelle' }), guest('B'))).toBe(
      'Partial',
    )
  })

  it('is neither for a room where nobody owes anything', () => {
    // Ours. An em dash rather than Yes, so narrowing the filter to the rooms
    // that still owe does not have to reason about who is a host.
    expect(withGuests({ ...guest('Host A'), host: true }, { ...guest('Host B'), host: true })).toBe(
      '—',
    )
  })
})

describe('currency', () => {
  it('converts at the rate it is given rather than a baked-in one', () => {
    expect(money('inr', 95.31)(2358724)).toBe('₹23,58,724')
    expect(money('usd', 95.31)(2358724)).toBe('$24,747.92')
    // The point of the override: a rate typed in today moves every figure.
    expect(money('usd', 90)(2358724)).toBe('$26,208.04')
  })

  it('shows dollars to the cent, so the columns can be added up', () => {
    // Rounded to the nearest dollar these three came to a dollar more than
    // their own total, which reads as an arithmetic error rather than as
    // rounding. Rupees stay whole, being the figures actually quoted.
    const usd = money('usd', 95.31)
    expect(usd(48192)).toBe('$505.63')
    expect(usd(2720)).toBe('$28.54')
    expect(usd(99104)).toBe('$1,039.81')
    expect(money('inr', 95.31)(48192)).toBe('₹48,192')
  })
})

describe('formatting', () => {
  it('writes dates the way the agent’s messages do', () => {
    expect(shortDate('2026-10-29')).toBe('29 Oct')
    expect(shortDate('2026-11-01')).toBe('1 Nov')
    expect(longDate('2026-09-05')).toBe('Sep 5, 2026')
  })

  it('groups rupees in lakhs, not thousands', () => {
    expect(inr(2358724)).toBe('₹23,58,724')
    expect(inr(650000)).toBe('₹6,50,000')
  })
})
