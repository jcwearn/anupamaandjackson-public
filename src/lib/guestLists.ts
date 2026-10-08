/**
 * The four guest lists the roster is split into, shared by the Guest Summary
 * page's chips and its attending-guests export.
 */

import type { GuestSummaryEntry } from './adminUnlock'

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
export const SIDES = [
  { value: 'anupama', label: 'Anupama' },
  { value: 'jackson', label: 'Jackson' },
  { value: 'vidya', label: 'Vidya' },
  { value: 'venkat', label: 'Venkat' },
] as const

export type Side = (typeof SIDES)[number]['value']

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
export const onSide = (entry: GuestSummaryEntry, side: Side) => {
  switch (side) {
    case 'anupama':
      return entry.side === 'anupama' && !entry.tag
    case 'jackson':
      return entry.side === 'jackson'
    default:
      return entry.tag === side
  }
}
