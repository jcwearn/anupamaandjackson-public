import React, { useCallback, useMemo, useState } from 'react'
import { useAdminContext } from '../lib/adminContext'
import { INR_PER_USD } from '../lib/inr'
import {
  CHECKED_OUT,
  NOBODY_OWES,
  NO_BED_ASKED,
  inr,
  longDate,
  money,
  paymentsBlurb,
  roomRows,
  roomingBlurb,
  shortDate,
  summarizeKeralaTrip,
  usdAt,
  type BillingSummary,
  type CoveredLine,
  type Currency,
  type RoomGuest,
  type RoomRow,
} from '../lib/keralaTripSummary'
import CopyButton from '../components/CopyButton'
import { DownloadIcon } from '../icons/DownloadIcon'
import { PaymentIcon } from '../icons/PaymentIcon'
import { ChevronDownIcon } from '../icons/ChevronDownIcon'
import { QUOTED_AT_INR_PER_USD, quotedFigures, rateComponents } from '../lib/keralaPricing'
import { downloadTableImage } from '../lib/tableImage'
import ColumnMenu, { type SortDir } from '../components/ColumnMenu'
import { Disclosure } from '../components/Disclosure'

/**
 * The answers the travel agent keeps asking for, in one place.
 *
 * Everything on this page is counted off the rooming in the encrypted admin
 * payload — nothing here is typed in twice. That is the point: these numbers
 * were being re-derived by hand from the responses file every time the agent
 * wrote, and the arithmetic is fiddly enough (a room whose second occupant
 * leaves early becomes a single for its last night) to get wrong quietly.
 *
 * The copy buttons matter as much as the tables. What actually gets sent is a
 * few lines of prose, so the page produces those lines rather than leaving them
 * to be transcribed off a table — a transcription is a second place for the
 * numbers to go wrong, and the only one nobody would check.
 *
 * See keralaTripSummary.ts for the rules the counts follow.
 */
const AdminKeralaTrip: React.FC = () => {
  const { kerala } = useAdminContext()

  const [currency, setCurrency] = useState<Currency>('inr')
  const [rate, setRate] = useState(INR_PER_USD)
  const [coveredOpen, setCoveredOpen] = useState(false)
  const [toCollectOpen, setToCollectOpen] = useState(false)
  const format = useMemo(() => money(currency, rate), [currency, rate])

  const summary = useMemo(
    () => (kerala ? summarizeKeralaTrip(kerala.rooms, kerala.billing) : null),
    [kerala],
  )

  return (
    <>
      <h2 className="font-display text-2xl text-rosewood">Kerala Trip</h2>
      <p className="mt-2 mb-6 text-sm text-zeus/70">
        Rooming, flights and money for the travel agent.
      </p>

      {!kerala || !summary ? (
        // The bundle and schedule-index.json deploy separately, so between
        // shipping this page and the next sync the index in front of it has no
        // rooming at all. Saying which lever to pull beats an empty table.
        <p className="card text-sm text-zeus/80">
          This index has no trip data in it yet. Run the schedule sync — the numbers appear as soon
          as it publishes.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="card">
            <SectionHeading
              title="Rooming & flights"
              blurb={`${summary.travellers} travellers across ${summary.stages[0].rooms} rooms.`}
              copy={roomingBlurb(summary)}
              copyLabel="the rooming summary"
            />

            <Table
              caption="Rooms needed on each set of nights"
              columns={['Nights', 'Rooms', 'Double occ.', 'Single occ.']}
            >
              {summary.stages.map((nights) => (
                <Row
                  key={nights.label}
                  head={nights.label}
                  cells={[nights.rooms, nights.double, nights.single]}
                />
              ))}
            </Table>

            {/* Its own table rather than three more columns on the one above:
                these count rooms out of the double-occupancy column, not out of
                the whole, and sitting them side by side invites reading the row
                across as a single total. That column is not repeated here for
                the same reason it is not repeated in the message to the agent —
                double bed plus twin bed is it. */}
            <Table
              caption="Bed type in the double-occupancy rooms"
              columns={['Nights', 'Double bed', 'Twin bed']}
              className="mt-8"
            >
              {summary.stages.map((nights) => (
                <Row
                  key={nights.label}
                  head={nights.label}
                  cells={[nights.doubleBed, nights.twinBed]}
                />
              ))}
            </Table>

            <Table caption="Air tickets" columns={['Date', 'Members', '']} className="mt-8">
              {summary.air.map((leg) => (
                <Row
                  key={leg.date}
                  head={shortDate(leg.date)}
                  cells={[leg.members]}
                  note={leg.detail}
                />
              ))}
            </Table>
          </section>

          {/* z-10 because `.card` sets backdrop-blur and so is a stacking
              context: a column menu inside this one paints under the Payments
              card below it however high its own z-index is. The order of two
              sibling stacking contexts is what has to change, not the depth
              inside one of them. */}
          <Disclosure id="rooms" title="Room by room" className="relative z-10">
            <RoomTable rooms={roomRows(kerala.rooms)} />
          </Disclosure>

          <section className="card">
            <SectionHeading
              title="Payments"
              blurb={`${format(summary.billing.outstanding)} still to pay.`}
              copy={paymentsBlurb(summary, format)}
              copyLabel="the payment summary"
            >
              <CurrencyControl
                currency={currency}
                onCurrency={setCurrency}
                rate={rate}
                onRate={setRate}
              />
            </SectionHeading>

            {/* A div per row, which `dl` has allowed since HTML 5.2. A bare
                dt/dd grid has no element spanning the pair, so the clickable
                row below would have had nothing to hang off. */}
            <dl className="flex flex-col gap-y-2 text-sm">
              <Money label="Total quoted" amount={summary.billing.total} {...{ currency, rate }} />
              {/* Only when the two have come apart, which they have for one
                  guest: he was quoted before the sole-use night was worked out
                  properly, has paid that figure, and is not being re-invoiced.
                  The gap is real money and belongs where the money is, not
                  buried in a row you have to expand to find. */}
              {summary.billing.covered !== 0 && (
                <>
                  <Money
                    label="Guests are paying"
                    amount={summary.billing.guestPrices}
                    {...{ currency, rate }}
                  />
                  <Money
                    label="You are covering"
                    amount={summary.billing.covered}
                    {...{ currency, rate }}
                    onToggle={() => setCoveredOpen((was) => !was)}
                    expanded={coveredOpen}
                  />
                  {coveredOpen &&
                    summary.billing.coveredBy.map((line) => (
                      <Money
                        key={`${line.reason}-${line.name}`}
                        label={line.name}
                        amount={line.amount}
                        {...{ currency, rate }}
                        sub
                        hint={COVERED_REASON[line.reason](line.amount)}
                      />
                    ))}
                </>
              )}
              <Money
                label="Paid to date"
                amount={summary.billing.paid}
                {...{ currency, rate }}
                // Before the figure, not after: the percentage used to sit at
                // the end of the line and push the one number on it out of the
                // column every other number lines up in.
                note={
                  summary.billing.paidPct === null
                    ? undefined
                    : `${summary.billing.paidPct.toFixed(1)}%`
                }
              />
              <Money
                label="Outstanding"
                amount={summary.billing.outstanding}
                {...{ currency, rate }}
                strong
              />
            </dl>

            {/* Guest money, kept visibly apart from the agent's. It reaches us
                and never the agent, so none of it moves Outstanding above — a
                card with two payment totals on it invites exactly that
                misreading, which is why the rule is written down rather than
                left to be inferred from the rule above. */}
            <dl className="mt-5 flex flex-col gap-y-2 border-t border-gold/40 pt-4 text-sm">
              <Money
                label="Guests have transferred"
                amount={summary.billing.transferred * QUOTED_AT_INR_PER_USD}
                {...{ currency, rate }}
              />
              {summary.billing.toCollect > 0 && (
                <>
                  <Money
                    label="Still to collect"
                    amount={summary.billing.toCollect * QUOTED_AT_INR_PER_USD}
                    {...{ currency, rate }}
                    onToggle={() => setToCollectOpen((was) => !was)}
                    expanded={toCollectOpen}
                  />
                  {toCollectOpen &&
                    summary.billing.toCollectFrom.map((line) => (
                      <Money
                        key={`${line.room}-${line.name}`}
                        label={line.name}
                        amount={line.usd * QUOTED_AT_INR_PER_USD}
                        {...{ currency, rate }}
                        sub
                        hint={`room ${line.room}`}
                      />
                    ))}
                </>
              )}
              <p className="pt-1 text-xs text-zeus/50">
                Sent to you, not to the agent — none of this changes what is outstanding above.
              </p>
            </dl>

            {summary.billing.due.length > 0 && (
              <Table caption="What is due when" columns={['Due', 'Amount', '']} className="mt-8">
                {summary.billing.due.map((row) => (
                  <Row
                    key={row.due}
                    head={longDate(row.due)}
                    cells={[format(row.amount)]}
                    note={row.note ?? ''}
                  />
                ))}
              </Table>
            )}

            {summary.billing.payments.length > 0 ? (
              <Table caption="What has been paid" columns={['Paid', 'Amount', '']} className="mt-8">
                {summary.billing.payments.map((payment, index) => (
                  <Row
                    // Two payments can share a date — the advance went out as
                    // two — so the position is what is stable.
                    key={index}
                    head={payment.date ? longDate(payment.date) : '—'}
                    cells={[format(payment.amount)]}
                    note={payment.note ?? ''}
                  />
                ))}
              </Table>
            ) : (
              <p className="mt-4 text-sm text-zeus/70">
                No payments recorded yet — add them to the billing block in the trip responses file.
              </p>
            )}
          </section>

          <Disclosure id="total" title="How the total breaks down">
            <BreakdownTable billing={summary.billing} format={format} currency={currency} />
          </Disclosure>
        </div>
      )}
    </>
  )
}

/**
 * Which currency the money on this page is in, and at what rate.
 *
 * One control for the whole page rather than one per section: the total in the
 * Payments card and the rows it breaks into below are the same money, and two
 * switches able to disagree would let the page contradict itself.
 *
 * The rate box appears only in dollars, where it is the only thing that decides
 * the figure. Rupees are what the agent quotes and what is stored, so there is
 * nothing to convert and nothing to get wrong.
 *
 * It sits *before* the switch, which is the whole reason for the order. This
 * row is right-aligned, so anything appearing after the switch pushes it
 * leftward — press "$ USD" and the button you just pressed slides out from
 * under the pointer. Growing into the empty space on the left instead leaves
 * the switch exactly where it was, a fixed distance from Copy.
 */
const CurrencyControl: React.FC<{
  currency: Currency
  onCurrency: (next: Currency) => void
  rate: number
  onRate: (next: number) => void
}> = ({ currency, onCurrency, rate, onRate }) => (
  <div className="flex items-center gap-2">
    {currency === 'usd' && (
      // text-sm, matching the input beside it and the switch after it — at
      // text-xs the words saying what the box means were the smallest thing in
      // the row.
      <label className="flex items-center gap-1.5 text-sm text-zeus/60">
        <span className="whitespace-nowrap">₹ per $</span>
        <input
          type="number"
          inputMode="decimal"
          min={1}
          step="0.01"
          value={rate}
          // Ignore a blank or nonsense box rather than dividing by it — an
          // empty input would otherwise turn every figure on the page into
          // Infinity while it is being retyped.
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next) && next > 0) onRate(next)
          }}
          aria-label="Rupees per dollar"
          // Centred, which is what puts air between the digits and the stepper
          // arrows. `text-right` pins them to the end of the text area, and the
          // arrows sit at exactly that edge; padding does not help, because it
          // shrinks the content box and moves the text and the arrows together.
          // Margin on ::-webkit-inner-spin-button does open the gap, but only
          // where that shadow element takes author styles at all, which is not
          // every browser. Centring is plain CSS on the input and behaves the
          // same everywhere.
          className="w-24 rounded-full border border-gold/50 bg-white/70 px-2.5 py-1 text-center text-sm text-zeus focus-visible:outline-2 focus-visible:outline-gold"
        />
      </label>
    )}
    <div role="group" aria-label="Currency" className="flex overflow-hidden rounded-full">
      {(['inr', 'usd'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={currency === option}
          onClick={() => onCurrency(option)}
          className={`cursor-pointer px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 ${
            currency === option ? 'bg-rosewood text-cream' : 'bg-lily/60 text-zeus hover:bg-lily'
          }`}
        >
          {option === 'inr' ? '₹ INR' : '$ USD'}
        </button>
      ))}
    </div>
  </div>
)

/**
 * The room-by-room table, with a sort-and-filter menu on each column.
 *
 * The state is here rather than in `Table` because it is this table's alone —
 * the other five hold two or three rows each and have nothing to sort. Sorting
 * is single-column and stable: `room` breaks every tie, so the rows never
 * shuffle among themselves when the sorted column repeats a value, which it
 * does for all but one of these columns.
 */
const ROOM_COLUMNS = [
  { key: 'room', label: 'Room', numeric: true, filterable: false },
  { key: 'beds', label: 'Beds', numeric: false, filterable: true },
  { key: 'guests', label: 'Guests', numeric: false, filterable: false },
  { key: 'paid', label: 'Paid', numeric: false, filterable: true },
  { key: 'nights12', label: 'Nights 1–2', numeric: true, filterable: true },
  { key: 'night3', label: 'Night 3', numeric: true, filterable: true },
] as const

/**
 * How a value reads in a tickbox list, per column.
 *
 * Per column, not one map across all of them: an em dash means "checked out"
 * under Night 3, "nobody in this room owes anything" under Paid and "single
 * room, so nobody was asked" under Beds, and a single shared map labelled them
 * all with whichever meaning was written first.
 *
 * Display only — the filter still compares the stored string.
 */
const ROOM_VALUE_LABELS: Partial<Record<RoomColumn, Record<string, string>>> = {
  beds: { [NO_BED_ASKED]: 'Single' },
  night3: { [CHECKED_OUT]: 'Checked out' },
  paid: { [NOBODY_OWES]: 'Nobody owes' },
}

type RoomColumn = (typeof ROOM_COLUMNS)[number]['key']

/**
 * Fixed column widths, because this is the one table whose rows come and go.
 *
 * With the default auto layout a table's columns are sized from its contents,
 * so filtering it down to nothing leaves only the four headings to divide the
 * width between — and Bed and Guests visibly slide right at the moment you can
 * least afford to lose your place, with the menu that did it still open. The
 * percentages are the populated layout, measured: 104/113/312/140 of 670.
 *
 * From `sm` up only. Below it the headings are already wider than their
 * contents, so the widths barely move (92/75/100/99 populated against
 * 92/75/100/91 empty) and fixing them at these ratios would squeeze "Room"
 * narrower than the word.
 */
/**
 * Nights 1-2 is the column a phone loses.
 *
 * Five columns measured 478px wide at 390px, spilling the table out of its own
 * card. This is the one to drop: how many people are in a room for the first
 * two nights is exactly the number of names in the Guests column beside it,
 * where Night 3 is a fact no other column carries.
 */
const ROOM_COMPACT_HIDDEN = [4]

/**
 * Beds, Guests and Paid, which hold words rather than figures.
 *
 * Words read from their left edge; only the two night counts are numbers, and
 * only numbers want lining up on the right.
 */
const ROOM_LEFT = [1, 2, 3]

/** Stands in for a per-person price that would only repeat the row's total. */
const NO_UNIT_PRICE = '—'

/**
 * Why a share of the total is ours. Four different situations, four different
 * follow-ups — one is ours by definition, one is a quote that aged, one we
 * chose and owe nobody an explanation for, and one is a guest who sent the
 * wrong amount and might simply be asked for the rest.
 */
const COVERED_REASON: Record<CoveredLine['reason'], (amount: number) => string> = {
  host: () => 'your own place',
  shortfall: () => 'quoted before the sole-use night was costed',
  gift: () => 'part of their price is on you',
  settlement: (amount) =>
    amount < 0 ? 'sent more than they were asked' : 'sent less than they were asked',
}

/**
 * Measured, not guessed, and tight.
 *
 * Under fixed layout a column cannot grow to fit its own heading, and six of
 * them at 1280px genuinely does not have room to spare: the headings alone
 * wanted 709px of a 670px table until they were allowed to wrap, the outer
 * cells gave back 24 more by dropping their indent, and the guest lines another
 * 12 by tightening their gaps and their shortest leader. What each needs now,
 * in pixels — heading or widest cell, whichever is larger:
 *
 *   Room 81 · Beds 83 · Guests 233 · Paid 79 · Nights 1-2 98 · Night 3 94 = 668
 *
 * A wrapped heading needs the width of its longest word, not of the whole
 * heading, which is why the two Nights columns cost less than they read. The
 * percentages below are those over 670, rounded up. If a longer name or a
 * different font ever pushes one of them past its column, the symptom is a
 * heading running into its neighbour — remeasure rather than nudging blind.
 */
const ROOM_WIDTHS = [
  'sm:w-[12.1%]',
  'sm:w-[12.4%]',
  'sm:w-[35.2%]',
  'sm:w-[11.7%]',
  'sm:w-[14.6%]',
  'sm:w-[14%]',
]

const RoomTable: React.FC<{ rooms: RoomRow[] }> = ({ rooms }) => {
  const [sort, setSort] = useState<{ by: RoomColumn; dir: SortDir }>({ by: 'room', dir: 'asc' })
  const [hidden, setHidden] = useState<Partial<Record<RoomColumn, Set<string>>>>({})

  /**
   * Whether a row survives every filter, optionally ignoring one column's own.
   *
   * `except` is what makes the menus cascade: a column's options are the values
   * left once every *other* column has had its say, so filtering Day 3 down to
   * the singles stops the Beds menu offering "Double" — there are no
   * double-bed rooms left for it to show.
   */
  const passes = useCallback(
    (room: RoomRow, except?: RoomColumn) =>
      ROOM_COLUMNS.every(
        (column) => column.key === except || !hidden[column.key]?.has(String(room[column.key])),
      ),
    [hidden],
  )

  const options = useMemo(
    () =>
      Object.fromEntries(
        ROOM_COLUMNS.filter((column) => column.filterable).map((column) => {
          const available = new Set(
            rooms
              .filter((room) => passes(room, column.key))
              .map((room) => String(room[column.key])),
          )
          // Whatever this column is actively hiding stays listed even when the
          // other filters have removed the last row carrying it. Otherwise the
          // tickbox you just cleared vanishes and there is nothing to click to
          // put it back.
          for (const value of hidden[column.key] ?? []) available.add(value)
          return [column.key, [...available].sort((a, b) => a.localeCompare(b))]
        }),
      ) as Record<RoomColumn, string[]>,
    [rooms, passes, hidden],
  )

  const visible = useMemo(() => {
    const kept = rooms.filter((room) => passes(room))
    const direction = sort.dir === 'asc' ? 1 : -1
    const numeric = ROOM_COLUMNS.find((column) => column.key === sort.by)?.numeric
    return [...kept].sort((a, b) => {
      const first = a[sort.by]
      const second = b[sort.by]
      // A numeric column sorts by value, so "Nights 1-2" reads 1, 2 rather
      // than as text. The em dash under Night 3 parses to NaN and falls to 0,
      // which is exactly right: an empty room holds nobody, and it sorts with
      // the smallest counts instead of wherever the collator files punctuation.
      const order = numeric
        ? (Number(first) || 0) - (Number(second) || 0)
        : String(first).localeCompare(String(second))
      return order * direction || a.room - b.room
    })
  }, [rooms, passes, sort])

  return (
    <>
      <Table
        caption={
          visible.length === rooms.length
            ? 'Every room and who is in it'
            : `${visible.length} of ${rooms.length} rooms`
        }
        columns={ROOM_COLUMNS.map((column) => column.label)}
        widths={ROOM_WIDTHS}
        left={ROOM_LEFT}
        dense
        compact={ROOM_COMPACT_HIDDEN}
        menus={ROOM_COLUMNS.map((column, index) => (
          <ColumnMenu
            key={column.key}
            column={column.label}
            numeric={column.numeric}
            // Columns in the left half open rightward and vice versa. Hanging
            // every panel off its heading's right edge put the Bed one — the
            // second of four, and a narrow column — outside the card.
            align={index < ROOM_COLUMNS.length / 2 ? 'left' : 'right'}
            sort={sort.by === column.key ? sort.dir : null}
            onSort={(dir) => setSort({ by: column.key, dir })}
            values={column.filterable ? options[column.key] : undefined}
            labels={ROOM_VALUE_LABELS[column.key]}
            hidden={hidden[column.key]}
            onHiddenChange={(next) => setHidden((was) => ({ ...was, [column.key]: next }))}
          />
        ))}
      >
        {visible.map((room) => (
          <Row
            key={room.room}
            head={String(room.room)}
            left={ROOM_LEFT}
            compact={ROOM_COMPACT_HIDDEN}
            dense
            cells={[
              room.beds,
              <GuestLines key="guests" people={room.people} />,
              room.paid,
              room.nights12,
              room.night3,
            ]}
          />
        ))}
      </Table>
      {visible.length === 0 && (
        <p className="mt-4 text-center text-sm text-zeus/70">
          No rooms match those filters. Clear one to bring some back.
        </p>
      )}
    </>
  )
}

/**
 * The total, by rate — with every row able to show what the rate is made of.
 *
 * The itemisation is derived, not quoted: see `rateComponents`. Both the
 * expanded rows and the reference table below say so, because a figure off this
 * page could otherwise be repeated back to the agent as though it were theirs.
 */
const BreakdownTable: React.FC<{
  billing: BillingSummary
  format: (amount: number) => string
  currency: Currency
}> = ({ billing, format, currency }) => {
  const [open, setOpen] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const flatRow = (bucket: (typeof billing.buckets)[number]) => [
    bucket.label,
    String(bucket.people),
    // One person's row prices them twice over — the rate and the total are the
    // same figure, and printing both invites reading the pair as a quantity.
    bucket.people === 1 ? NO_UNIT_PRICE : format(bucket.each),
    format(bucket.total),
  ]

  const exportPng = () => {
    setExporting(true)
    void downloadTableImage(
      {
        title: 'Kerala trip — the total, by rate',
        subtitle: `${billing.people} people · ${format(billing.total)} · figures in ${
          currency === 'inr' ? 'rupees' : 'US dollars'
        }`,
        columns: [
          { header: 'Rate', align: 'left' },
          { header: 'People' },
          { header: 'Each' },
          { header: 'Total' },
        ],
        // The table as it reads at the top level, whatever is expanded on
        // screen: an export whose contents depend on which rows you happened to
        // have open is one you cannot ask anyone else to reproduce.
        rows: billing.buckets.map(flatRow),
        footer: ['Total', String(billing.people), NO_UNIT_PRICE, format(billing.total)],
      },
      `kerala-price-breakdown-${currency}`,
    ).finally(() => setExporting(false))
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={exportPng}
          disabled={exporting}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-gold/50 px-3 py-1.5 font-body text-sm text-rosewood transition-colors hover:bg-lily/30 disabled:opacity-60"
        >
          <DownloadIcon className="h-4 w-4" />
          {exporting ? 'Saving…' : 'Save as PNG'}
        </button>
      </div>

      <Table
        caption="The total, by rate"
        columns={['Rate', 'People', 'Each', 'Total']}
        footer={
          <Row
            head="Total"
            strong
            // No per-person figure: an average across seven different rates is
            // a number nobody was ever charged.
            cells={[billing.people, NO_UNIT_PRICE, format(billing.total)]}
          />
        }
      >
        {billing.buckets.map((bucket) => {
          const expanded = open === bucket.label
          const parts = rateComponents(bucket.choice)
          return (
            <React.Fragment key={bucket.label}>
              <Row
                head={bucket.label}
                onToggle={() => setOpen(expanded ? null : bucket.label)}
                expanded={expanded}
                cells={[
                  bucket.people,
                  bucket.people === 1 ? NO_UNIT_PRICE : format(bucket.each),
                  format(bucket.total),
                ]}
              />
              {expanded && (
                <tr>
                  <td colSpan={4} className="border-b border-gold/40 bg-lily/10 px-4 py-3 sm:px-7">
                    <dl className="mx-auto grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
                      {parts.map((part) => (
                        <React.Fragment key={part.label}>
                          <dt className="text-zeus/70">
                            {part.label}
                            {/* Marked on the line rather than left to the note
                                below, because the mix is the whole point: one
                                of these came from the agent and the rest did
                                not, and only one of them is safe to quote back
                                to them. */}
                            {part.quoted && (
                              <span className="ml-1.5 rounded-full bg-fern/15 px-1.5 py-0.5 text-[10px] tracking-wide text-fern uppercase">
                                Quoted
                              </span>
                            )}
                          </dt>
                          <dd className="text-right tabular-nums text-zeus">
                            {format(part.amount)}
                          </dd>
                        </React.Fragment>
                      ))}
                      <dt className="border-t border-gold/40 pt-1.5 font-medium text-zeus">
                        Per person
                      </dt>
                      <dd className="border-t border-gold/40 pt-1.5 text-right font-medium tabular-nums text-rosewood">
                        {format(bucket.each)}
                      </dd>
                      <dt className="text-zeus/70">× {bucket.people} people</dt>
                      <dd className="text-right font-medium tabular-nums text-rosewood">
                        {format(bucket.total)}
                      </dd>
                    </dl>
                    {/* The working for the one line that is arithmetic on
                        their figures rather than one of them, and — where a
                        guest was quoted before we got that arithmetic right —
                        what we are absorbing as a result. Both belong on the
                        page rather than in somebody's memory of a decision. */}
                    {parts.map((part) =>
                      part.working ? (
                        <p
                          key={part.label}
                          className="mx-auto mt-4 max-w-md border-t border-gold/40 pt-3 text-xs leading-relaxed text-zeus/60"
                        >
                          <span className="font-medium text-zeus/80">
                            {part.working.nights === 1
                              ? 'The final night, alone in a shared room.'
                              : `${part.working.nights} nights alone in a shared room.`}
                          </span>{' '}
                          That night costs {format(part.working.singleNight)} single (
                          {format(part.working.fullSingle)} &minus;{' '}
                          {format(part.working.shortSingle)}) and {format(part.working.doubleNight)}{' '}
                          double ({format(part.working.fullDouble)} &minus;{' '}
                          {format(part.working.shortDouble)}), so the occupancy is worth{' '}
                          {format(part.working.perNight)}. Everything about the day that is not the
                          room appears in both and cancels.
                        </p>
                      ) : !part.quoted ? (
                        <p
                          key={part.label}
                          className="mx-auto mt-4 max-w-md border-t border-gold/40 pt-3 text-xs leading-relaxed text-zeus/60"
                        >
                          The difference between this guest&rsquo;s price and the rate it departs
                          from. Nothing on record says how it was arrived at.
                        </p>
                      ) : null,
                    )}

                    {bucket.total !== bucket.guestPrice && (
                      <dl className="mx-auto mt-3 grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-gold/40 pt-3 text-xs">
                        {/* Not "quoted to the guest, and paid", which this said
                            until it was read closely. Both halves could be
                            untrue at once: a row can hold our own places, which
                            nobody quoted, and guests who have not sent anything
                            yet. What the figure actually is, is what the guests
                            in this row owe us. */}
                        <dt className="text-zeus/70">What the guests here owe</dt>
                        <dd className="text-right tabular-nums text-zeus">
                          {format(bucket.guestPrice)}
                        </dd>
                        {/* Split out, because a host place and a share we took
                            on look identical in the arithmetic and are nothing
                            alike: one was never money a guest owed us. Lumped
                            together they raise the question of where the
                            difference came from, which is the question this
                            line exists to answer. */}
                        {bucket.hosts > 0 && (
                          <>
                            <dt className="text-zeus/70">
                              {bucket.hosts === 1
                                ? 'Your own place'
                                : `Your own places · ${bucket.hosts}`}
                            </dt>
                            <dd className="text-right tabular-nums text-zeus">
                              {format(bucket.hosts * bucket.each)}
                            </dd>
                          </>
                        )}
                        {bucket.total - bucket.guestPrice - bucket.hosts * bucket.each > 0 && (
                          <>
                            <dt className="font-medium text-zeus/80">You cover the difference</dt>
                            <dd className="text-right font-medium tabular-nums text-rosewood">
                              {format(
                                bucket.total - bucket.guestPrice - bucket.hosts * bucket.each,
                              )}
                            </dd>
                          </>
                        )}
                      </dl>
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          )
        })}
      </Table>

      {/* What they actually sent, before it is added into anything. This is the
          whole of the pricing we have been given: four land costs and two
          airfares. Every figure anywhere else on the page is these six applied
          to the rooming. */}
      <Table
        caption="What the agent charges, per person"
        columns={['Component', 'Amount']}
        className="mt-8"
      >
        {quotedFigures().map((figure) => (
          <Row key={figure.label} head={figure.label} cells={[format(figure.amount)]} />
        ))}
      </Table>
    </>
  )
}

/**
 * A room's occupants, one to a line, with what each sent on the same line.
 *
 * Leadered and right-aligned, the way the money rows in the Payments card are:
 * the dotted run is what carries the eye across the gap, and it takes up the
 * slack so every figure in the column lands on one edge. Without it a short
 * name and a long one put their amounts inches apart.
 *
 * Tighter gaps and a shorter minimum leader than the Payments card uses. Both
 * only bind on the longest line in the table, and what they buy is the width
 * the Nights headings need for their own filter buttons -- a column that has
 * to fit a name, a figure and an icon is where the table's spare pixels are.
 */
const GuestLines: React.FC<{ people: RoomGuest[] }> = ({ people }) => (
  <span className="flex flex-col gap-1">
    {people.map((guest) => (
      <span key={guest.name} className="flex items-baseline gap-x-1" title={guest.hint}>
        <span className="shrink-0">{guest.name}</span>
        <span className="sr-only">{guest.hint}</span>
        <span aria-hidden="true" className="min-w-3 flex-1 border-b border-dotted border-gold/60" />
        {guest.paid ? (
          <span aria-hidden="true" className="flex shrink-0 items-center gap-1 whitespace-nowrap">
            <span className="tabular-nums text-zeus/70">{guest.paid}</span>
            <span className="text-xs text-zeus/45">{guest.to}</span>
            {guest.via && <PaymentIcon method={guest.via} className="h-3.5 w-3.5 shrink-0" />}
          </span>
        ) : (
          <span aria-hidden="true" className="shrink-0 text-xs whitespace-nowrap text-zeus/45">
            {guest.note || NO_UNIT_PRICE}
          </span>
        )}
      </span>
    ))}
  </span>
)

/**
 * A section's title, what it amounts to, and the button that copies it.
 *
 * The blurb is a number rather than a description because the description is
 * the title — what is worth a glance here is the one figure the section exists
 * to produce.
 */
const SectionHeading: React.FC<{
  title: string
  blurb: string
  copy: string
  copyLabel: string
  children?: React.ReactNode
}> = ({ title, blurb, copy, copyLabel, children }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
    <span>
      <span className="block font-display text-xl text-rosewood">{title}</span>
      <span className="mt-1 block text-sm text-zeus/70">{blurb}</span>
    </span>
    <span className="flex flex-wrap items-center gap-3">
      {children}
      <CopyButton value={copy} label={copyLabel} />
    </span>
  </div>
)

/**
 * The table shape these sections share.
 *
 * `border-separate` and the 1rem bleed for the reasons GuestSummary's table
 * documents at length: collapse discards the cell radii and breaks sticky
 * header cells, and the bleed is what lets the header rule run the card's full
 * width rather than stopping short of its corners.
 *
 * Deliberately *not* wrapped in an `overflow-x-auto` container. That container
 * turns the bleed into overflow — the table is a a full 2rem wider than the box
 * measuring it — so every one of these grew a scrollbar and clipped its own
 * first column, on tables with four short columns and room to spare. Without
 * one the bleed does what it is for and lands in the card's own padding.
 *
 * The caption is shown rather than screen-reader-only, unlike that page's. Two
 * or three of these stack inside one card here, and without a heading the
 * second reads as more rows of the first.
 */
const Table: React.FC<{
  caption: string
  columns: string[]
  /**
   * Indices of the columns holding prose rather than figures. Figures line up
   * on their right edge and prose reads from its left, and getting that the
   * wrong way round is what makes a table of names look like a table of totals.
   * Column 0 is the row heading and is always left; it is not counted here.
   */
  left?: number[]
  /** Positionally aligned with `columns`; the sort-and-filter menu for each. */
  menus?: React.ReactNode[]
  /**
   * Drops the outer cells' extra indent at every width, not just on a phone.
   * For the one table whose six columns need those 24px more than the text
   * needs to sit a little in from the card's edge.
   */
  dense?: boolean
  /**
   * Per-column width classes, positionally aligned with `columns`. Only a table
   * whose contents change under the reader needs them — see the note on
   * `ROOM_WIDTHS`. Given, they switch the table to fixed layout from `sm` up.
   */
  widths?: string[]
  /**
   * Column indices to drop below `sm`. Five columns do not fit a 390px phone —
   * the room table measured 478px wide there, spilling out of its own card — so
   * the one whose answer can be read off another column goes.
   */
  compact?: number[]
  /** A footing row, in a `tfoot` — a total, and only ever a total. */
  footer?: React.ReactNode
  className?: string
  children: React.ReactNode
}> = ({
  caption,
  columns,
  left = [],
  menus,
  widths,
  compact = [],
  dense = false,
  footer,
  className = '',
  children,
}) => (
  <div className={className}>
    <table
      className={`-mx-4 w-[calc(100%+2rem)] border-separate border-spacing-0 text-sm ${
        widths ? 'table-auto sm:table-fixed' : ''
      }`}
    >
      <caption
        className={`caption-top pb-3 pl-4 text-left font-display text-base text-rosewood ${
          dense ? '' : 'sm:pl-7'
        }`}
      >
        {caption}
      </caption>
      {widths && (
        <colgroup>
          {widths.map((width, index) => (
            <col key={index} className={width} />
          ))}
        </colgroup>
      )}
      <thead>
        <tr>
          {columns.map((column, index) => (
            <th
              key={column || index}
              scope="col"
              className={`relative border-b-2 border-rosewood/40 py-2 text-xs font-normal tracking-wide text-zeus/60 uppercase ${cellAlign(index, columns.length, left, dense)} ${
                compact.includes(index) ? HIDE_BELOW_SM : ''
              }`}
            >
              {/* inline-flex so the menu button sits on the label's baseline
                  and the whole pair stays inside the column's alignment,
                  instead of the button anchoring to the cell's far edge. The
                  funnel follows the name in every column, right-aligned ones
                  included: reading order beats mirroring the alignment.

                  `max-w-full` caps the pair at the cell, which is what lets a
                  two-word heading wrap rather than run into its neighbour. A
                  fixed-layout column cannot grow to fit its own title, and
                  header rows have vertical space going spare.

                  The label keeps its default `min-width: auto`, so the cap can
                  wrap it at a space but never squeeze it narrower than its
                  longest word. `min-w-0` here let "NIGHTS" render into a box
                  too small for it, and the overflow ran under the button --
                  which reads as the gap closing up, when the gap is the one
                  thing that had not changed. */}
              <span className="inline-flex max-w-full items-center gap-1">
                <span>{column}</span>
                {menus?.[index]}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
      {footer && <tfoot>{footer}</tfoot>}
    </table>
  </div>
)

/**
 * Shared by the header and body cells so a column cannot be headed one way and
 * filled the other. Spelled out rather than interpolated -- Tailwind scans this
 * file for whole class names, and `text-${align}` is not one.
 */
/** Hidden on a phone, present from `sm` up. Header and body cell alike, or the
 *  columns misalign by one. */
const HIDE_BELOW_SM = 'hidden sm:table-cell'

const cellAlign = (index: number, count: number, left: number[], dense = false) =>
  [
    // The outer cells pad back the 1rem bleed plus their own 0.75rem, so the
    // text lines up with the rest of the card. On a phone they pad back the
    // bleed and no more: at 390px those two extra 0.75rems were the difference
    // between the room table fitting and the whole page scrolling sideways,
    // and aligning flush with the card's own padding edge is no worse.
    //
    // `dense` does that at every width, for a table that needs the 24px more
    // than it needs the indent.
    index === 0 ? (dense ? 'pl-4 text-left' : 'pl-4 text-left sm:pl-7') : 'px-3',
    index !== 0 && (left.includes(index) ? 'text-left' : 'text-right'),
    index === count - 1 && (dense ? 'pr-4' : 'pr-4 sm:pr-7'),
  ]
    .filter(Boolean)
    .join(' ')

const Row: React.FC<{
  head: string
  cells: React.ReactNode[]
  left?: number[]
  /** Positionally the same indices `Table` was given; see its `compact`. */
  compact?: number[]
  /** The same as `Table`'s, and it has to match or the columns misalign. */
  dense?: boolean
  /** A footing row: the same weight and colour the Outstanding figure carries. */
  strong?: boolean
  /**
   * Makes the row heading the control that expands the row. The whole heading
   * rather than a chevron beside it: the label is what you are asking about,
   * and a 16px target next to it is a worse thing to hit.
   */
  onToggle?: () => void
  expanded?: boolean
  /**
   * A trailing aside — what a flight is for, what a payment was. Its own prop
   * rather than another cell so the tables that want one say so, and the ones
   * that don't are not carrying an empty string around.
   */
  note?: string
}> = ({
  head,
  cells,
  left = [],
  compact = [],
  dense = false,
  strong,
  onToggle,
  expanded,
  note,
}) => {
  const count = cells.length + (note === undefined ? 1 : 2)
  return (
    <tr
      // The whole row, not just the heading: the figures are as much the thing
      // you are asking about as the label is, and a 200px target beside 400px
      // of dead row is a target you have to aim at.
      //
      // The button below stays, because a `tr` cannot be one — it is what
      // carries the role, the focus ring and aria-expanded. Its own click
      // bubbles here, so this bows out rather than toggling a second time and
      // undoing itself.
      onClick={
        onToggle
          ? (event) => {
              if ((event.target as HTMLElement).closest('button')) return
              onToggle()
            }
          : undefined
      }
      className={`transition-colors hover:bg-lily/15 ${onToggle ? 'cursor-pointer' : ''}`}
    >
      <th
        scope="row"
        // Nowrap so a two-word date keeps its line at 390px, where the note
        // beside it would otherwise squeeze "29 Oct" onto two.
        className={`border-b border-gold/40 py-2.5 pl-4 text-left text-base whitespace-nowrap ${
          dense ? '' : 'sm:pl-7'
        } ${strong ? 'font-medium text-rosewood' : 'font-normal text-zeus'}`}
      >
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex cursor-pointer items-center gap-1.5 text-left transition-colors hover:text-rosewood focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
          >
            {head}
            <ChevronDownIcon
              className={`h-4 w-4 shrink-0 text-rosewood/70 transition-transform duration-200 ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        ) : (
          head
        )}
      </th>
      {cells.map((cell, index) => (
        <td
          key={index}
          className={`border-b border-gold/40 py-2.5 ${cellAlign(index + 1, count, left, dense)} ${
            compact.includes(index + 1) ? HIDE_BELOW_SM : ''
          } ${strong ? 'font-medium text-rosewood' : ''}`}
        >
          {cell}
        </td>
      ))}
      {note !== undefined && (
        <td
          className={`border-b border-gold/40 py-2.5 text-zeus/60 ${cellAlign(count - 1, count, [count - 1], dense)}`}
        >
          {note}
        </td>
      )}
    </tr>
  )
}

/**
 * One figure, with the same figure in the other currency beside it.
 *
 * The conversion is the note rather than a second row: it is the same money,
 * and giving it a row of its own would double the length of a three-row list
 * that is meant to be read at a glance.
 */
const Money: React.FC<{
  label: string
  amount: number
  currency: Currency
  rate: number
  /**
   * A qualifier on the label, on the left where the words are — who a line is
   * for, or why it falls to us.
   */
  hint?: string
  /**
   * A qualifier on the figure, sitting *before* it. After it, the figure was no
   * longer the last thing on the line and stopped aligning with the rest of the
   * column, which is the whole reason this list has a right edge.
   */
  note?: string
  strong?: boolean
  /** Indented and muted: one of the rows behind a figure above it. */
  sub?: boolean
  /** Makes the label the control that opens the rows behind this figure. */
  onToggle?: () => void
  expanded?: boolean
}> = ({ label, amount, currency, rate, hint, note, strong, sub, onToggle, expanded }) => (
  <div
    // Same bargain as the table row: the whole line is the target, and the
    // button inside it is what a keyboard and a screen reader use. Its click
    // bubbles to here, so this stands aside rather than toggling twice.
    onClick={
      onToggle
        ? (event) => {
            if ((event.target as HTMLElement).closest('button')) return
            onToggle()
          }
        : undefined
    }
    // Every row lights up, not only the one that opens: the tint is what keeps
    // your eye on one line while it travels the leader to a figure several
    // inches away, and that is worth as much on a row with nothing to click.
    // The negative margin gives the tint a little air either side without
    // moving the text; the card's own padding absorbs it.
    className={`-mx-2 flex items-baseline gap-x-3 rounded px-2 transition-colors hover:bg-lily/20 ${
      onToggle ? 'cursor-pointer' : ''
    }`}
  >
    <dt
      className={`flex min-w-0 flex-1 items-baseline gap-x-2 ${sub ? 'pl-4' : ''} ${
        strong ? 'text-zeus/90' : sub ? 'text-zeus/60' : 'text-zeus/70'
      }`}
    >
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 text-left transition-colors hover:text-rosewood focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
        >
          {label}
          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 text-rosewood/70 transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </button>
      ) : (
        <span className="shrink-0">{label}</span>
      )}
      {hint && <span className="shrink-0 text-xs text-zeus/45">{hint}</span>}
      {/* The leader. An empty flex item's baseline is its bottom margin edge,
          so on a baseline-aligned row its bottom border lands on the text
          baseline without being positioned. It also does the aligning: taking
          up the slack is what pins every figure to the same right edge. */}
      <span aria-hidden="true" className="min-w-4 flex-1 border-b border-dotted border-gold/60" />
    </dt>
    <dd
      className={`shrink-0 text-right tabular-nums ${
        strong ? 'font-medium text-rosewood' : sub ? 'text-zeus/70' : 'text-zeus'
      }`}
    >
      {note && <span className="mr-2 text-xs text-zeus/50">{note}</span>}
      {currency === 'inr' ? inr(amount) : usdAt(amount, rate)}
    </dd>
  </div>
)

export default AdminKeralaTrip
