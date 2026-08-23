import { describe, expect, it } from 'vitest'
import {
  AIRFARE,
  INVOICED_BACK,
  LAND_COST,
  askedUsd,
  keralaAgentCost,
  keralaPrice,
  keralaShortfall,
  SOLE_USE_FINAL_NIGHT,
  pricing,
  rateComponents,
} from './keralaPricing'

/**
 * The table is what guests are quoted and what /admin/kerala-trip bills off, so
 * these pin every cell of it. A rate that moves should break this file — that
 * is the point of writing the numbers down twice.
 */
describe('keralaPrice', () => {
  it('reads every cell of the rate card', () => {
    expect(keralaPrice({ trip: 'full', occupancy: 'double', flight: 'rt' })).toBe(56160)
    expect(keralaPrice({ trip: 'full', occupancy: 'double', flight: 'ow' })).toBe(48192)
    expect(keralaPrice({ trip: 'full', occupancy: 'single', flight: 'rt' })).toBe(90000)
    expect(keralaPrice({ trip: 'full', occupancy: 'single', flight: 'ow' })).toBe(82032)
    expect(keralaPrice({ trip: 'short', occupancy: 'double', flight: 'rt' })).toBe(41020)
    expect(keralaPrice({ trip: 'short', occupancy: 'double', flight: 'ow' })).toBe(33052)
    expect(keralaPrice({ trip: 'short', occupancy: 'single', flight: 'rt' })).toBe(60860)
    expect(keralaPrice({ trip: 'short', occupancy: 'single', flight: 'ow' })).toBe(52892)
  })

  it('lets an override win outright', () => {
    // It exists for a stay none of the rows describe, so falling back to a row
    // would quote the wrong trip rather than a near-enough one.
    expect(
      keralaPrice({ trip: 'full', occupancy: 'double', flight: 'rt', priceOverride: 67440 }),
    ).toBe(67440)
  })

  it('itemises every one of the eight rates to the rupee', () => {
    // The whole claim behind the expandable rows on /admin/kerala-trip. If the
    // parts ever stop summing to the rate, this fails here rather than the page
    // quietly showing a breakdown that misses its own total.
    //
    // Against `keralaAgentCost` and not `keralaPrice`, which is what it used to
    // compare with. Those were the same function for every guest until the
    // invoice split the return fare by itinerary; the breakdown itemises the
    // agent's line, so the agent's figure is what it has to foot to.
    for (const option of pricing) {
      for (const row of option.rows) {
        for (const flight of ['rt', 'ow'] as const) {
          const choice = { trip: option.trip, occupancy: row.occ, flight }
          const parts = rateComponents(choice)
          expect(parts.map((part) => part.label)).not.toContain('Unaccounted for')
          expect(parts.reduce((sum, part) => sum + part.amount, 0)).toBe(keralaAgentCost(choice))
        }
      }
    }
  })

  it('separates every rate into the figures the agent actually sent', () => {
    // Their land costs and their two airfares, nothing of ours. The whole card
    // is composed from these, so a "component" here is the source rather than a
    // reconstruction of the total.
    expect(rateComponents({ trip: 'short', occupancy: 'double', flight: 'ow' })).toEqual([
      { label: 'Land · 2 nights, double occupancy', amount: 24700, quoted: true },
      { label: 'Airfare · HYD → COK', amount: 8352, quoted: true },
    ])
    expect(rateComponents({ trip: 'full', occupancy: 'single', flight: 'rt' })).toEqual([
      { label: 'Land · 3 nights, single occupancy', amount: 73680, quoted: true },
      { label: 'Airfare · HYD → COK', amount: 8352, quoted: true },
      { label: 'Airfare · COK → HYD', amount: 7968, quoted: true },
    ])
    // The shortened itinerary flies home a day earlier on a different aircraft,
    // and the invoice prices that leg apart. A breakdown carrying 7,968 here
    // would be itemising a flight nobody on this row is booked on.
    expect(rateComponents({ trip: 'short', occupancy: 'double', flight: 'rt' })).toEqual([
      { label: 'Land · 2 nights, double occupancy', amount: 24700, quoted: true },
      { label: 'Airfare · HYD → COK', amount: 8352, quoted: true },
      { label: 'Airfare · COK → HYD', amount: 6895, quoted: true },
    ])
  })

  it('bills the shortened return leg at the fare the invoice puts on it', () => {
    // The 2,079 that had our total disagreeing with the agent's, one of two
    // halves. We quoted the whole party off a single return fare before their
    // priced package arrived; it turned out to hold two, and the shortened
    // itinerary's is 1,073 cheaper.
    expect(INVOICED_BACK.short).toBe(6895)
    // Not a second copy of 7,968. Written off `AIRFARE.back`, so a correction to
    // the quoted fare cannot leave the invoiced one behind.
    expect(INVOICED_BACK.full).toBe(AIRFARE.back)
    expect(keralaAgentCost({ trip: 'short', occupancy: 'double', flight: 'rt' })).toBe(39947)
    expect(keralaAgentCost({ trip: 'short', occupancy: 'single', flight: 'rt' })).toBe(59787)
  })

  it('leaves the price three guests were quoted exactly where it was', () => {
    // The half of this that must not move. Three guests were told 41,020 and
    // $430, two rooms have paid at it, and nobody is being re-invoiced over
    // eleven dollars — so the guest-facing card holds still while the agent's
    // figure drops beneath it. If this and the test above ever agree again,
    // somebody has quietly re-quoted three people.
    const short = { trip: 'short', occupancy: 'double', flight: 'rt' } as const
    expect(keralaPrice(short)).toBe(41020)
    expect(askedUsd(short)).toBe(430)
    expect(keralaAgentCost(short)).toBe(39947)
    // Negative: they are paying us above what the agent will ask for, which is
    // the opposite of every other gap on the page and has to survive as a sign
    // rather than as an absolute value.
    expect(keralaShortfall(short)).toBe(-1073)
  })

  it('costs the final night of sole use the way the invoice costs it', () => {
    // The night a roommate leaves early. Both marginals are theirs, and
    // everything about that day which is not the room — the extra day's
    // transport, meals, sightseeing — appears in both and cancels, which is
    // what makes either of them trustworthy where the earlier 11,280 was not.
    // That one came from spreading the full supplement evenly over three
    // nights, an assumption their own figures contradict: the same split over
    // the shortened itinerary gives 9,920.
    expect(LAND_COST.full.single - LAND_COST.short.single).toBe(29140)
    expect(LAND_COST.full.double - LAND_COST.short.double).toBe(15140)
    expect(SOLE_USE_FINAL_NIGHT).toBe(15140)
    // Which of the two marginals they charge was the open question, and this
    // asserted the other one — 14,000, the occupancy delta, on the reasoning
    // that the room is bought at the double rate either way. Their invoice
    // settles it: the land line for that guest is 54,980, which is the full
    // itinerary's 39,840 plus a whole third night at the double rate.
    expect(LAND_COST.full.double + SOLE_USE_FINAL_NIGHT).toBe(54980)
    // Pinned as the reading that lost, so a future edit reaching for the
    // elegant derivation has to walk past the invoice to get there.
    expect(
      LAND_COST.full.single -
        LAND_COST.full.double -
        (LAND_COST.short.single - LAND_COST.short.double),
    ).toBe(14000)
  })

  it('does not pass the sole-use night off as one of their own figures', () => {
    const parts = rateComponents({
      trip: 'full',
      occupancy: 'double',
      flight: 'rt',
      soleUseNights: 1,
    })
    expect(parts.at(-1)).toMatchObject({
      label: 'Sole use of the room · final night',
      amount: 15140,
    })
    // Their figures subtracted from each other is a weaker claim than a figure
    // they sent, so it does not wear the same badge — it carries the working
    // instead, which is the honest version of the same reassurance.
    expect(parts.at(-1)?.quoted).toBeUndefined()
    expect(parts.at(-1)?.working).toBeDefined()
    expect(parts.filter((part) => part.quoted)).toHaveLength(3)
    expect(parts.reduce((sum, part) => sum + part.amount, 0)).toBe(56160 + 15140)
  })

  it('keeps what the agent bills apart from what the guest was asked to pay', () => {
    // The two came apart once the sole-use night was worked out properly. The
    // guest had already paid the earlier figure and is not being re-invoiced,
    // so the difference is ours — and both numbers have to be tracked to see it.
    // Named for the fixture guest who stands in for this case elsewhere, not
    // for the real one: this file is published to the public mirror, and a
    // variable name is as identifying as any other string in it.
    const carl = {
      trip: 'full',
      occupancy: 'double',
      flight: 'rt',
      priceOverride: 67440,
      soleUseNights: 1,
    } as const
    expect(keralaPrice(carl)).toBe(67440)
    expect(keralaAgentCost(carl)).toBe(71300)
    expect(keralaShortfall(carl)).toBe(3860)
  })

  it('bills the rate card for everyone whose price has not come apart', () => {
    // Every full-itinerary row, which is 42 of the 45 people on the invoice.
    // Only the shortened round trip diverges.
    const plain = { trip: 'full', occupancy: 'double', flight: 'rt' } as const
    expect(keralaAgentCost(plain)).toBe(keralaPrice(plain))
    expect(keralaShortfall(plain)).toBe(0)
    for (const occupancy of ['double', 'single'] as const) {
      for (const flight of ['rt', 'ow'] as const) {
        expect(keralaShortfall({ trip: 'full', occupancy, flight })).toBe(0)
      }
    }
    // And the one-way rows of the shortened itinerary: they never fly the
    // return leg, so the fare that split cannot reach them.
    for (const occupancy of ['double', 'single'] as const) {
      expect(keralaShortfall({ trip: 'short', occupancy, flight: 'ow' })).toBe(0)
    }
  })

  it('still takes an override at face value when it cannot derive the exception', () => {
    // A price exception with no sole-use night is a figure nothing here can
    // reconstruct, so it stands for both what we owe and what the guest pays,
    // and the working is left off rather than invented.
    const odd = { trip: 'full', occupancy: 'double', flight: 'rt', priceOverride: 61000 } as const
    expect(keralaAgentCost(odd)).toBe(61000)
    expect(keralaShortfall(odd)).toBe(0)
    expect(rateComponents(odd).at(-1)).toMatchObject({ label: 'Unaccounted for' })
    expect(rateComponents(odd).at(-1)?.working).toBeUndefined()
  })

  it('takes what we cover off the guest without taking it off the agent', () => {
    // The distinction the field exists for. The agent invoices this guest at
    // the ordinary single rate; we have simply decided to pay part of their
    // share, so their price drops and the total we owe does not move a rupee.
    const subsidised = {
      trip: 'full',
      occupancy: 'single',
      flight: 'rt',
      hostCovers: 23283,
    } as const
    expect(keralaPrice({ trip: 'full', occupancy: 'single', flight: 'rt' })).toBe(90000)
    expect(keralaPrice(subsidised)).toBe(66717)
    expect(keralaAgentCost(subsidised)).toBe(90000)
    expect(keralaShortfall(subsidised)).toBe(23283)
    // Whole dollars, which is what the guest is actually asked for: 66,717 is
    // 700 × the rate they were quoted at, so it lands on the figure exactly
    // rather than a dollar either side of it.
    expect(askedUsd(subsidised)).toBe(700)
    expect(askedUsd({ trip: 'full', occupancy: 'single', flight: 'rt' })).toBe(944)
  })

  it('itemises a subsidised guest as the plain rate they are billed at', () => {
    // The breakdown is the agent's view, so what we cover must not appear in
    // it — and must not leave it short of its own total either.
    const parts = rateComponents({
      trip: 'full',
      occupancy: 'single',
      flight: 'rt',
      hostCovers: 23283,
    })
    expect(parts.map((part) => part.label)).not.toContain('Unaccounted for')
    expect(parts.every((part) => part.quoted)).toBe(true)
    expect(parts.reduce((sum, part) => sum + part.amount, 0)).toBe(90000)
  })

  it('composes what we cover with an exceptional rate rather than replacing it', () => {
    // Nobody is in this position yet. It is pinned because the two fields mean
    // different things — one is the price they were quoted, one is how much of
    // it is ours — and a future edit that made one win outright would be a
    // silent change to what somebody is asked for.
    const both = {
      trip: 'full',
      occupancy: 'double',
      flight: 'rt',
      priceOverride: 67440,
      soleUseNights: 1,
      hostCovers: 7440,
    } as const
    expect(keralaPrice(both)).toBe(60000)
    expect(keralaAgentCost(both)).toBe(71300)
  })

  it('says so rather than lying when the parts do not add up', () => {
    // Unreachable while the card is composed from these figures, and that is
    // the point: the fallback exists so a future change surfaces as a visible
    // line instead of a column that silently misses its own total.
    const parts = rateComponents({
      trip: 'short',
      occupancy: 'double',
      flight: 'ow',
      priceOverride: LAND_COST.short.double + 5,
    })
    expect(parts.reduce((sum, part) => sum + part.amount, 0)).toBe(LAND_COST.short.double + 5)
  })

  it('builds every cell of the card out of a land cost and the legs flown', () => {
    // The reconciliation that made this restructure possible: all eight totals
    // are the agent's own figures added up, to the rupee.
    for (const option of pricing) {
      for (const row of option.rows) {
        const land = LAND_COST[option.trip][row.occ]
        expect(row.oneWay).toBe(land + AIRFARE.out)
        expect(row.roundTrip).toBe(land + AIRFARE.out + AIRFARE.back)
      }
    }
  })

  it('costs one-way less than round trip on every row', () => {
    // The one-way rate is the round trip minus a leg; a table where that is not
    // true has had a number typed into the wrong column.
    for (const option of pricing) {
      for (const row of option.rows) {
        expect(row.oneWay).toBeLessThan(row.roundTrip)
      }
    }
  })
})
