import type { GolkondaBed } from './useGuestSchedule'

/**
 * Wording for the Golkonda stay popup on /hotels. Out of the component files
 * because react/only-export-components is an error here, and the hash is read
 * by both the page and the card.
 */

/** `/hotels#golkonda-stay` opens the popup — the link we send guests. */
export const GOLKONDA_STAY_HASH = 'golkonda-stay'

/**
 * The big serif value in the Room cell. 'Twin beds' rather than 'Twin', which
 * on its own reads as a room size more than a bed.
 */
export const BED_LABEL: Record<GolkondaBed, string> = {
  king: 'King',
  twin: 'Twin beds',
  'king-extra': 'King + extra bed',
  'king-sofa': 'King + sofa bed',
  villa: 'Villa',
}

/** 'with Ada Lovelace', 'with Ada Lovelace and Grace Hopper', 'with A, B and C'. */
export function roommatesLabel(roommates: string[]): string {
  if (roommates.length === 0) return 'a room of your own'
  if (roommates.length === 1) return `with ${roommates[0]}`
  return `with ${roommates.slice(0, -1).join(', ')} and ${roommates.at(-1)}`
}

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
const DAY_MS = 86_400_000

// Parsed as UTC midnight and formatted in UTC: these are calendar dates at the
// resort, and a guest reading them in California must not see the 26th.
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`)

/** `Oct 27 – 29`, or `Oct 30 – Nov 1` across a month end. */
export function nightsRange(checkIn: string, checkOut: string): string {
  const from = utc(checkIn)
  const to = utc(checkOut)
  const fromMonth = MONTH.format(from)
  const toMonth = MONTH.format(to)
  return fromMonth === toMonth
    ? `${fromMonth} ${from.getUTCDate()} – ${to.getUTCDate()}`
    : `${fromMonth} ${from.getUTCDate()} – ${toMonth} ${to.getUTCDate()}`
}

/** `2 nights`. */
export function nightsCount(checkIn: string, checkOut: string): string {
  const nights = Math.round((utc(checkOut).getTime() - utc(checkIn).getTime()) / DAY_MS)
  return `${nights} ${nights === 1 ? 'night' : 'nights'}`
}
