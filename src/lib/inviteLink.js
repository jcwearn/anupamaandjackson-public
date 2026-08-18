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
 * Order is load-bearing: it is the order the letters come out of
 * `inviteEventsFor` in, and it runs earliest event first.
 *
 * Three, not four. The pellikuthuru is a wedding event with its own tag and its
 * own RSVP column, and /admin/guest-summary shows a column for it — but no
 * invitation is narrowed by it, so it contributes no letter here and appears in
 * SUMMARY_EVENTS below instead. Adding it to this list would change the keys
 * LINKS is looked up by and hand every guest the wrong page.
 */
export const INVITE_EVENTS = [
  { tag: 'sangeet', letter: 'S', label: 'Sangeet' },
  { tag: 'muhurtam', letter: 'M', label: 'Muhurtham' },
  { tag: 'reception', letter: 'R', label: 'Reception' },
]

/**
 * The pellikuthuru, which is on the guest-summary table and on no invitation.
 *
 * Kept apart from INVITE_EVENTS rather than flagged inside it, because the two
 * lists answer different questions and the compiler cannot tell a list that has
 * grown a member it should ignore from one that has grown a member it should
 * not. See SUMMARY_EVENTS.
 */
const PELLIKUTHURU_EVENT = { tag: 'pellikuthuru', letter: 'P', label: 'Pellikuthuru' }

/**
 * Every event /admin/guest-summary shows a column for, earliest first.
 *
 * The pellikuthuru is on the 26th and the other three run from the 27th, so it
 * leads. Spread from INVITE_EVENTS rather than written out again so the three
 * they share can never fall out of order with each other, which would silently
 * transpose two columns of dots.
 */
export const SUMMARY_EVENTS = [PELLIKUTHURU_EVENT, ...INVITE_EVENTS]

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
 * The same, over every column on the guest-summary table — 'PSMR', 'PM', 'MR'.
 *
 * This is what rides in the index as an entry's `events`, because it is what the
 * table draws. The invitation is the narrower question, and `inviteEventsIn`
 * below is how the page asks it of this string.
 */
export function summaryEventsFor(tags) {
  return SUMMARY_EVENTS.filter(({ tag }) => tags.has(tag))
    .map(({ letter }) => letter)
    .join('')
}

/**
 * The invitation letters inside a summary string — 'PSMR' -> 'SMR', 'PM' -> 'M'.
 *
 * Derived on the page rather than published beside `events`, because it follows
 * from it: publishing both would be two strings that have to agree, in a payload
 * every guest downloads. Filtered through INVITE_EVENTS rather than by dropping
 * 'P', so a second summary-only event costs nothing here.
 */
export function inviteEventsIn(events) {
  return INVITE_EVENTS.filter(({ letter }) => events.includes(letter))
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
