import React, { useMemo, useState } from 'react'
import type { GuestSummaryEntry, GuestSummaryStatus } from '../lib/adminUnlock'
import { useAdminContext } from '../lib/adminContext'
import { chipClass } from '../lib/chipClass'
import { JUMP_NAV_SECTION_TOP, SITE_NAV_OFFSET, SITE_ORIGIN } from '../lib/constants'
import { INVITE_EVENTS, inviteLinkFor } from '../lib/inviteLink'
import { useHiddenOnScrollDown } from '../lib/useHiddenOnScrollDown'
import CopyButton from '../components/CopyButton'

/**
 * The outline drawn around a household's names.
 *
 * An absolutely positioned box rather than a border on the cell, for two
 * reasons. It costs no layout, so a household's names sit at exactly the same
 * margin as a lone guest's — the column of first letters is what makes the list
 * scannable. And being out of flow it can stop short of the row's top and
 * bottom edges: a box flush to them reads as table banding, where one with air
 * around it reads as a party held together.
 *
 * The sides run the full height of every row in the party so they join up; only
 * the two ends are inset, and only they are rounded.
 *
 * `left-4` rather than `left-0`: the cell starts 1rem out in the table's bleed,
 * where the separators want to be and the box does not.
 */
const householdBox = (first: boolean, last: boolean) =>
  [
    'pointer-events-none absolute right-0 left-4 border border-gold/50',
    first ? 'top-1.5 rounded-t-xl' : 'top-0 border-t-0',
    last ? 'bottom-1.5 rounded-b-xl' : 'bottom-0 border-b-0',
  ].join(' ')

/**
 * Whose list to show. 'all' is not a tag — it is the absence of a tag filter,
 * and it includes the guests carrying neither side's tag.
 */
const SIDES = [
  { value: 'all', label: 'Everyone' },
  { value: 'vidya', label: 'Vidya' },
  { value: 'venkat', label: 'Venkat' },
] as const

/**
 * The three answers, in the order they are asked about. 'none' is last and is
 * the reason the page exists: attending and declined are both settled, and the
 * list worth acting on is the one nobody has answered yet.
 */
const STATUSES: { value: GuestSummaryStatus; label: string }[] = [
  { value: 'attending', label: 'Attending' },
  { value: 'declined', label: 'Not Attending' },
  { value: 'none', label: 'No Response' },
]

type Side = (typeof SIDES)[number]['value']

/**
 * One labelled row of filter chips.
 *
 * The label is what the two rows were missing: on their own they were six chips
 * in a heap, and nothing on the page said that the first three and the last
 * three answer different questions.
 *
 * `role="group"` with aria-labelledby rather than a fieldset and legend. These
 * are buttons carrying aria-pressed, not radios, and a fieldset would announce
 * them as a set of form controls to fill in rather than a view to switch.
 *
 * A function declaration, not an arrow: the generic keeps each row's value tied
 * to its own options, so a handler cannot be passed the other row's values.
 */
function FilterRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  selected: T
  onSelect: (value: T) => void
}) {
  const labelId = React.useId()
  return (
    // The label sits above the chips on a phone and beside them once there is
    // room. Fixed width and right-aligned there, so both rows' chips start at
    // the same place instead of stepping in and out with the label's length.
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
    >
      <span
        id={labelId}
        className="text-xs uppercase tracking-wide text-zeus/60 sm:w-24 sm:shrink-0 sm:text-right"
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map(({ value, label: option }) => (
          <button
            key={value}
            type="button"
            aria-pressed={selected === value}
            onClick={() => onSelect(value)}
            className={chipClass(selected === value)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  )
}

// The gate, the page chrome and "Forget this device" all live in AdminLayout;
// this renders only what is behind them, and reads the decrypted roster off the
// outlet rather than unlocking a second time.
const GuestSummary: React.FC = () => {
  const { summary } = useAdminContext()

  const [side, setSide] = useState<Side>('all')
  const [status, setStatus] = useState<GuestSummaryStatus>('none')

  // The column headings pin under whatever is above them, which is one bar or
  // two: SectionNav hides on the way down the page, and a header parked at the
  // two-bar offset would leave a strip of rows showing through where that bar
  // used to be. Reading the same hook SectionNav reads keeps the two in step —
  // same scroll events, same threshold, same 200ms.
  const [sectionNavHidden] = useHiddenOnScrollDown()

  const visible = useMemo(
    () =>
      summary.filter(
        (entry: GuestSummaryEntry) =>
          entry.status === status && (side === 'all' || entry.tag === side),
      ),
    [summary, side, status],
  )

  /**
   * The visible rows, with households drawn together.
   *
   * One pass over adjacent entries, which is enough because the generator
   * emits a household's members consecutively and filtering preserves order.
   *
   * Grouping is applied *after* the filter, deliberately. 25 households on the
   * roster are split across RSVP answers, and on a "who hasn't responded" list
   * the useful thing is the three of them who haven't — not all five with two
   * greyed out. So a household with one member left in view is drawn as an
   * ordinary row: there is nobody for it to be grouped with.
   */
  const groups = useMemo(() => {
    const out: GuestSummaryEntry[][] = []
    for (const entry of visible) {
      const previous = out.at(-1)
      if (previous && entry.party !== undefined && previous[0].party === entry.party) {
        previous.push(entry)
      } else {
        out.push([entry])
      }
    }
    return out
  }, [visible])

  return (
    <>
      <h2 className="font-display text-2xl text-rosewood">Guest Summary</h2>
      <p className="mt-2 mb-6 text-sm text-zeus/70">
        Who has answered, and who still needs asking.
      </p>

      {/* In a card of their own, so the filters read as one panel that acts on
          the table below rather than as loose chrome floating above it.
          "Guest list" rather than "Host": Vidya's and Venkat's are two lists
          within Anupama's side, and the 176 guests on neither of them — all of
          Jackson's side among them — are only reachable under Everyone. */}
      <div className="card">
        {/* w-fit on the inner block, not items-center on the rows: centring the
            rows individually would centre each on its own width, and the two
            would step in and out against each other. This sizes the block to
            the wider row and centres that, so the chips still line up. */}
        <div className="flex flex-col gap-3 sm:mx-auto sm:w-fit">
          <FilterRow label="Guest list" options={SIDES} selected={side} onSelect={setSide} />
          <FilterRow label="RSVP" options={STATUSES} selected={status} onSelect={setStatus} />
        </div>
      </div>

      <p aria-live="polite" className="mt-6 text-center text-sm text-zeus/70">
        {visible.length} {visible.length === 1 ? 'guest' : 'guests'}
      </p>

      {visible.length === 0 ? (
        <p className="card mt-4 text-center text-sm text-zeus/80">Nobody on this list right now.</p>
      ) : (
        <div className="card mt-4">
          {/* border-separate, not collapse, for two reasons the Kerala pricing
              table already documents one of: collapse discards the cell
              border-radius a household's box rounds off with, and it breaks
              `position: sticky` on a header cell.

              The table bleeds 1rem past the card's padding at each side so the
              header rule and the row separators run the card's full width
              rather than stopping short of its corners. The outer cells pad
              that back (pl-7 = the 1rem bleed plus their own 0.75rem), so
              nothing visible moves — only the lines get longer. */}
          <table className="-mx-4 w-[calc(100%+2rem)] border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              Guests, the events they are invited to, and their invitation link
            </caption>
            {/* Sticky on the cells, not the row: `position: sticky` does
                nothing on a `thead` or `tr` in Safari, and the cells are what
                carry the background anyway.

                Opaque, because 352 rows scroll underneath it — the card's own
                bg-white/80 would let every one of them show through. Plain
                white rather than `cream`: the card composites to rgb(255,251,
                252) over the page's peach/20, which white is 4/255 from and
                cream is visibly pinker than. */}
            <thead
              className="sticky z-10 transition-[top] duration-200 [&_th]:bg-white"
              style={{ top: sectionNavHidden ? SITE_NAV_OFFSET : JUMP_NAV_SECTION_TOP }}
            >
              <tr>
                <th
                  scope="col"
                  className="sticky top-[inherit] w-full border-b-2 border-rosewood/40 py-2 pl-7 text-left text-xs font-normal uppercase tracking-wide text-zeus/60"
                >
                  Name
                </th>
                {/* The heading is the only place the event is named, since the
                    cells below are dots — which is why it is worth pinning it.
                    Spelled out where there is room, and down to its initial on
                    a phone, where the three columns together have about 70px. */}
                {INVITE_EVENTS.map(({ tag, letter, label }) => (
                  <th
                    key={tag}
                    scope="col"
                    className="sticky top-[inherit] border-b-2 border-rosewood/40 px-1.5 py-2 text-center text-xs font-normal uppercase tracking-wide text-zeus/60 sm:px-3"
                  >
                    <span className="sm:hidden">{letter}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </th>
                ))}
                <th
                  scope="col"
                  className="sticky top-[inherit] border-b-2 border-rosewood/40 py-2 pr-4 pl-2 text-right text-xs font-normal uppercase tracking-wide text-zeus/60"
                >
                  Invite
                </th>
              </tr>
            </thead>
            {/* One tbody per household, which is the table's own way of saying
                these rows belong together — a screen reader navigates by row
                group, and it costs no markup a sighted reader has to see.
                Households of one get a tbody too, and simply no tint.

                Names repeat on this list — there are two Jane Does — so the
                index is part of the key. The list is rebuilt whole on every
                filter change, so nothing is being preserved across reorders
                that a stabler key would protect. */}
            {groups.map((members, index) => {
              const household = members.length > 1
              const lastGroup = index === groups.length - 1
              return (
                <tbody key={`${members[0].party ?? members[0].name}-${index}`}>
                  {members.map((member, position) => {
                    const first = position === 0
                    const last = position === members.length - 1
                    // Absent on an index built before either field existed; see
                    // GuestSummaryEntry. Reads as a guest invited to nothing,
                    // which is what an unsynced index in fact knows about them.
                    const events = member.events ?? ''
                    const link = inviteLinkFor(member.side, events)

                    // One rule per household, not per name: a household reads
                    // as one block to run a finger down, which is the point of
                    // the page — several of these are four people to reach with
                    // one phone call. The rule under the final row of the final
                    // household is dropped, as the pricing table drops its own.
                    //
                    // py-3 rather than py-2 because at the tighter spacing the
                    // names inside a box had nowhere to breathe and the box read
                    // as a border around text rather than around a party.
                    const rule = last && !lastGroup ? 'border-b border-gold/40 ' : ''
                    const cell = `py-3 ${rule}`

                    return (
                      // The row under the pointer lights up, faintly — on a
                      // list this wide the useful thing is being sure the dots
                      // and the Copy button you are looking at belong to the
                      // name you are looking at.
                      //
                      // On the row rather than the cells: the tint has to run
                      // the row's full width to do that job, and a `tr`
                      // background paints behind cells that declare none of
                      // their own, which every cell here does.
                      //
                      // focus-within alongside it, so tabbing to a row's Copy
                      // button gives the same cue as hovering it. Tailwind
                      // scopes `hover` to devices that have one, so nothing
                      // sticks on a phone.
                      <tr
                        key={`${member.name}-${position}`}
                        className="transition-colors focus-within:bg-lily/15 hover:bg-lily/15"
                      >
                        {/* `relative` so the household box can position against
                            the cell. The name itself stays in normal flow, and
                            so lands at the same margin as a lone guest's. */}
                        <th
                          scope="row"
                          className={`${cell}relative pl-7 text-left text-base font-normal text-zeus`}
                        >
                          {household && (
                            <span aria-hidden="true" className={householdBox(first, last)} />
                          )}
                          {member.name}
                        </th>
                        {INVITE_EVENTS.map(({ tag, letter, label }) => {
                          const invited = events.includes(letter)
                          return (
                            <td key={tag} className={`${cell}px-1.5 text-center sm:px-3`}>
                              <span className="sr-only">
                                {invited ? `Invited to ${label}` : `Not invited to ${label}`}
                              </span>
                              {/* A dot, not the letter: the column heading
                                  already says which event this is, and 352 rows
                                  spelling out S M R again read as noise. Filled
                                  for yes; a hollow ring for no, rather than a
                                  red one, because on a list where most guests
                                  miss at least one event a column of red reads
                                  as something being wrong. */}
                              <span
                                aria-hidden="true"
                                className={`inline-block h-2.5 w-2.5 rounded-full align-middle ${
                                  invited ? 'bg-fern' : 'border border-zeus/25'
                                }`}
                              />
                            </td>
                          )
                        })}
                        <td className={`${cell}pr-4 pl-2 text-right`}>
                          {/* Every guest resolves to a link — the sync fails
                              rather than publish one who doesn't — so this is
                              belt and braces against an index built before that
                              check existed. */}
                          {link ? <CopyButton compact url={`${SITE_ORIGIN}${link}`} /> : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              )
            })}
          </table>
        </div>
      )}
    </>
  )
}

export default GuestSummary
