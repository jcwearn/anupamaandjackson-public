/**
 * The Kerala trip rate card, and the lookup into it.
 *
 * Split out of KeralaItinerary.tsx for the reason inr.ts was: that file exports
 * a route component, and a module exporting both a component and non-components
 * breaks fast refresh -- react/only-export-components, an error in .oxlintrc.json.
 *
 * It also has a second reader now. /admin/kerala-trip totals the whole party up
 * from these same rows, and a copy of the table over there is a copy that can go
 * stale: the page would quietly tell us we owe a number no guest was ever quoted.
 * One table, two callers.
 */

import type { KeralaGuestInfo } from './useGuestSchedule'

// Quotes come in rupees, so those are what we store; the dollar figures guests
// see are derived, and go stale as the rate moves. Update the rate, not the table.

/**
 * What the agent charges for the land portion, per person — their figures, for
 * each itinerary at each occupancy. No flights in these.
 *
 * The shortened double-occupancy figure is 24,700 because they corrected it:
 * the first quote said 30,540, and a later message put the two nights of 29 and
 * 30 October at 24,700. Anything still quoting 30,540 predates that.
 */
export const LAND_COST = {
  full: { double: 39840, single: 73680 },
  short: { double: 24700, single: 44540 },
} as const

/**
 * Their per-person airfare for the legs the rate card was quoted off. The legs
 * differ.
 */
export const AIRFARE = { out: 8352, back: 7968 } as const

/**
 * What the return leg actually costs, which is not one figure.
 *
 * The two itineraries fly home on different days on different aircraft — 6E 951
 * on 1 November and 6E 6681 on 31 October, both already spelled out in
 * keralaFlights.ts — and the agent's invoice prices them apart: 7,968 and 6,895.
 * The rate card was built before that invoice arrived, off the one return fare
 * we had, so every shortened round trip on it is 1,073 too dear.
 *
 * Both figures stay, because both are true of different things. `AIRFARE.back`
 * is what three guests were quoted, told in dollars, and in two cases have
 * already paid; they are not being re-invoiced over eleven dollars each, so the
 * price they see must not move. This one is what the agent bills us, and it is
 * the only one the /admin/kerala-trip total may use. The gap between them is
 * money we are holding above the invoice, and the page says so rather than
 * quietly keeping it.
 *
 * `full` is written as `AIRFARE.back` and not as 7,968 so a correction to one
 * cannot leave the other behind.
 */
export const INVOICED_BACK = { full: AIRFARE.back, short: 6895 } as const

/** How many nights on the ground each itinerary buys. */
export const NIGHTS = { full: 3, short: 2 } as const

const rateRow = (trip: 'full' | 'short', occ: 'double' | 'single', occupancy: string) => ({
  occ,
  occupancy,
  // A one-way guest flies out with the group and makes their own way home, so
  // they pay the land cost and the outbound leg only.
  oneWay: LAND_COST[trip][occ] + AIRFARE.out,
  roundTrip: LAND_COST[trip][occ] + AIRFARE.out + AIRFARE.back,
})

/**
 * The eight rates, added up rather than written down.
 *
 * They used to be eight literals, which is how a rate card and its own
 * breakdown drift apart: the agent corrected one land cost mid-quote, and a
 * table of totals gives you no way to tell whether the correction landed.
 * Composed from `LAND_COST` and `AIRFARE`, every total is the sum of figures
 * they actually sent, and correcting one of those corrects the card with it.
 */
export const pricing: {
  trip: 'full' | 'short'
  title: string
  dates: string
  rows: { occ: 'double' | 'single'; occupancy: string; roundTrip: number; oneWay: number }[]
}[] = [
  {
    trip: 'full',
    title: 'Full itinerary',
    dates: 'October 29 – November 1 · 3 nights',
    rows: [
      rateRow('full', 'double', 'Double occupancy (per person)'),
      rateRow('full', 'single', 'Single occupancy'),
    ],
  },
  {
    trip: 'short',
    title: 'Shortened itinerary',
    dates: 'October 29 – 31 · 2 nights',
    rows: [
      rateRow('short', 'double', 'Double occupancy (per person)'),
      rateRow('short', 'single', 'Single occupancy'),
    ],
  },
]

/**
 * What one person pays, in rupees.
 *
 * An override wins outright: it exists for a stay none of the rows above
 * describe, so falling back to a row would quote the wrong trip. Returns null
 * only if the table has no row for the combination, which the types make
 * unreachable — it is there so a bad row in the data file surfaces as a blank
 * rather than a NaN propagating into a total.
 *
 * `hostCovers` comes off whichever figure won, rather than replacing it, so the
 * two compose: a guest can be quoted an exceptional rate *and* have part of it
 * on us. See the type for why it is not simply a smaller `priceOverride`.
 */
export const keralaPrice = (
  choice: Pick<KeralaGuestInfo, 'trip' | 'flight' | 'occupancy'> & {
    priceOverride?: number
    hostCovers?: number
  },
): number | null => {
  const covered = choice.hostCovers ?? 0
  if (choice.priceOverride !== undefined) return choice.priceOverride - covered
  const row = pricing
    .find((option) => option.trip === choice.trip)
    ?.rows.find((candidate) => candidate.occ === choice.occupancy)
  if (!row) return null
  return (choice.flight === 'rt' ? row.roundTrip : row.oneWay) - covered
}

/**
 * Everything a price depends on.
 *
 * `priceOverride` is what the *guest* was asked to pay; `soleUseNights` is what
 * the *agent* charges us on top of the rate card. They are separate because
 * they have come apart: one guest was quoted before we worked the sole-use
 * night out properly, has paid that figure, and is not being re-invoiced — so
 * the difference is ours to absorb, and both numbers have to be tracked to see
 * it. See `keralaPrice` for the first and `keralaAgentCost` for the second.
 *
 * `hostCovers` is a third thing again, and the reason it is not spelled as a
 * smaller `priceOverride`: an override moves what the agent bills, because it
 * describes a stay the rate card cannot price. This one does not. The guest is
 * an ordinary line on the agent's invoice at an ordinary rate, and we have
 * simply decided to pay part of their share for them. Writing it as an override
 * would quietly take the difference off the total we owe — money the agent is
 * still going to ask for — and would file them under "price exception" in a
 * breakdown meant for the agent, who has no exception to hear about.
 */
export type PriceChoice = Pick<KeralaGuestInfo, 'trip' | 'flight' | 'occupancy'> & {
  priceOverride?: number
  soleUseNights?: number
  hostCovers?: number
}

/**
 * The rate guests were quoted at, and paid at.
 *
 * Not `INR_PER_USD`, which is for display and moves whenever the box on
 * /admin/kerala-trip is retyped. A guest was asked for a whole number of
 * dollars once, and settling their payment has to compare against that figure
 * rather than against whatever the rate is today — otherwise every guest churns
 * between settled and short each time the rate ticks.
 *
 * It happens to equal INR_PER_USD right now. It is a separate constant because
 * the two mean different things and will not stay equal.
 */
export const QUOTED_AT_INR_PER_USD = 95.31

/**
 * What the agent invoices for one ordinary stay, before anything exceptional.
 *
 * Deliberately not `keralaPrice`, which this used to go through. That function
 * answers what the *guest* pays, and since the invoice arrived the two have come
 * apart on the shortened round trip — see `INVOICED_BACK`. Routing the agent's
 * total through the guests' rate card would bill us for the eleven dollars each
 * that we are holding, which is the one direction an invoice must never be
 * wrong in.
 */
const invoicedRate = (trip: 'full' | 'short', occ: 'double' | 'single', flight: 'rt' | 'ow') =>
  LAND_COST[trip][occ] + AIRFARE.out + (flight === 'rt' ? INVOICED_BACK[trip] : 0)

/**
 * What sole use of a shared room costs for the trip's final night.
 *
 * One respondent is in this position: their roommate leaves after night two, so
 * their third night is a single room they are not being charged a single rate
 * for. Not a rate the agent ever sent — they have never priced a part-night —
 * but one their own numbers bracket, by subtraction:
 *
 *   night three, single: 73,680 − 44,540 = 29,140
 *   night three, double: 39,840 − 24,700 = 15,140
 *   occupancy delta:                       14,000
 *
 * The subtraction is what makes any of these trustworthy. Everything about that
 * day which does not depend on occupancy (the extra day's transport, meals,
 * sightseeing) appears in both marginals and cancels; only the room survives.
 * That is why an earlier figure of 11,280 was wrong: it came from spreading the
 * full supplement evenly over three nights, an assumption their own numbers
 * contradict, since the same split over the shortened itinerary gives 9,920.
 *
 * What subtraction could not settle is *which* of the survivors they charge, and
 * this was 14,000 for a while — the occupancy delta, on the reasoning that the
 * room is bought at the double rate either way and only the empty bed is new. It
 * cross-checked against their supplements, 33,840 − 19,840 = 14,000, and it was
 * still wrong. Their invoice bills that guest's land at 54,980, which is
 * 39,840 + 15,140: they charge the whole third night at the double rate, as
 * though the room were being taken afresh. So it is the double-occupancy
 * marginal, the two cross-checking derivations agreed with each other and not
 * with the invoice, and the moral is that a figure nobody has been billed for
 * yet is a hypothesis however many ways it is reachable.
 */
export const SOLE_USE_FINAL_NIGHT = LAND_COST.full.double - LAND_COST.short.double

/**
 * What the agent bills us for one person — which is not always what the guest
 * was asked to pay.
 *
 * `soleUseNights` is the honest version of a price exception: the fact about
 * the stay, rather than a total someone worked out once. The cost follows from
 * it, so a change to the rate card carries through instead of stranding a
 * number. A `priceOverride` with no sole-use nights still stands in, for an
 * exception of some other kind that nothing here can derive.
 *
 * `hostCovers` is absent from every branch, which is the whole point of it being
 * its own field: it is a transfer between us and the guest, the agent is not
 * party to it, and it must not reach a figure they are going to invoice. It used
 * to be added back on here, because the old spelling went through `keralaPrice`
 * and had to undo that function's subtraction. Nothing subtracts it now, so
 * nothing puts it back.
 *
 * Which is the point of the rewrite. This used to read
 * `(keralaPrice(choice) ?? base) + hostCovers`, and that was only ever shorthand
 * for "the rate" — it stopped meaning the same thing the moment a guest's price
 * and their invoice line came apart on the shortened round trip.
 */
export const keralaAgentCost = (choice: PriceChoice): number => {
  const base = invoicedRate(choice.trip, choice.occupancy, choice.flight)
  if (choice.soleUseNights) return base + choice.soleUseNights * SOLE_USE_FINAL_NIGHT
  if (choice.priceOverride !== undefined) return choice.priceOverride
  return base
}

/**
 * The whole dollars a guest was asked for.
 *
 * Rounded, because that is what they were told: the rate card's ₹48,192 was
 * quoted as $506, and a guest who sends exactly $506 has settled even though
 * the true conversion is $505.63. Comparing against the unrounded figure made
 * seventeen of nineteen payers look a few cents out and buried the two that
 * genuinely are.
 */
export const askedUsd = (choice: PriceChoice): number =>
  Math.round((keralaPrice(choice) ?? 0) / QUOTED_AT_INR_PER_USD)

/** What the guest is out of pocket beyond their own price, and we absorb. */
export const keralaShortfall = (choice: PriceChoice): number =>
  keralaAgentCost(choice) - (keralaPrice(choice) ?? 0)

/** The arithmetic behind a line, so the page can show it rather than assert it. */
export interface SoleUseWorking {
  nights: number
  perNight: number
  /** What the final night costs at each occupancy, and where each comes from. */
  singleNight: number
  doubleNight: number
  fullSingle: number
  shortSingle: number
  fullDouble: number
  shortDouble: number
}

export interface RateComponent {
  label: string
  amount: number
  /**
   * True for a figure the agent sent us verbatim. Their land costs and their two
   * airfares add up to all eight cells exactly, so every part of a plain rate is
   * one. A sole-use night is not: it is those figures subtracted from each
   * other, which is a weaker claim and should not wear the same badge.
   */
  quoted?: boolean
  /** Present on a line that is arithmetic on their figures rather than one of them. */
  working?: SoleUseWorking
}

/**
 * One rate, itemised into the figures it was built from.
 *
 * Not a reconstruction: `pricing` is composed out of these, so the parts are the
 * source and the total is the derived thing rather than the other way round.
 *
 * An override is the exception. It gets the components of the rate it departs
 * from plus the difference, and that difference is ours rather than theirs.
 *
 * A remainder line appears if the parts ever stop adding up. It should be
 * unreachable, and the test pins that, but a display that quietly showed the
 * wrong arithmetic would be worse than one that admits to a gap.
 */
export const rateComponents = (choice: PriceChoice): RateComponent[] => {
  const { trip, occupancy, flight } = choice
  const parts: RateComponent[] = [
    {
      label: `Land · ${NIGHTS[trip]} nights, ${occupancy} occupancy`,
      amount: LAND_COST[trip][occupancy],
      quoted: true,
    },
    { label: 'Airfare · HYD → COK', amount: AIRFARE.out, quoted: true },
  ]
  if (flight === 'rt') {
    // The invoiced fare, not the quoted one. These parts itemise
    // `keralaAgentCost`, and this breakdown is what gets read back against the
    // agent's invoice; the rate card's single return fare would leave every
    // shortened round trip 1,073 short of its own total and fire the
    // "Unaccounted for" line below at three guests who have no exception
    // between them.
    parts.push({ label: 'Airfare · COK → HYD', amount: INVOICED_BACK[trip], quoted: true })
  }
  if (choice.soleUseNights) {
    parts.push({
      label: `Sole use of the room · ${choice.soleUseNights === 1 ? 'final night' : `${choice.soleUseNights} nights`}`,
      amount: choice.soleUseNights * SOLE_USE_FINAL_NIGHT,
      // Deliberately not `quoted`. It is arithmetic on four of their figures
      // rather than one they sent, and the difference matters: this is the
      // only line on the page nobody could read back off an email. `working`
      // below is what it has instead of a badge.
      working: {
        nights: choice.soleUseNights,
        perNight: SOLE_USE_FINAL_NIGHT,
        singleNight: LAND_COST.full.single - LAND_COST.short.single,
        doubleNight: LAND_COST.full.double - LAND_COST.short.double,
        fullSingle: LAND_COST.full.single,
        shortSingle: LAND_COST.short.single,
        fullDouble: LAND_COST.full.double,
        shortDouble: LAND_COST.short.double,
      },
    })
  }

  const target = keralaAgentCost(choice)
  const shortfall = target - parts.reduce((sum, part) => sum + part.amount, 0)
  if (shortfall !== 0) parts.push({ label: 'Unaccounted for', amount: shortfall })
  return parts
}

/** Every figure the agent has given us, as one list. */
export const quotedFigures = (): { label: string; amount: number }[] => [
  ...(['full', 'short'] as const).flatMap((trip) =>
    (['double', 'single'] as const).map((occ) => ({
      label: `Land · ${trip === 'full' ? 'Full' : 'Shortened'} itinerary, ${occ} occupancy`,
      amount: LAND_COST[trip][occ],
    })),
  ),
  { label: 'Airfare · HYD → COK', amount: AIRFARE.out },
  // Two return fares and one outbound, because the itineraries fly home on
  // different days and the agent prices those apart. Listing one would misstate
  // what they have told us, which is the one thing this list is for.
  { label: 'Airfare · COK → HYD · Full itinerary', amount: INVOICED_BACK.full },
  { label: 'Airfare · COK → HYD · Shortened itinerary', amount: INVOICED_BACK.short },
]
