import React, { useCallback, useMemo, useState } from 'react'
import type { GuestSummaryEntry, GuestSummaryStatus } from '../lib/adminUnlock'
import { useAdminContext } from '../lib/adminContext'
import { chipClass } from '../lib/chipClass'
import { JUMP_NAV_SECTION_TOP, SITE_NAV_OFFSET, SITE_ORIGIN } from '../lib/constants'
import { fold } from '../lib/guestName'
import { SUMMARY_EVENTS, inviteEventsIn, inviteLinkFor } from '../lib/inviteLink'
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
 * What a dot says about one event, and which mark says it.
 *
 * Four states answering two different questions. Three are the guest's own
 * answer — yes, no, nothing yet — and the fourth is that the question was never
 * put to them: someone invited to the muhurtham alone has no answer to give
 * about the sangeet and never will.
 *
 * The dots were two states until now, filled for invited and hollow for not,
 * and the comment here argued against a red one on the grounds that most guests
 * miss at least one event, so a column of red would read as something being
 * wrong. That argument was about *invitation*, and it does not survive the move
 * to attendance: a guest declining the reception is precisely what this page
 * exists to be able to say, and there is nothing about it to soften. What does
 * survive is the reason the ring was hollow — an event nobody was asked about is
 * an absence, not a no — so 'not invited' keeps a mark of its own, and only the
 * three answers carry colour.
 *
 * That mark is a dash rather than a fourth colour because it belongs to the
 * other question. A row of dots invites you to compare their colours; a dash
 * refuses the comparison, which is right, since there is no answer there to
 * compare. It also means colour is never the only thing distinguishing the two
 * states that mean the least alike.
 *
 * `mark` is the whole class list rather than just the fill, shape and all, so
 * that the cell and the legend render every state through the same string and
 * cannot drift into drawing the same state two ways.
 */
const MARK = 'inline-block shrink-0 rounded-full align-middle'

const DOTS = {
  attending: { mark: `${MARK} h-2.5 w-2.5 bg-fern`, say: 'Attending' },
  declined: { mark: `${MARK} h-2.5 w-2.5 bg-clay`, say: 'Not attending' },
  none: { mark: `${MARK} h-2.5 w-2.5 bg-zeus/30`, say: 'No response for' },
  uninvited: { mark: `${MARK} h-0.5 w-2.5 bg-zeus/25`, say: 'Not invited to' },
} as const

type DotState = keyof typeof DOTS

/**
 * The legend under the filters, in STATUSES order — the same three answers in
 * the same left-to-right order as the RSVP chips a few pixels above it.
 *
 * It used to run 'no response' first, on the reasoning that it is the order the
 * answers arrive at. That reasoning holds and it still lost: the two rows sit
 * one under the other and say almost the same four words, so a reader lines
 * them up whether or not they were meant to, and a legend whose order disagreed
 * with the chips read as a third thing to learn rather than a key to the first.
 * Matching the chips costs the arrival order nothing anybody was reading.
 *
 * 'Not invited' stays last, after the three, because it is the one that is not
 * an answer — STATUSES has no chip for it, and there is nothing above it to
 * line up with.
 */
const LEGEND: readonly { state: DotState; label: string }[] = [
  { state: 'attending', label: 'Attending' },
  { state: 'declined', label: 'Not attending' },
  { state: 'none', label: 'No response' },
  { state: 'uninvited', label: 'Not invited' },
]

/**
 * Which of the four an event is in for one guest.
 *
 * The invitation is tested first, before either answer, because that is the
 * order the states are true in: `attending` and `declined` are subsets of
 * `events` by construction, and testing this way round means nothing can claim
 * an event the guest does not carry even if some later generator puts one
 * there. A letter somehow in both reads as attending; no index produces one,
 * and it is not worth a branch to say so.
 *
 * All three fields are absent on an index built before the answers existed,
 * which lands every invited event on 'none'. That is the honest reading of an
 * index that was never asked the question — see GuestSummaryEntry.
 */
const dotState = (member: GuestSummaryEntry, events: string, letter: string): DotState => {
  if (!events.includes(letter)) return 'uninvited'
  if (member.attending?.includes(letter)) return 'attending'
  if (member.declined?.includes(letter)) return 'declined'
  return 'none'
}

/**
 * Whose list to show. The four partition the roster: Vidya's and Venkat's guests
 * are all on Anupama's side, so hers is what is left of it once their two lists
 * are taken out.
 *
 * There is deliberately no "Everyone" chip. It used to be the first of five, and
 * it was the odd one out — four lists and a not-a-list sitting as peers, with no
 * equivalent on the RSVP row below, which meant the page could never show all
 * three answers at once. Both rows now say "no filter" the same way: nothing
 * selected. Clicking the chip you are on releases it.
 */
const SIDES = [
  { value: 'anupama', label: 'Anupama' },
  { value: 'jackson', label: 'Jackson' },
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

/**
 * The events the table has a column for, as chips.
 *
 * Mapped out of SUMMARY_EVENTS rather than written out a second time, so the
 * chips cannot fall out of order with the columns above them or quietly miss
 * one: a fifth column added there arrives here with it, in the same place.
 *
 * Keyed by `letter` and not by `tag`, because the letter is what an entry's
 * `events`, `attending` and `declined` are spelled in — the tag is a With Joy
 * detail that never reaches the browser at all.
 */
const EVENTS: readonly { value: string; label: string }[] = SUMMARY_EVENTS.map(
  ({ letter, label }) => ({ value: letter, label }),
)

/**
 * 'the Muhurtham'; 'the Muhurtham and the Reception'; 'the Sangeet, the
 * Muhurtham and the Reception'.
 *
 * Hand-rolled rather than Intl.ListFormat, on exactly the reasoning
 * formatEventDate gives for dates: this string is built once in Node during the
 * prerender and again in the browser on hydration, and the two only agree if
 * nothing about it is locale-dependent.
 *
 * Never called with an empty list — the breakdown that calls it is null when no
 * chip is pressed.
 */
const joinLabels = (labels: string[]) =>
  labels.length < 3
    ? labels.map((label) => `the ${label}`).join(' and ')
    : `${labels
        .slice(0, -1)
        .map((label) => `the ${label}`)
        .join(', ')} and the ${labels.at(-1)}`

type Side = (typeof SIDES)[number]['value']

/**
 * Whether a guest belongs on the chosen list.
 *
 * Two independent tag families meet here. `side` is which side of the wedding
 * the guest is on, and every guest on the real roster has one — the sync fails
 * rather than publish a guest who doesn't. `tag` is the finer split of Anupama's
 * side between her parents' lists, and it is set only for those two, so its
 * absence is the "on neither of them" test.
 *
 * An entry carrying no `side` is on none of the four lists, and so shows up only
 * when the row is empty. That is the honest answer for the one case that
 * produces it: this bundle and schedule-index.json deploy separately, so for a
 * moment the index in front of it is a version behind and has no side to file
 * its guests under. See GuestSummaryEntry.
 *
 * Only called with a chosen side — "no chip" is tested at the call site rather
 * than as a case here, so the switch stays exhaustive over the real lists and
 * the compiler keeps it that way when one is added.
 */
const onSide = (entry: GuestSummaryEntry, side: Side) => {
  switch (side) {
    case 'anupama':
      return entry.side === 'anupama' && !entry.tag
    case 'jackson':
      return entry.side === 'jackson'
    default:
      return entry.tag === side
  }
}

/**
 * The shell every row of filter chips is drawn in: its label, and the group
 * semantics that tie the two together.
 *
 * The label is what the rows were missing: on their own they were chips in a
 * heap, and nothing on the page said that one row and the next answer different
 * questions.
 *
 * `role="group"` with aria-labelledby rather than a fieldset and legend. These
 * are buttons carrying aria-pressed, not radios, and a fieldset would announce
 * them as a set of form controls to fill in rather than a view to switch. That
 * is also what makes an empty row possible at all: a radio group cannot be
 * emptied once answered, and emptying it is how you say "no filter" here.
 *
 * Split out from FilterRow when the Event row arrived, because that row differs
 * from the other two only in how many chips may be pressed at once. Everything
 * a reader can see or hear about the three rows is this component, which is the
 * point — rows that look alike and announce alike should not be free to drift
 * apart in the markup underneath.
 */
function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  const labelId = React.useId()
  return (
    // The label sits above the chips on a phone and beside them once there is
    // room. Fixed width and right-aligned there, so every row's chips start at
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
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

/**
 * A row where one chip at a time is pressed, and pressing it again releases it.
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
  selected: T | null
  onSelect: (value: T | null) => void
}) {
  return (
    <ChipRow label={label}>
      {options.map(({ value, label: option }) => (
        <button
          key={value}
          type="button"
          aria-pressed={selected === value}
          onClick={() => onSelect(selected === value ? null : value)}
          // Every chip in this component is a toggle — that is what the row
          // being emptiable means — so the hover cue is unconditional here.
          className={chipClass(selected === value, { toggles: true })}
        >
          {option}
        </button>
      ))}
    </ChipRow>
  )
}

/**
 * A row where any number of chips can be pressed at once.
 *
 * The events are the one axis where the useful question is a combination:
 * "who is invited to both the muhurtham and the reception and has answered
 * about neither" has no single-select spelling, and asking it two chips at a
 * time would mean reading two lists and intersecting them by eye.
 *
 * Deliberately identical to FilterRow to look at and to hear — same shell, same
 * chipClass, same aria-pressed. Only the exclusivity differs, and it is the one
 * difference a reader discovers by pressing a second chip. A row that announced
 * itself differently would be the surprise; a chip that looked different would
 * be a second thing to learn about a control that behaves the same in every
 * other respect.
 *
 * Emits a fresh Set rather than mutating the one it was handed. A mutated Set
 * keeps its identity, and the memos downstream would have no way to tell that
 * anything had happened — the list would simply stop responding to the chips.
 */
function EventRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: readonly { value: string; label: string }[]
  selected: ReadonlySet<string>
  onToggle: (next: ReadonlySet<string>) => void
}) {
  return (
    <ChipRow label={label}>
      {options.map(({ value, label: option }) => {
        const pressed = selected.has(value)
        return (
          <button
            key={value}
            type="button"
            aria-pressed={pressed}
            onClick={() => {
              const next = new Set(selected)
              if (pressed) next.delete(value)
              else next.add(value)
              onToggle(next)
            }}
            className={chipClass(pressed, { toggles: true })}
          >
            {option}
          </button>
        )
      })}
    </ChipRow>
  )
}

// The gate, the page chrome and "Forget this device" all live in AdminLayout;
// this renders only what is behind them, and reads the decrypted roster off the
// outlet rather than unlocking a second time.
const GuestSummary: React.FC = () => {
  const { summary } = useAdminContext()

  // All three start as they always have: no list chosen, no event chosen, and
  // the answer nobody has given yet. null is the empty row rather than a
  // sentinel value in the option lists, so "no filter" cannot be typo'd into a
  // filter that matches nothing.
  const [side, setSide] = useState<Side | null>(null)
  // An empty Set is the Event row's way of saying the same thing, and it is the
  // starting state on purpose: this row is an addition to the page rather than
  // a change of default, so /admin/guest-summary still opens on exactly the
  // list it has always opened on — everyone who has answered nothing at all.
  const [chosenEvents, setChosenEvents] = useState<ReadonlySet<string>>(() => new Set())
  const [status, setStatus] = useState<GuestSummaryStatus | null>('none')
  const [query, setQuery] = useState('')

  // The column headings pin under whatever is above them, which is one bar or
  // two: SectionNav hides on the way down the page, and a header parked at the
  // two-bar offset would leave a strip of rows showing through where that bar
  // used to be. Reading the same hook SectionNav reads keeps the two in step —
  // same scroll events, same threshold, same 200ms.
  const [sectionNavHidden] = useHiddenOnScrollDown()

  // fold() is what the generator matches names with, so the box behaves like the
  // rest of the site: case, accents and punctuation all fall away, and 'jose'
  // finds José. Folded once here rather than per row per keystroke.
  const needle = useMemo(() => fold(query), [query])

  /**
   * The rows the filters leave, for a given RSVP answer: the chips first, then
   * the search box within them.
   *
   * The search narrows what the chips left rather than reaching past them, which
   * is the only reading that keeps the count line honest — a box that searched
   * the whole roster would report guests the chips say are not on this list.
   *
   * A match pulls in the rest of its household, because a party outline drawn
   * around one of four names reads as a mistake. It pulls them from `kept`, not
   * from `summary`: a housemate the chips already excluded stays excluded, on
   * the same principle the grouping below is built on.
   *
   * Takes the answer as an argument rather than reading `status` off the state,
   * and that is what the breakdown below needs. A breakdown counted off the rows
   * on screen with 'Not Attending' pressed would report nought attending — a
   * fact about the chip, not about the event. So it runs this same pipeline a
   * second time with the RSVP row released, rather than the page keeping two
   * filters that have to be remembered to agree.
   */
  const select = useCallback(
    (want: GuestSummaryStatus | null) => {
      const kept = summary.filter((entry: GuestSummaryEntry) => {
        if (side !== null && !onSide(entry, side)) return false
        // No event pressed: the RSVP row is the whole-guest verdict, which is
        // the only thing this page has ever meant by it.
        if (chosenEvents.size === 0) return want === null || entry.status === want
        /*
         * One or more pressed, and they combine with AND on both questions at
         * once: invited to every one of them, and — if a chip is pressed on the
         * row below — answering the same way about every one of them.
         *
         * Chosen over OR because the two useful questions are both universal.
         * 'Muhurtham + Reception, No Response' is the list worth a phone call:
         * people who owe an answer on both. Under OR it would also hold guests
         * who have already confirmed the ceremony and merely not the reception,
         * which is a different conversation. And 'all four, Attending' means
         * coming to everything, which OR cannot say at all.
         *
         * `uninvited` short-circuits before the answer is even looked at, so a
         * guest never appears under an event nobody asked them about. That is
         * the same order dotState tests in, and for the same reason.
         */
        for (const letter of chosenEvents) {
          const state = dotState(entry, entry.events ?? '', letter)
          if (state === 'uninvited') return false
          if (want !== null && state !== want) return false
        }
        return true
      })
      if (!needle) return kept
      const hit = (entry: GuestSummaryEntry) => fold(entry.name).includes(needle)
      const parties = new Set(
        kept.filter((entry) => entry.party !== undefined && hit(entry)).map((entry) => entry.party),
      )
      return kept.filter(
        (entry) => hit(entry) || (entry.party !== undefined && parties.has(entry.party)),
      )
    },
    [summary, side, chosenEvents, needle],
  )

  /** The rows on screen. */
  const visible = useMemo(() => select(status), [select, status])

  /**
   * How the events the chips name have actually been answered, over the guests
   * the rest of the filters left.
   *
   * The cohort is `select(null)` — the same guest list as the table with the
   * RSVP row released — so the three numbers on each line sum to it, and none of
   * them moves when you press a chip on the RSVP row. Pressing one changes which
   * of these guests you are looking at, not how many of them there are.
   *
   * It does follow the Guest list chip and the search box, for the reason the
   * guest count above it follows them: a breakdown counting people the chips say
   * are not on this list would be a lie about the list you are reading.
   *
   * Driven off SUMMARY_EVENTS rather than by iterating the Set, so the lines
   * come out in the table's own order however the chips happened to be pressed.
   *
   * The same derivation the sync log prints as `summaryPerEvent`, so with no
   * other filter set the two can be read against each other.
   */
  const breakdown = useMemo(() => {
    if (chosenEvents.size === 0) return null
    const cohort = select(null)
    const chosen = SUMMARY_EVENTS.filter(({ letter }) => chosenEvents.has(letter))
    return {
      cohort: cohort.length,
      scope: joinLabels(chosen.map(({ label }) => label)),
      rows: chosen.map(({ letter, label }) => {
        const state = (entry: GuestSummaryEntry) => dotState(entry, entry.events ?? '', letter)
        return {
          letter,
          label,
          attending: cohort.filter((entry) => state(entry) === 'attending').length,
          declined: cohort.filter((entry) => state(entry) === 'declined').length,
          none: cohort.filter((entry) => state(entry) === 'none').length,
        }
      }),
    }
  }, [select, chosenEvents])

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
          within Anupama's side, not two more hosts alongside it. */}
      <div className="card">
        {/* w-fit on the inner block, not items-center on the rows: centring the
            rows individually would centre each on its own width, and the three
            would step in and out against each other. This sizes the block to
            the widest row and centres that, so the controls still line up. */}
        <div className="flex flex-col gap-3 sm:mx-auto sm:w-fit">
          {/* Above the chips, not below: this is the "find one person" control
              and the chips read as refinements under it.

              A label rather than a third role="group" — one input needs no
              grouping semantics, and the two groups on the page stay the two
              questions the chips ask. The label reuses the chip rows' styling
              exactly, so all three controls start at the same x on desktop.

              type="search" for the clear affordance and the Escape key the
              browser gives it for free. Fixed width because the block around it
              is w-fit, where flex-1 has nothing to grow into. */}
          <label className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <span className="text-xs uppercase tracking-wide text-zeus/60 sm:w-24 sm:shrink-0 sm:text-right">
              Search
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name"
              className="w-full rounded-full border border-gold/50 bg-white/70 px-3.5 py-1.5 text-sm text-zeus placeholder:text-zeus/40 focus-visible:outline-2 focus-visible:outline-gold sm:w-64"
            />
          </label>
          <FilterRow label="Guest list" options={SIDES} selected={side} onSelect={setSide} />
          {/* Above the RSVP row, because it scopes it: with a chip pressed here
              the three answers below stop being the guest's one verdict and
              become their answer about these events. The label stays a plain
              "RSVP" rather than naming them — several can be pressed at once and
              there is no short label for that — so the cohort line under the
              count is what says which events are being answered about. */}
          <EventRow
            label="Event"
            options={EVENTS}
            selected={chosenEvents}
            onToggle={setChosenEvents}
          />
          <FilterRow label="RSVP" options={STATUSES} selected={status} onSelect={setStatus} />
        </div>
      </div>

      <p aria-live="polite" className="mt-6 text-center text-sm text-zeus/70">
        {visible.length} {visible.length === 1 ? 'guest' : 'guests'}
      </p>

      {/* Outside the live region above deliberately. The guest count is one
          number and worth announcing on every keystroke; this is up to four
          lines of them, and read out that often it would bury the count it sits
          under rather than add to it.

          The cohort line leads because it is what says the chips combine with
          AND — 'invited to the Muhurtham and the Reception', not either — and it
          is why every line below it sums to the same total. */}
      {breakdown && (
        <div className="mt-1 text-center">
          <p className="text-sm text-zeus/70">
            {breakdown.cohort} invited to {breakdown.scope}
          </p>
          <ul className="mt-1 flex flex-col items-center gap-0.5 text-xs text-zeus/60">
            {breakdown.rows.map(({ letter, label, attending, declined, none }) => (
              <li key={letter}>
                {/* The same three words as the RSVP chips and the legend, in the
                    same order, so all three rows of the page can be read down. */}
                <span className="text-zeus/75">{label}</span> — {attending} attending · {declined}{' '}
                not attending · {none} no response
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Four marks nobody chose to learn, on a table whose column headings only
          say which event each column is. Until now the dots meant invitation and
          the headings were enough; now they mean an answer, and nothing on the
          page said so.

          'Dots:' leads because the words after it repeat the RSVP chips above
          almost exactly and the two mean different things — a chip is one
          verdict for the whole guest, a dot is one event at a time. Outside the
          empty-list branch below, so it is there to read while you are working
          out why a filter emptied the table.

          A list rather than a row of spans: it is four items, and a reader
          should be told how many before it starts reading them. */}
      <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-zeus/60">
        <li aria-hidden="true">Dots:</li>
        {LEGEND.map(({ state, label }) => (
          <li key={state} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={DOTS[state].mark} />
            {label}
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        // Two sentences, because they are two different disappointments. With
        // the box empty the list itself is empty, which is worth knowing. With
        // something typed in it, the list is fine and the name is the problem —
        // and echoing back what was searched for is what catches the typo.
        <p className="card mt-4 text-center text-sm text-zeus/80">
          {query.trim() ? `Nobody matching “${query.trim()}”.` : 'Nobody on this list right now.'}
        </p>
      ) : (
        /* Edge to edge on a phone. Four dot columns, a name and a copy button
            do not fit inside the shell's px-4 gutter and the card's own padding
            on top of it, and the first thing to give was the name column, which
            is the one you scan. So below sm the card breaks out of the gutter
            and drops the two borders and the rounding that would otherwise sit
            against the screen edge; the table's existing 1rem bleed then runs it
            to the glass, and the outer cells' pl-7/pr-4 are the only inset left.

            The two overrides carry `!` because `.card` is unlayered in
            globals.css, which outranks Tailwind's utilities layer outright — a
            plain `rounded-none` here would lose silently. `max-sm:` rather than
            a pair of overrides in both directions, so nothing has to be undone
            at the breakpoint.

            And at the other end it breaks out the other way. AdminLayout's
            shell is a max-w-2xl reading column, which is the right width for
            prose and 130px too narrow for six columns with the events spelled
            out. -mx-16 buys the table 128px once there is that much slack
            either side of the column to take it from, which at lg there is
            three times over. */
        <div className="card mt-4 max-sm:-mx-4 max-sm:rounded-none! max-sm:border-x-0! lg:-mx-16">
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
                    Spelled out where there is room, and down to its initial
                    everywhere else.

                    'Where there is room' moved from sm to lg when the
                    pellikuthuru became a fourth column. Four words cost about
                    400px of a 670px table, which left the name column 148px and
                    wrapped a quarter of the roster onto two lines — and the
                    names are the column you actually run a finger down. Below
                    lg the letters cost about 90px instead; at lg the card
                    widens (see below) and the words fit again with room to
                    spare for the longest name on the roster. */}
                {SUMMARY_EVENTS.map(({ tag, letter, label }) => (
                  <th
                    key={tag}
                    scope="col"
                    className="sticky top-[inherit] border-b-2 border-rosewood/40 px-1.5 py-2 text-center text-xs font-normal uppercase tracking-wide text-zeus/60 sm:px-3"
                  >
                    <span className="lg:hidden">{letter}</span>
                    <span className="hidden lg:inline">{label}</span>
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
                    // The invitation is the narrower question: `events` covers
                    // every column on the table, and the pellikuthuru narrows no
                    // invitation, so a 'PSMR' guest and an 'SMR' one are handed
                    // the same page.
                    const link = inviteLinkFor(member.side, inviteEventsIn(events))

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
                        {SUMMARY_EVENTS.map(({ tag, letter, label }) => {
                          const { mark, say } = DOTS[dotState(member, events, letter)]
                          return (
                            <td key={tag} className={`${cell}px-1.5 text-center sm:px-3`}>
                              {/* The words are the row's actual claim, and the
                                  only one a screen reader gets — the colour
                                  says the same thing to everyone else. */}
                              <span className="sr-only">{`${say} ${label}`}</span>
                              {/* A mark, not the letter: the column heading
                                  already says which event this is, and 352 rows
                                  spelling out S M R again read as noise. Which
                                  mark, and why, is DOTS above. */}
                              <span aria-hidden="true" className={mark} />
                            </td>
                          )
                        })}
                        <td className={`${cell}pr-4 pl-2 text-right`}>
                          {/* Every guest resolves to a link — the sync fails
                              rather than publish one who doesn't — so this is
                              belt and braces against an index built before that
                              check existed. */}
                          {link ? <CopyButton compact value={`${SITE_ORIGIN}${link}`} /> : '—'}
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
