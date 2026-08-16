import React, { useMemo, useState } from 'react'
import AdminUnlockNotice, { AdminForgetButton } from '../components/AdminUnlockNotice'
import GuestGateNotice from '../components/GuestGateNotice'
import NotForYouNotice from '../components/NotForYouNotice'
import { useAdminUnlock } from '../lib/adminUnlock'
import type { GuestSummaryEntry, GuestSummaryStatus } from '../lib/adminUnlock'
import { useGuestScheduleContext } from '../lib/guestScheduleContext'
import { chipClass } from '../lib/chipClass'

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

const GuestSummary: React.FC = () => {
  const { isAdmin, status: guestStatus, displayName, signOut } = useGuestScheduleContext()
  const unlock = useAdminUnlock()

  const [side, setSide] = useState<Side>('all')
  const [status, setStatus] = useState<GuestSummaryStatus>('none')

  const visible = useMemo(
    () =>
      unlock.summary.filter(
        (entry: GuestSummaryEntry) =>
          entry.status === status && (side === 'all' || entry.tag === side),
      ),
    [unlock.summary, side, status],
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
    <div className="min-h-screen bg-peach/20 px-4 pb-16">
      <div className="mx-auto max-w-2xl">
        <header className="py-12 text-center">
          <h1 className="font-display text-4xl text-rosewood sm:text-5xl">Guest Summary</h1>
          <p className="mt-4 font-body text-lg leading-relaxed text-zeus/80">
            Who has answered, and who still needs asking.
          </p>
        </header>

        {guestStatus === 'identified' && !isAdmin ? (
          <NotForYouNotice
            displayName={displayName}
            onSignOut={signOut}
            audience="the family keeping track of the guest list"
          />
        ) : !isAdmin ? (
          <GuestGateNotice
            lockedBlurb="This page is just for family — unlock it to see the guest list."
            unlockLabel="Unlock This Page"
            unlockCopy={{
              heading: 'Who are you?',
              blurb: 'Enter your name to open the guest summary.',
            }}
          />
        ) : unlock.status !== 'unlocked' ? (
          <AdminUnlockNotice
            status={unlock.status}
            onUnlock={unlock.unlock}
            blurb="One more step — enter the admin passphrase to see the guest list."
          />
        ) : (
          <div className="font-body">
            {/* Two rows rather than one: on a phone the six chips wrap into an
                unreadable block, and they answer two different questions. */}
            <div className="flex flex-wrap justify-center gap-2">
              {SIDES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={side === value}
                  onClick={() => setSide(value)}
                  className={chipClass(side === value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {STATUSES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={status === value}
                  onClick={() => setStatus(value)}
                  className={chipClass(status === value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <p aria-live="polite" className="mt-6 text-center text-sm text-zeus/70">
              {visible.length} {visible.length === 1 ? 'guest' : 'guests'}
            </p>

            {visible.length === 0 ? (
              <p className="card mt-4 text-center text-sm text-zeus/80">
                Nobody on this list right now.
              </p>
            ) : (
              // Named, because the households inside it are lists too and
              // "list, list, list" is not a thing to navigate by.
              //
              // A grid, so that every household's outline comes out the same
              // width instead of each one hugging its own longest name and
              // leaving a ragged right edge down the page. The middle column is
              // sized to the longest name in the list and shared by every row —
              // that sharing is the whole reason for the grid, and it is not
              // something separate boxes can work out among themselves.
              //
              // The empty 1fr on either side of it is what centres the block in
              // the card: equal tracks split the leftover width evenly, where a
              // single trailing filler piled all of it up on the right.
              //
              // minmax(0, …) rather than bare max-content so a freakishly long
              // name wraps instead of pushing the card wider than the screen.
              <ul
                aria-label="Guests"
                className="card mt-4 grid grid-cols-[1fr_minmax(0,max-content)_1fr] divide-y divide-gold/25"
              >
                {groups.map((members, index) => (
                  // Names repeat on this list — there are two Jane Does — so
                  // the index is part of the key. The list is rebuilt whole on
                  // every filter change, so nothing is being preserved across
                  // reorders that a stabler key would protect.
                  //
                  // Spans all three columns so the rule between rows runs the
                  // full width of the card, as a table's would, while `grid-
                  // cols-subgrid` hands the row back the parent's tracks so its
                  // one child still lands in the shared middle column.
                  //
                  // `-mx-4 px-4` cancels the card's padding to get that bleed;
                  // the two cancel out, so the row's tracks still line up with
                  // the parent's. `py-2` is what keeps the rule from reading as
                  // a second line stacked against the outline below it.
                  <li
                    key={`${members[0].party ?? members[0].name}-${index}`}
                    className="col-span-3 -mx-4 grid grid-cols-subgrid px-4 py-2"
                  >
                    {members.length === 1 ? (
                      <span className="col-start-2 py-0.5 text-base text-zeus">
                        {members[0].name}
                      </span>
                    ) : (
                      // The outline is the whole of the grouping: one household
                      // reads as one block to run a finger down, which is the
                      // point of the page — several of these are four people to
                      // reach with one phone call.
                      //
                      // `-mx-3` hangs it out into the card's own padding, so the
                      // box is drawn around the names without moving them. A
                      // household's names have to sit at the same margin as a
                      // lone guest's, or every group looks indented and the
                      // column of first letters stops being scannable.
                      //
                      // An outline rather than a border for the same reason: a
                      // border is part of the box and would push the names one
                      // pixel right of everybody else's.
                      <ul
                        aria-label={`Party of ${members.length}`}
                        className="col-start-2 -mx-3 rounded-lg px-3 outline-1 outline-gold/50"
                      >
                        {members.map((member, position) => (
                          <li
                            key={`${member.name}-${position}`}
                            className="py-1.5 text-base text-zeus"
                          >
                            {member.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <AdminForgetButton onForget={unlock.forget} />
          </div>
        )}
      </div>
    </div>
  )
}

export default GuestSummary
