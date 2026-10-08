/**
 * The Guest Summary's "Export Attending Guests" spreadsheet: every guest who
 * said yes to at least one event, one name per row and nothing else, with each
 * party kept together and boxed.
 *
 * Names only, with no heading over each list, because the user asked for a file
 * to paste names out of rather than one to read. The lists stay apart and in
 * the page's chip order — Anupama, Jackson, Vidya, Venkat — with a blank row
 * between each pair, so it is still clear where one list ends without a heading.
 *
 * write-excel-file is imported on click, as jspdf is for the e-visa photo, so the
 * library is downloaded only by someone who actually exports.
 */

import type { GuestSummaryEntry } from './adminUnlock'
import { SIDES, onSide } from './guestLists'
import { saveBlob } from './saveBlob'

export const ATTENDING_GUESTS_FILENAME = 'attending-guests.xlsx'

/**
 * The outline drawn around a party's names. A party is boxed and a lone guest
 * is not, the same distinction the Guest Summary page draws, so the file reads
 * like the page it came from.
 *
 * Medium and rosewood, not the page's thin gold. The first version used the
 * gold, and in Numbers it vanished: Numbers draws its own grey gridlines under
 * every cell, and a thin pale line laid over one is indistinguishable from it.
 * The file had the borders all along; nobody could see them.
 */
const PARTY_BORDER = { style: 'medium', color: '#8e5164' } as const

const byLead = (a: string[], b: string[]) => a[0].localeCompare(b[0], 'en', { sensitivity: 'base' })

/**
 * Neighbouring entries that share a `party`, as runs of names — the same pass
 * the page's `groups` makes, and correct for the same reason: the generator
 * emits a household's members consecutively, and filtering keeps that order.
 */
const parties = (entries: readonly GuestSummaryEntry[]): string[][] => {
  const out: { party?: number; names: string[] }[] = []
  for (const entry of entries) {
    const previous = out.at(-1)
    if (previous && entry.party !== undefined && previous.party === entry.party) {
      previous.names.push(entry.name)
    } else {
      out.push({ party: entry.party, names: [entry.name] })
    }
  }
  return out.map(({ names }) => names)
}

/**
 * The attending guests, list by list, each list a run of parties in alphabetical
 * order. A guest who came alone is a party of one.
 *
 * Parties are sorted as wholes, under their first-listed member, and keep their
 * roster order inside. Sorting names one by one was the first version and it
 * scattered every household across the file: a couple whose names start A and W
 * ended up at opposite ends of the list. The first-listed member is almost always
 * the person the invitation went to, which is who you would look the party up by.
 *
 * Only the attending members of a party are in it. This is the attending list,
 * so a household where one person declined is the others, still together.
 *
 * "Attending" is the whole-guest `status`, the same as the page's Attending chip:
 * yes to at least one event. Infants are included. The page keeps them as rows
 * and only leaves them out of the counts, and anyone using this list to seat
 * people or write place cards needs to see them.
 *
 * Empty lists are dropped, so a list with nobody on it adds no blank row of its
 * own. A guest on none of the four lists goes at the end rather than being left
 * out. That only happens briefly, when the index is a version behind the
 * bundle (see onSide), and a silently shorter file would be worse than a
 * group nobody expected.
 */
export function attendingGuestLists(summary: readonly GuestSummaryEntry[]): string[][][] {
  const attending = summary.filter((entry) => entry.status === 'attending')
  const listed = SIDES.map(({ value }) => attending.filter((entry) => onSide(entry, value)))
  const unlisted = attending.filter((entry) => !listed.some((list) => list.includes(entry)))
  return [...listed, unlisted]
    .filter((list) => list.length > 0)
    .map((list) => parties(list).toSorted(byLead))
}

/** One name's cell, boxed on whichever sides its place in the party calls for. */
const nameCell = (name: string, index: number, party: readonly string[]) =>
  party.length === 1
    ? { value: name }
    : {
        value: name,
        leftBorderStyle: PARTY_BORDER.style,
        leftBorderColor: PARTY_BORDER.color,
        rightBorderStyle: PARTY_BORDER.style,
        rightBorderColor: PARTY_BORDER.color,
        ...(index === 0
          ? { topBorderStyle: PARTY_BORDER.style, topBorderColor: PARTY_BORDER.color }
          : {}),
        ...(index === party.length - 1
          ? { bottomBorderStyle: PARTY_BORDER.style, bottomBorderColor: PARTY_BORDER.color }
          : {}),
      }

/** The sheet's rows: one name each, and a blank row between lists. */
export function attendingGuestRows(summary: readonly GuestSummaryEntry[]) {
  return attendingGuestLists(summary).flatMap((list, index) => [
    ...(index > 0 ? [[null]] : []),
    ...list.flatMap((party) => party.map((name, i) => [nameCell(name, i, party)])),
  ])
}

/** Builds the spreadsheet and saves it as attending-guests.xlsx. */
export async function exportAttendingGuests(summary: readonly GuestSummaryEntry[]): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const blob = await writeXlsxFile(attendingGuestRows(summary), {
    columns: [{ width: 40 }],
  }).toBlob()
  saveBlob(blob, ATTENDING_GUESTS_FILENAME)
}
