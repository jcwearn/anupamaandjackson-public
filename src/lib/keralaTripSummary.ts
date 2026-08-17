import type { KeralaBilling, KeralaPayment, KeralaRoom, KeralaRoomOccupant } from './adminUnlock'
import { flights } from './keralaFlights'
import { askedUsd, keralaAgentCost, keralaPrice, QUOTED_AT_INR_PER_USD } from './keralaPricing'

/**
 * Everything /admin/kerala-trip tells the travel agent, counted off the rooming.
 *
 * Kept out of the route file because that one exports a component, and a module
 * exporting both breaks fast refresh — the same rule that put inr.ts, and then
 * keralaPricing.ts, over here. It earns the separation anyway: the arithmetic
 * below is what actually gets sent to someone we owe money to, and it is worth
 * being able to test it without rendering anything.
 *
 * Three rules run through all of it, and they are stated once here:
 *
 *  - A room's occupancy on days 1 and 2 is simply how many people are in it.
 *    The sync refuses a lone occupant who calls themselves double, so the count
 *    and the label can never disagree.
 *  - A room survives to day 3 if anyone in it is on the full itinerary, and its
 *    day-3 occupancy is how many of its occupants are. This is what turns one
 *    shared room into a single for its last night when one roommate leaves
 *    early — and why day 3 has more singles than days 1 and 2, not fewer.
 *  - `bed` belongs to the room, not the night. Nobody changes beds midway.
 */

/** One line of the rooming table: a set of nights and what it needs booked. */
export interface RoomingStage {
  /** How the agent's own messages name these nights. */
  label: string
  rooms: number
  double: number
  single: number
  /** Of the `double` rooms above — the bed question is only asked of those. */
  doubleBed: number
  twinBed: number
}

export interface AirLeg {
  /** ISO, from the flight it is counted off. */
  date: string
  members: number
  detail: string
}

export interface PriceBucket {
  label: string
  people: number
  each: number
  total: number
  /**
   * What this rate is, so the row can itemise itself. See `rateComponents`.
   *
   * No `hostCovers`: the itemisation has to add up to what the agent charges,
   * and that field by definition does not reach it. Including it would leave
   * `rateComponents` short of its own total and print an "Unaccounted for" line
   * for money that is accounted for, just not by them.
   */
  choice: Pick<
    KeralaRoomOccupant,
    'trip' | 'occupancy' | 'flight' | 'priceOverride' | 'soleUseNights'
  >
  /** What these guests owe us, which is nil for our own places. */
  guestPrice: number
  /**
   * How many of `people` are our own places rather than guests.
   *
   * Here so the row can say which of the two reasons its total and its
   * guest price differ by. They read identically in the figures and are
   * nothing alike: a host place is one nobody was ever going to pay us for,
   * and the rest is a guest's share we took on. A row that called the first
   * one "you cover the difference" invited exactly the question of where the
   * difference had come from.
   */
  hosts: number
}

/** One reason a share of the total falls to us rather than to a guest. */
export interface CoveredLine {
  name: string
  amount: number
  /**
   * `host` is one of our own two places, which was never anyone's to pay.
   * `shortfall` is a guest quoted less than the agent went on to charge.
   * `gift` is a guest we decided to pay part of for — the agent charged the
   * ordinary rate and we took some of it off their side, which is why it is not
   * a `shortfall`: nothing about the quote went wrong.
   * `settlement` is a guest who sent less than they were asked — or more, in
   * which case the amount is negative and nets against the rest.
   */
  reason: 'host' | 'shortfall' | 'gift' | 'settlement'
}

/** A guest who owes us their share and has not sent it. */
export interface UncollectedLine {
  name: string
  room: number
  usd: number
}

export interface BillingSummary {
  /** What the agent bills us. What the payment schedule is measured against. */
  total: number
  /** What the guests owe us — our own two places excluded, since they are ours. */
  guestPrices: number
  /** The rest of the total, which is ours. `coveredBy` says why, person by person. */
  covered: number
  coveredBy: CoveredLine[]
  /**
   * Dollars guests have actually sent us. Money in our hands, not the agent's,
   * so it settles the guests' side and leaves `outstanding` alone.
   */
  transferred: number
  /** Dollars still owed to us by guests who have sent nothing. */
  toCollect: number
  toCollectFrom: UncollectedLine[]
  /** How many people the total is made of, for the breakdown's footing. */
  people: number
  paid: number
  outstanding: number
  /** `paid` as a percentage of `total`, or null when nothing is owed yet. */
  paidPct: number | null
  buckets: PriceBucket[]
  /** What has actually gone out, newest last, as recorded in the data file. */
  payments: KeralaPayment[]
  /** The agent's schedule with each row's rupee figure worked out. */
  due: { due: string; amount: number; note?: string }[]
}

export interface KeralaTripSummary {
  travellers: number
  stages: RoomingStage[]
  air: AirLeg[]
  billing: BillingSummary
}

const occupantsOf = (rooms: KeralaRoom[]) => rooms.flatMap((room) => room.occupants)

/**
 * Counts one set of nights.
 *
 * `heads` is what makes days 1-2 and day 3 the same function: it returns how
 * many of a room's occupants are still there, so the caller decides whether
 * leaving early matters rather than this doing it twice.
 */
const stage = (
  label: string,
  rooms: KeralaRoom[],
  heads: (room: KeralaRoom) => number,
): RoomingStage => {
  const held = rooms
    .map((room) => ({ room, heads: heads(room) }))
    .filter((entry) => entry.heads > 0)
  const shared = held.filter((entry) => entry.heads === 2)
  return {
    label,
    rooms: held.length,
    double: shared.length,
    single: held.length - shared.length,
    doubleBed: shared.filter((entry) => entry.room.bed === 'double').length,
    twinBed: shared.filter((entry) => entry.room.bed === 'twin').length,
  }
}

/**
 * Who the agent has to ticket on each leg.
 *
 * A one-way guest is on the outbound and nothing else — that is what the two
 * flight answers mean. So the filter is trip-membership on the way out, and
 * trip-membership *and* a round-trip booking on the way back.
 *
 * The detail says only which itinerary and which airports. It used to add
 * "return tickets only", which reads as a class of ticket the agent might sell:
 * nobody is flying home without having flown out, and the real distinction —
 * round trip versus one way — is already the reason the number is what it is.
 */
const airLegs = (occupants: KeralaRoomOccupant[]): AirLeg[] =>
  flights
    .map((leg) => ({
      date: leg.date,
      members: occupants.filter(
        (occupant) =>
          leg.trips.includes(occupant.trip) && (leg.leg === 'out' || occupant.flight === 'rt'),
      ).length,
      detail: `${leg.scope}, ${leg.from.code} → ${leg.to.code}`,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

/**
 * Exported because the rate-card table on /admin/kerala-trip names its rows the
 * same way the buckets do, minus the flight — so a breakdown label reads as one
 * of those rows plus one of its columns, rather than as unrelated wording.
 */
export const TRIP_LABEL = { full: 'Full', short: 'Shortened' } as const
const FLIGHT_LABEL = { rt: 'round trip', ow: 'one way' } as const

/**
 * The total, and the rows it is made of.
 *
 * Grouped rather than summed flat so the figure is checkable against the
 * agent's invoice line by line. An override is its own bucket per person: it
 * describes a stay the rate card has no row for, so folding it into one would
 * quote a rate nobody was charged.
 */
const priceBuckets = (occupants: KeralaRoomOccupant[]): PriceBucket[] => {
  const buckets = new Map<string, PriceBucket>()
  for (const occupant of occupants) {
    // The agent's figure, not the guest's. This total is what the payment
    // schedule is paid against; what a guest was quoted is tracked beside it.
    const each = keralaAgentCost(occupant)
    if (!each) continue
    // `hostCovers` is deliberately not one of these. This table is the agent's
    // view -- it is what gets read back against their invoice, and shared with
    // them -- and a guest we are subsidising is an ordinary line on it at an
    // ordinary rate. Calling them an exception would describe an arrangement
    // the agent is not part of and cannot see in their own figures.
    const exception = occupant.priceOverride !== undefined || occupant.soleUseNights !== undefined
    const label = exception
      ? `Price exception · ${occupant.name}`
      : `${TRIP_LABEL[occupant.trip]} · ${occupant.occupancy} occupancy · ${FLIGHT_LABEL[occupant.flight]}`
    const bucket = buckets.get(label) ?? {
      label,
      people: 0,
      each,
      total: 0,
      guestPrice: 0,
      hosts: 0,
      choice: {
        trip: occupant.trip,
        occupancy: occupant.occupancy,
        flight: occupant.flight,
        ...(occupant.priceOverride !== undefined ? { priceOverride: occupant.priceOverride } : {}),
        ...(occupant.soleUseNights !== undefined ? { soleUseNights: occupant.soleUseNights } : {}),
      },
    }
    // Nil for a host: their place is not money a guest owes us. Otherwise the
    // price they were quoted, which for one guest is less than `each`.
    bucket.guestPrice += occupant.host ? 0 : (keralaPrice(occupant) ?? each)
    bucket.people += 1
    if (occupant.host) bucket.hosts += 1
    bucket.total += each
    buckets.set(label, bucket)
  }
  return [...buckets.values()].sort((a, b) => b.total - a.total)
}

const summarizeBilling = (rooms: KeralaRoom[], billing: KeralaBilling | null): BillingSummary => {
  const occupants = occupantsOf(rooms)
  const buckets = priceBuckets(occupants)
  const total = buckets.reduce((sum, bucket) => sum + bucket.total, 0)

  // Named, because "you are covering" is a figure worth being able to take
  // apart: two of those names are ours and the rest are quotes that have aged,
  // and they are owed different follow-ups.
  //
  // One occupant can produce two lines, which is why this is a flatMap: the two
  // reasons are independent, and a guest could be both quoted before a cost was
  // understood and subsidised on top of it. `hostCovers` is taken out of the
  // shortfall rather than counted twice, so the lines still sum to the gap
  // between what the agent charges for someone and what they were asked for.
  const coveredBy: CoveredLine[] = occupants.flatMap((occupant): CoveredLine[] => {
    const cost = keralaAgentCost(occupant)
    if (occupant.host) return [{ name: occupant.name, amount: cost, reason: 'host' as const }]
    const lines: CoveredLine[] = []
    if (occupant.hostCovers) {
      lines.push({ name: occupant.name, amount: occupant.hostCovers, reason: 'gift' as const })
    }
    const shortfall = cost - (keralaPrice(occupant) ?? cost) - (occupant.hostCovers ?? 0)
    if (shortfall > 0) {
      lines.push({ name: occupant.name, amount: shortfall, reason: 'shortfall' as const })
    }
    return lines
  })

  // What guests have sent us, and what they still owe. Their money reaches us,
  // never the agent, so it settles their side of the ledger and leaves
  // `outstanding` — what the agent is owed — exactly where it was.
  const transferred = occupants.reduce((sum, occupant) => sum + (occupant.payment?.usd ?? 0), 0)

  const toCollectFrom: UncollectedLine[] = occupants
    .filter((occupant) => !occupant.host && !occupant.payment)
    .map((occupant) => ({
      name: occupant.name,
      room: rooms.find((room) => room.occupants.includes(occupant))?.room ?? 0,
      usd: askedUsd(occupant),
    }))
    .sort((a, b) => a.room - b.room)

  // A payment against what that payment was for: the payer's own share plus any
  // roommate whose share went in with it. Compared in whole dollars at the rate
  // guests were quoted, which is what makes a guest who sent exactly what they
  // were asked come out at nil rather than a few cents adrift.
  for (const occupant of occupants) {
    const sent = occupant.payment?.usd
    if (sent === undefined) continue
    // Their own share, plus any roommate whose share went in with this payment.
    const room = rooms.find((candidate) => candidate.occupants.includes(occupant))
    const covers = [
      occupant,
      ...(room?.occupants ?? []).filter(
        (other) => other !== occupant && other.payment?.via === 'roommate',
      ),
    ]
    const owed = covers.reduce((sum, person) => sum + askedUsd(person), 0)
    if (sent === owed) continue
    // At the rate they were quoted, not today's: the gap is a fact about a
    // transaction that already happened, and it should not move when the
    // conversion box on the page is retyped.
    coveredBy.push({
      name: occupant.name,
      // Positive is ours to absorb; a guest who overpaid nets against the rest.
      amount: (owed - sent) * QUOTED_AT_INR_PER_USD,
      reason: 'settlement' as const,
    })
  }
  coveredBy.sort((a, b) => b.amount - a.amount)

  const payments = billing?.payments ?? []
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0)

  // A row with a percentage is that share of the whole; the rows without one
  // split whatever is left after the paid instalments and the fixed shares.
  const scheduled = billing?.schedule ?? []
  const fixed: (number | null)[] = scheduled.map((row) =>
    row.pct === undefined ? null : Math.round((total * row.pct) / 100),
  )
  const remainderRows = fixed.filter((amount) => amount === null).length
  const remainder = total - paid - fixed.reduce<number>((sum, amount) => sum + (amount ?? 0), 0)

  // The sum of its own parts, rather than `total` minus what guests were asked.
  // Those two agreed until a guest sent less than they were asked: that gap is
  // ours as surely as our own places are, and a figure whose breakdown does not
  // add up to it is worse than no breakdown. What guests are paying then falls
  // out of it — what is left of the total once ours is taken off.
  const covered = coveredBy.reduce((sum, line) => sum + line.amount, 0)

  return {
    total,
    guestPrices: total - covered,
    covered,
    coveredBy,
    transferred,
    toCollect: toCollectFrom.reduce((sum, line) => sum + line.usd, 0),
    toCollectFrom,
    // Off the buckets rather than the occupant list: a price the rate card
    // cannot name is left out of both, so the count and the total always
    // describe the same set of people.
    people: buckets.reduce((sum, bucket) => sum + bucket.people, 0),
    paid,
    outstanding: total - paid,
    paidPct: total > 0 ? (paid / total) * 100 : null,
    buckets,
    payments,
    due: scheduled.map((row, index) => ({
      due: row.due,
      amount: fixed[index] ?? Math.round(remainder / remainderRows),
      note: row.note,
    })),
  }
}

export function summarizeKeralaTrip(
  rooms: KeralaRoom[],
  billing: KeralaBilling | null,
): KeralaTripSummary {
  const occupants = occupantsOf(rooms)
  return {
    travellers: occupants.length,
    stages: [
      stage('Day 1 and 2', rooms, (room) => room.occupants.length),
      stage(
        'Day 3',
        rooms,
        (room) => room.occupants.filter((occupant) => occupant.trip === 'full').length,
      ),
    ],
    air: airLegs(occupants),
    billing: summarizeBilling(rooms, billing),
  }
}

/** What a room with nobody left in it shows under Night 3. */
export const CHECKED_OUT = '—'

/**
 * What the Paid column shows for a room where nobody owes anything.
 *
 * The same glyph as `CHECKED_OUT` and a different fact, which is why both are
 * named: one shared label map spelled this one out as "checked out" in the
 * filter menu, and a dash is exactly the sort of value that invites it.
 */
export const NOBODY_OWES = '—'

/**
 * What the Beds column shows for a single-occupancy room.
 *
 * Nobody in one was asked which bed they wanted, so there is nothing to report
 * -- but a blank cell in a table where every other gap is a dash reads as data
 * missing rather than data that was never collected. The filter menu calls this
 * group "Single", which a cell cannot: beside a bed type the word means the
 * furniture, and these rooms are single by occupancy.
 */
export const NO_BED_ASKED = '—'

/** What one guest has sent, as the room-by-room table shows it. */
export interface RoomGuest {
  name: string
  /** `$589`, or empty for a guest with nothing of their own to show. */
  paid: string
  /** Which service, for the icon. Absent unless they paid one themselves. */
  via?: 'zelle' | 'venmo' | 'paypal'
  /** `A` or `J` — who the money reached. */
  to?: string
  /** `Covered`, `To be paid`, or empty. */
  note: string
  /** The same, spelled out, since an initial and an icon are not a label. */
  hint: string
}

/** Whether a room's guests have settled up. `—` when nobody in it owes. */
export type RoomPaid = 'Yes' | 'No' | 'Partial' | '—'

/** One line of the room-by-room table, flattened so it can be sorted on. */
export interface RoomRow {
  room: number
  beds: string
  /** Sortable and filterable; `people` is what the cell actually renders. */
  guests: string
  people: RoomGuest[]
  paid: RoomPaid
  nights12: string
  night3: string
}

const PAID_TO = { anupama: 'A', jackson: 'J' } as const
const PAID_TO_NAME = { anupama: 'Anupama', jackson: 'Jackson' } as const
const PAID_VIA_NAME = { zelle: 'Zelle', venmo: 'Venmo', paypal: 'PayPal' } as const

/**
 * How one guest's payment reads beside their name.
 *
 * An initial for who it reached and an icon for how it got there, because this
 * sits under a name inside a table cell. Both are shorthand, so `hint` spells
 * the pair out for a `title` and for a screen reader.
 */
const guestPayment = (occupant: KeralaRoomOccupant): Omit<RoomGuest, 'name'> => {
  const payment = occupant.payment
  // A host is nobody to chase: their share is not money a guest was going to
  // send, it is ours to settle with the agent. "Has not paid yet" reads as
  // chasing ourselves for it; "To be paid" says the same fact without that.
  if (occupant.host)
    return { paid: '', note: 'To be paid', hint: 'Your own place, still to be paid' }
  if (!payment) return { paid: '', note: '', hint: 'Has not paid yet' }
  if (payment.via === 'roommate') {
    // "Covered" alone in the cell: their roommate is the name directly above or
    // below it, so naming them again spends width saying what the grouping has
    // already said. The full sentence stays in `hint`, where there is room.
    return {
      paid: '',
      note: 'Covered',
      hint: payment.paidBy ? `Covered by ${payment.paidBy}` : 'Covered by a roommate',
    }
  }
  return {
    paid: `$${(payment.usd ?? 0).toLocaleString('en-US')}`,
    via: payment.via,
    to: payment.to ? PAID_TO[payment.to] : undefined,
    note: '',
    hint: `Paid ${payment.to ? PAID_TO_NAME[payment.to] : 'us'} by ${PAID_VIA_NAME[payment.via]}`,
  }
}

/**
 * Whether a room has settled up, for the column that can be filtered on.
 *
 * Counted over the guests who owe something. A room of hosts owes nothing, so
 * it is neither paid nor unpaid — an em dash, which also keeps it out of the
 * way when the filter is narrowed to the rooms that still owe.
 */
const roomPaid = (occupants: KeralaRoomOccupant[]): RoomPaid => {
  const owing = occupants.filter((occupant) => !occupant.host)
  if (owing.length === 0) return NOBODY_OWES
  const settled = owing.filter((occupant) => occupant.payment).length
  if (settled === 0) return 'No'
  return settled === owing.length ? 'Yes' : 'Partial'
}

/**
 * Every room as one sortable, filterable row.
 *
 * Flattened to strings here rather than in the table, because the column menus
 * offer whatever distinct values a column holds — and a menu built from
 * `'double' | 'twin' | undefined` would offer to filter on "undefined".
 *
 * Occupancy is a head count per stage rather than the words "double" and
 * "single". Those are the right words for the summary tables, which count rooms
 * by category, but in a row that also names a bed they collide: an occupancy
 * "Double" beside a bed "Double" reads as one fact stated twice, when one is
 * the furniture and the other is how many people are in it. Numbers cannot be
 * misread that way, and having both stages side by side is what makes a room
 * like 13 legible — two people, then one, on the same two twin beds.
 *
 * A single-occupancy room reports `NO_BED_ASKED` rather than nothing; see there
 * for why the dash, and why the word only appears in the filter menu.
 */
export const roomRows = (rooms: KeralaRoom[]): RoomRow[] =>
  rooms.map((room) => {
    const staying = room.occupants.filter((occupant) => occupant.trip === 'full').length
    return {
      room: room.room,
      // "Double", not "Double bed": the column is headed Beds, so the noun is
      // already said, and the word it saves is what keeps the cell from wrapping
      // in a table that has no width to spare.
      beds: room.bed === 'double' ? 'Double' : room.bed === 'twin' ? 'Twin' : NO_BED_ASKED,
      guests: room.occupants.map((occupant) => occupant.name).join(', '),
      people: room.occupants.map((occupant) => ({
        name: occupant.name,
        ...guestPayment(occupant),
      })),
      paid: roomPaid(room.occupants),
      nights12: String(room.occupants.length),
      night3: staying === 0 ? CHECKED_OUT : String(staying),
    }
  })

/** `2026-10-29` → `29 Oct`, the way the agent's own messages write it. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const shortDate = (iso: string) => {
  const [, month, day] = iso.split('-')
  return `${Number(day)} ${MONTHS[Number(month) - 1]}`
}

export const longDate = (iso: string) => {
  const [year, month, day] = iso.split('-')
  return `${MONTHS[Number(month) - 1]} ${Number(day)}, ${year}`
}

/** Rupees as the agent writes them: `₹23,58,724`, lakhs and all. */
export const inr = (amount: number) => `₹${Math.round(amount).toLocaleString('en-IN')}`

/**
 * Dollars to the cent, not to the nearest dollar.
 *
 * Whole dollars hid the conversion doing its work: rounding each figure to the
 * nearest dollar made the columns stop tying out, so guests-paying plus
 * you-are-covering came to a dollar more than the total above them. Two decimal
 * places make the arithmetic visible instead of quietly wrong-looking.
 *
 * It does not make the drift zero — three figures rounded to the cent can still
 * miss their own total by a cent — but a cent reads as rounding where a dollar
 * reads as a mistake. Rupees remain the figures to quote anyone; these are for
 * a sense of scale.
 */
export const usdAt = (amount: number, rate: number) =>
  `$${(amount / rate).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

export type Currency = 'inr' | 'usd'

/**
 * A formatter for one currency at one rate.
 *
 * Every quote from the agent is in rupees, so those are what is stored and the
 * dollars are always derived. `rate` is a parameter rather than the INR_PER_USD
 * constant because the constant is a snapshot: when the point is to work out
 * what a payment is about to cost, the rate that matters is today's, and typing
 * it in beats redeploying the site.
 */
export const money =
  (currency: Currency, rate: number) =>
  (amount: number): string =>
    currency === 'inr' ? inr(amount) : usdAt(amount, rate)

/**
 * The message that gets pasted into the email.
 *
 * Written to match the wording already used with the agent rather than anything
 * this page invented — they have answered these sentences a dozen times, and a
 * reworded version is a version they have to read properly.
 */
export const roomingBlurb = (summary: KeralaTripSummary) =>
  [
    ...summary.stages.map(
      (nights) =>
        `${nights.label}: ${nights.rooms} rooms total — ${nights.double} double and ${nights.single} single occupancy`,
    ),
    '',
    ...summary.stages.map(
      (nights) =>
        `${nights.label}: ${nights.double} double occupancy rooms — ${nights.doubleBed} double bed and ${nights.twinBed} twin bed`,
    ),
    '',
    'Air tickets',
    ...summary.air.map((leg) => `${shortDate(leg.date)}: ${leg.members} members`),
  ].join('\n')

/**
 * `format` rather than always rupees: the page has a currency switch, and a
 * copy button that ignores the switch beside it hands over figures in the
 * currency you just switched away from.
 */
export const paymentsBlurb = (summary: KeralaTripSummary, format: (amount: number) => string) =>
  [
    `Total: ${format(summary.billing.total)}`,
    `Paid to date: ${format(summary.billing.paid)}`,
    `Outstanding: ${format(summary.billing.outstanding)}`,
    '',
    ...summary.billing.due.map(
      (row) => `${longDate(row.due)}: ${format(row.amount)}${row.note ? ` (${row.note})` : ''}`,
    ),
  ].join('\n')
