/**
 * Which printed-invite page a guest belongs to, from their With Joy tags.
 *
 * Shared by the generator (which resolves it once per guest at sync time and
 * fails loudly on a combination with no page) and by /admin/guest-summary
 * (which turns it into a copy button beside the name). Plain JS with a
 * hand-written .d.ts, like guestName.js and guestCrypto.js, because scripts/
 * imports it as-is.
 */

/**
 * The side-of-the-wedding tags. Every guest carries exactly one today; the
 * generator fails the sync rather than guess for a guest carrying both or
 * neither, because either answer would send somebody the wrong invitation.
 *
 * Not to be confused with the 'vidya'/'venkat' tags, which split Anupama's side
 * between her parents' lists and drive the filter chips. Both families of tag
 * live on the same guests and neither implies the other.
 */
export const INVITE_SIDE_TAGS = ['anupama', 'jackson']

/**
 * The three events the invitations differ over, and the letter each contributes
 * to the compact `events` string below.
 *
 * 'muhurtam' is spelled with one 'h' deliberately — that is the tag in With Joy.
 * The RSVP column beside it is 'muhurtham' with two, and the event is titled
 * Muhurtham everywhere a guest can see it. Only the tag is odd.
 *
 * Order is load-bearing: it is the order of the letters in `events` and of the
 * columns on the page, and it runs earliest event first.
 */
export const INVITE_EVENTS = [
  { tag: 'sangeet', letter: 'S', label: 'Sangeet' },
  { tag: 'muhurtam', letter: 'M', label: 'Muhurtham' },
  { tag: 'reception', letter: 'R', label: 'Reception' },
]

/**
 * A guest's events as a string of letters in INVITE_EVENTS order — 'SMR', 'MR',
 * 'M'.
 *
 * A string rather than an array of tag names because every guest's copy of this
 * ships inside schedule-index.json, which *every* guest downloads to identify
 * themselves, not just the four admins. The array spelling costs about 26KB more
 * on a 359KB file to say the same thing, and the letters are what the narrow
 * screen renders anyway.
 */
export function inviteEventsFor(tags) {
  return INVITE_EVENTS.filter(({ tag }) => tags.has(tag))
    .map(({ letter }) => letter)
    .join('')
}

/**
 * The four invite pages, keyed by side and event letters.
 *
 * Trailing slashes match what /admin/invite-links already publishes and what
 * the preview server needs; a path without one serves the landing page.
 *
 * Jackson's side has one page only. There is no narrowed 'wearn' variant, so a
 * Jackson-side guest invited to less than everything resolves to nothing here
 * and stops the sync — deliberately, since the alternative is quietly handing
 * them an invitation to two events they were not asked to.
 */
const LINKS = {
  jackson: {
    SMR: '/invites/wearn/',
  },
  anupama: {
    SMR: '/invites/tadanki/',
    MR: '/invites/tadanki/reception/',
    M: '/invites/tadanki/muhurtham/',
  },
}

/** The guest's invite page, or undefined if no page covers that combination. */
export function inviteLinkFor(side, events) {
  return LINKS[side]?.[events]
}
