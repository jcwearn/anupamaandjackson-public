import { aliasesFor, fold } from '../../src/lib/guestName.js'
import { INVITE_SIDE_TAGS, inviteEventsFor, inviteLinkFor } from '../../src/lib/inviteLink.js'
import { partyHintLabel } from './partyLabel.js'
import {
  ADMIN_KDF_ITERATIONS,
  KDF_ITERATIONS,
  SALT_BYTES,
  bytesToBase64,
  deriveAdminKeyBytes,
  deriveGuestKey,
  emailHash,
  encryptJson,
  importEventKey,
  lookupHash,
} from '../../src/lib/guestCrypto.js'

// Bumped to 2 when the guest record gained `golkonda`, to 3 when events gained
// `indianWear`, to 4 when the index gained `guestCount`, to 5 when it gained
// the passphrase-encrypted `admin` block, to 6 when that block's entries gained
// `party`, to 7 when they gained `side` and `events`, to 8 when the admin block
// gained `keralaTrip` beside `summary`, to 9 when its room occupants gained
// `payment`, and to 10 when both they and the guest payload gained
// `hostCovers`. Feeds sourceFingerprint, so bumping it is what makes a shape
// change actually republish.
export const INDEX_VERSION = 10

/**
 * The With Joy tag that admits a guest to the unlinked /admin/invite-links page.
 *
 * Not a gate in the catalog: it admits nobody to an event, so it resolves to a
 * flag on the guest record rather than an entry in `eventIds`.
 */
export const ADMIN_TAG = 'admin'

/**
 * Who has a room held at Golkonda *and* is coming.
 *
 * The two tags say only what was offered. On their own they are badly wrong:
 * 34 of the 86 'hotel-golkonda-own' guests have since RSVPd Not Attending, and
 * 32 answered that they do not need the room. So the tag is one of three
 * conditions, alongside the wedding RSVP and the guest's own answer to the
 * accommodation question.
 *
 * Like ADMIN_TAG this admits nobody to an event — the four hotel events in the
 * catalog are gated on the same two tags — so it resolves to a value on the
 * guest record rather than an entry in `eventIds`. The Hotels page has to tell
 * the two apart, because only 'covered' means the nights are on us.
 */
export const GOLKONDA_STAYS = [
  { tag: 'hotel-golkonda-covered', value: 'covered', answerField: 'golkondaCoveredAnswer' },
  { tag: 'hotel-golkonda-own', value: 'own', answerField: 'golkondaOwnAnswer' },
]

/** The one affirmative With Joy writes into every per-event RSVP column. */
const RSVP_ATTENDING = 'Attending'

async function sha256Base64(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToBase64(new Uint8Array(digest))
}

/**
 * The answers that mean the guest is taking the room. The second is on the
 * list deliberately: those guests are all staying at Golkonda, and the card
 * they get is exactly the pricing they asked for.
 */
export const GOLKONDA_ACCEPTED_ANSWERS = new Set([
  "I'll be staying at Golkonda Resort.",
  "I'd love to learn more about the accommodations and pricing before I make a decision.",
])

/** Every answer With Joy currently emits for those two questions. */
export const GOLKONDA_ANSWERS = new Set([
  ...GOLKONDA_ACCEPTED_ANSWERS,
  'I do not need accommodation.',
  "I'll be arranging my own accommodation separately.",
])

/** 'covered', 'own', or undefined for everyone the Hotels page must not change for. */
export function golkondaStay(guest) {
  const held = GOLKONDA_STAYS.filter(({ tag }) => guest.tags.has(tag))
  if (held.length > 1) {
    throw new Error(
      `Guest at row ${guest.row} carries both Golkonda tags, so it cannot be said whether their ` +
        `room is covered or their own. Clear one in With Joy.`,
    )
  }
  if (held.length === 0) return undefined
  if (guest.muhurthamRsvp !== RSVP_ATTENDING) return undefined
  return GOLKONDA_ACCEPTED_ANSWERS.has(guest[held[0].answerField]) ? held[0].value : undefined
}

/**
 * The RSVP columns behind `golkondaStay` are not tags, so `assertGatesExist`
 * never looks at them — and a column renamed or dropped in With Joy would just
 * mean nobody has a room on /hotels, with nothing in the sync output saying why.
 *
 * Checked against the parsed guests rather than the header row because a guest
 * only carries these fields when the column existed: '' is an unanswered
 * question, absent is a missing column.
 */
export function assertGolkondaColumnsExist(guests) {
  const fields = ['muhurthamRsvp', ...GOLKONDA_STAYS.map(({ answerField }) => answerField)]
  const missing = fields.filter((field) => guests.some((guest) => guest[field] === undefined))
  if (missing.length > 0) {
    throw new Error(
      `The roster has no ${missing.join(', ')} column(s), so no guest would resolve to a room ` +
        `at Golkonda and /hotels would silently lose its personalization. Check the sheet.`,
    )
  }
}

/**
 * The gate turns on four exact free-text strings. If With Joy rewords one, no
 * guest matches any more and the Hotels page goes quietly back to its static
 * self for everybody — so an unrecognized answer has to fail the sync instead.
 */
export function assertGolkondaAnswersRecognized(guests) {
  for (const guest of guests) {
    for (const { tag, answerField } of GOLKONDA_STAYS) {
      const answer = guest[answerField]
      if (!guest.tags.has(tag) || !answer || GOLKONDA_ANSWERS.has(answer)) continue
      throw new Error(
        `Guest at row ${guest.row} answered the Golkonda accommodation question with ` +
          `'${answer}', which this generator does not recognize. Add it to GOLKONDA_ANSWERS in ` +
          `scripts/lib/scheduleIndex.js — and to GOLKONDA_ACCEPTED_ANSWERS if it means they are ` +
          `taking the room.`,
      )
    }
  }
}

/**
 * The two side-of-the-family tags /admin/guest-summary filters on.
 *
 * Lowercase because `rowsToGuests` lowercases the whole header row before
 * stripping ' (tag)' — the sheet spells them 'Vidya (tag)' and 'Venkat (tag)'.
 * No guest carries both today, and nothing here depends on that staying true.
 */
export const SUMMARY_TAGS = ['vidya', 'venkat']

/**
 * The RSVP columns that count as attendance.
 *
 * 'optional trip' is deliberately absent. Its answers include 'I am interested
 * to learn more about the trip', which is neither an acceptance nor a decline,
 * and folding it in would file those 23 guests under Not Attending.
 */
const SUMMARY_RSVP_FIELDS = ['pellikuthuruRsvp', 'sangeetRsvp', 'muhurthamRsvp', 'receptionRsvp']

/**
 * 'attending', 'declined' or 'none', from the four wedding RSVP columns.
 *
 * The three-way split is the whole point of the page: a guest who has answered
 * nothing at all is chased differently from one who has answered no. So a blank
 * is dropped before the verdict rather than counted as a decline — '' is an
 * unanswered question here, exactly as it is for `assertGolkondaColumnsExist`.
 */
export function guestSummaryStatus(guest) {
  const answers = SUMMARY_RSVP_FIELDS.map((field) => guest[field]).filter(Boolean)
  if (answers.length === 0) return 'none'
  return answers.includes(RSVP_ATTENDING) ? 'attending' : 'declined'
}

/**
 * Whether a name part is a name at all.
 *
 * 13 rows carry a literal '.' as their surname — With Joy's placeholder for a
 * guest who gave only one name, distinct from the 14 rows that leave the cell
 * blank. Joined naively those read 'Firstname .' and, worse, all 13 sort to
 * the head of the list together under '.'.
 */
const hasLetter = (part) => /\p{L}/u.test(part ?? '')

/** Surname if there is one, else the whole name — what the list sorts on. */
const sortName = (name) => name.split(' ').at(-1) ?? ''

const byName = (a, b) =>
  sortName(a.name).localeCompare(sortName(b.name)) || a.name.localeCompare(b.name)

/**
 * Every guest resolves to one of the four invite pages.
 *
 * /admin/guest-summary hands out a link per guest, so a guest whose tags name no
 * page would get a blank cell — and a blank cell is exactly the thing nobody
 * notices until the wrong invitation has already been sent. Two ways to land
 * there, both tagging slips in With Joy rather than deliberate:
 *
 * - carrying both side tags or neither, so there is no side to pick a page from;
 * - carrying a set of events no page covers. Jackson's side is the live risk
 *   here, since it has one page and no narrowed variant: anything less than
 *   Sangeet + Muhurtham + Reception has nowhere to point.
 *
 * Rows, never names — the sync's output is counts-only by design, and a row
 * number is what locates them in the sheet anyway. Every offending row at once,
 * because fixing them one failed sync at a time is a bad afternoon.
 */
export function assertEveryGuestHasAnInvite(guests) {
  const sideless = []
  const unlinked = []
  for (const guest of guests) {
    const sides = INVITE_SIDE_TAGS.filter((tag) => guest.tags.has(tag))
    if (sides.length !== 1) {
      sideless.push(guest.row)
      continue
    }
    const events = inviteEventsFor(guest.tags)
    if (!inviteLinkFor(sides[0], events))
      unlinked.push(`${guest.row} (${sides[0]}, ${events || 'no events'})`)
  }

  if (sideless.length > 0) {
    throw new Error(
      `${sideless.length} guest(s) carry both '${INVITE_SIDE_TAGS.join("' and '")}' or neither, so ` +
        `/admin/guest-summary cannot say which invitation is theirs. Rows: ${sideless.join(', ')}`,
    )
  }
  if (unlinked.length > 0) {
    throw new Error(
      `${unlinked.length} guest(s) carry a combination of events that no invite page covers, so ` +
        `/admin/guest-summary would show them no link. Fix the tags in With Joy, or add the page ` +
        `and its entry to LINKS in src/lib/inviteLink.js. Rows: ${unlinked.join(', ')}`,
    )
  }
}

/**
 * The roster behind /admin/guest-summary: one entry per guest, name and verdict only.
 *
 * Built from the raw roster rather than from `buildGuestRecords`, which drops
 * every guest carrying no event tag and no admin tag. Those guests are exactly
 * the ones a "who hasn't responded" list exists to surface, so dropping them
 * would hide the page's most useful rows.
 *
 * Nothing beyond the name reaches the payload — no email, no address, and not
 * the party's *name* either. `party` below is an opaque integer, enough to draw
 * the households together and useless for anything else. `side` and `events`
 * are the two the page needs to name a guest's invitation; the link itself is
 * derived on the page rather than stored, since it follows from those two.
 *
 * Ordering is load-bearing, not cosmetic: the page groups runs of adjacent
 * entries sharing a party, so members of one household have to come out of here
 * next to each other. Households sort to where their alphabetically first
 * member would have sorted alone, which keeps the whole list readable as the
 * A–Z it still mostly is.
 */
export function buildGuestSummary(guests) {
  const entries = guests.flatMap((guest) => {
    const name = [guest.firstName, guest.lastName].filter(hasLetter).join(' ')
    if (!name) return []
    const tag = SUMMARY_TAGS.find((candidate) => guest.tags.has(candidate))
    return [
      {
        name,
        ...(tag ? { tag } : {}),
        side: INVITE_SIDE_TAGS.find((candidate) => guest.tags.has(candidate)),
        events: inviteEventsFor(guest.tags),
        status: guestSummaryStatus(guest),
        key: guest.party,
      },
    ]
  })

  // Households of one are not households. 44 guests carry no party string at
  // all, and two parties have a single member; both are plain rows.
  const households = new Map()
  for (const entry of entries) {
    if (!entry.key) continue
    households.set(entry.key, (households.get(entry.key) ?? []).concat(entry))
  }

  // A unit is one household or one lone guest — whatever moves as a block.
  const units = []
  const grouped = new Set()
  for (const entry of entries) {
    if (grouped.has(entry)) continue
    const members = households.get(entry.key)
    if (!members || members.length < 2) {
      units.push([entry])
      continue
    }
    members.forEach((member) => grouped.add(member))
    units.push([...members].sort(byName))
  }

  units.sort((a, b) => byName(a[0], b[0]))

  let nextParty = 0
  return units.flatMap((members) => {
    // Numbered in output order purely so the client can spot a run; the party's
    // own string never leaves the generator.
    const party = members.length > 1 ? (nextParty += 1) : undefined
    // `key` is the raw party string, dropped here: it is the last thing in this
    // pipeline that is guest data rather than a grouping handle.
    return members.map(({ key: _key, ...entry }) => (party ? { ...entry, party } : entry))
  })
}

/**
 * The RSVP columns behind the summary, like `assertGolkondaColumnsExist` before
 * it: renamed or dropped in With Joy, they would leave every guest looking as
 * though they had never responded, and the page would be confidently wrong
 * rather than visibly broken.
 */
export function assertSummaryRsvpColumnsExist(guests) {
  const missing = SUMMARY_RSVP_FIELDS.filter((field) =>
    guests.some((guest) => guest[field] === undefined),
  )
  if (missing.length > 0) {
    throw new Error(
      `The roster has no ${missing.join(', ')} column(s), so every guest would read as having ` +
        `not responded on /admin/guest-summary. Check the sheet.`,
    )
  }
}

/**
 * Both side-of-the-family tags, for the same reason as `assertAdminTagExists`:
 * a vanished column is not an error anywhere else in the pipeline, it just
 * silently empties one of the page's two filters.
 */
export function assertSummaryTagsExist(knownTags) {
  const missing = SUMMARY_TAGS.filter((tag) => !knownTags.has(tag))
  if (missing.length > 0) {
    throw new Error(
      `No guest carries the ${missing.join(' or ')} tag, so that filter on /admin/guest-summary would ` +
        `come up empty. Check the '… (tag)' columns in the sheet.`,
    )
  }
}

/**
 * Both side-of-the-wedding tags.
 *
 * `assertEveryGuestHasAnInvite` would catch a vanished column too, but it would
 * report all 649 rows as untaggable and bury the one thing that actually
 * happened. This says it in a line.
 */
export function assertInviteSideTagsExist(knownTags) {
  const missing = INVITE_SIDE_TAGS.filter((tag) => !knownTags.has(tag))
  if (missing.length > 0) {
    throw new Error(
      `No guest carries the ${missing.join(' or ')} tag, so no guest could be matched to an ` +
        `invitation on /admin/guest-summary. Check the '… (tag)' columns in the sheet.`,
    )
  }
}

/** Fields copied into the encrypted payload the browser renders. */
const RENDERED_FIELDS = [
  'id',
  'date',
  'time',
  'title',
  'location',
  'address',
  'mapUrl',
  'description',
  'agenda',
  'attire',
  'indianWear',
  'note',
  'linkTo',
  'linkLabel',
  'sortKey',
]

function presentableEvent(event) {
  const out = {}
  for (const field of RENDERED_FIELDS) {
    if (event[field] !== undefined) out[field] = event[field]
  }
  return out
}

/** A gate is a tag name or a list of them meaning any-of. */
export function gateMatches(gate, tags) {
  return Array.isArray(gate) ? gate.some((tag) => tags.has(tag)) : tags.has(gate)
}

export function resolveEventIds(tags, events) {
  return events.filter((event) => gateMatches(event.gate, tags)).map((event) => event.id)
}

/**
 * What makes two same-named guests interchangeable. The admin flag counts: an
 * admin and a non-admin with identical events are still owed different pages.
 * So does the Kerala payload — collapsing across it would show one namesake
 * the other's trip, price and roommate. And so does the Golkonda stay: two
 * namesakes with the same events, one covered and one paying their own way,
 * would otherwise collapse and one of them be quoted the other's price.
 */
function recordSignature(record) {
  return `${[...record.eventIds].sort().join(',')}${record.admin ? '|admin' : ''}${
    record.kerala ? `|kerala:${JSON.stringify(record.kerala)}` : ''
  }${record.golkonda ? `|golkonda:${record.golkonda}` : ''}`
}

/**
 * Decides what a single lookup key resolves to when several guests share it.
 *
 * Five name pairs on this list are genuinely different people, not duplicates,
 * so this has to be correct rather than merely defensive. Where their invite
 * sets match, either record serves and the guest is never prompted. Where they
 * differ, both are kept and the UI asks which household they belong to —
 * unioning would show one guest the other's private events, and intersecting
 * would silently strip events they really are invited to.
 */
export function resolveBucket(records) {
  const signatures = new Set(records.map(recordSignature))
  if (signatures.size === 1) return [records[0]]

  const hints = records.map((record) => record.hint)
  if (hints.some((hint) => !hint) || new Set(hints).size !== hints.length) {
    const who = records.map((record) => `row ${record.row}`).join(', ')
    throw new Error(
      `Guests sharing a name have different invite sets but no distinguishing household ` +
        `hint (${who}). Give them distinct 'party' values in With Joy, or they will be ` +
        `served each other's schedules.`,
    )
  }
  return records
}

/**
 * Cross-checks the two universal events against the copy bundled for
 * prerendering. They are intentionally duplicated — one copy has to ship in
 * the JS bundle to paint instantly — and this is what stops the two drifting.
 *
 * `attire` and `indianWear` are on the list because they are the fields most
 * likely to be reworded: they were left off it once, and the muhurtham dress
 * code could be rewritten here while every visitor who had not identified
 * themselves went on reading the old one out of the bundle.
 */
const MIRRORED_FIELDS = [
  'id',
  'title',
  'description',
  'time',
  'date',
  'location',
  'mapUrl',
  'attire',
]

export function assertUniversalEventsMatch(catalogEvents, bundledSource) {
  const missing = (event, field) => {
    throw new Error(
      `Universal event '${event.id}' has a ${field} in data/schedule-events.json that is ` +
        `missing from src/data/scheduleEvents.ts. Update both — the bundled copy is what ` +
        `guests see before they identify themselves.`,
    )
  }

  for (const event of catalogEvents.filter((candidate) => candidate.universal)) {
    for (const field of MIRRORED_FIELDS) {
      const value = event[field]
      if (value && !bundledSource.includes(value)) missing(event, field)
    }

    // An object rather than a string, so it is checked a member at a time. The
    // bundled copy must hold each line as one literal — a string Prettier has
    // split across a `+` would read as missing.
    for (const [key, value] of Object.entries(event.indianWear ?? {})) {
      if (value && !bundledSource.includes(value)) missing(event, `indianWear.${key}`)
    }
  }
}

export function assertGatesExist(catalogEvents, knownTags) {
  for (const event of catalogEvents) {
    const gates = Array.isArray(event.gate) ? event.gate : [event.gate]
    for (const gate of gates) {
      if (!knownTags.has(gate)) {
        throw new Error(
          `Event '${event.id}' is gated on tag '${gate}', which does not exist in the export. ` +
            `Known tags: ${[...knownTags].sort().join(', ')}`,
        )
      }
    }
  }
}

/**
 * No event is gated on the admin tag, so `assertGatesExist` never looks at it —
 * and a tag renamed or dropped in With Joy would otherwise just mean nobody can
 * open /admin/invite-links, with nothing in the sync output saying why.
 */
export function assertAdminTagExists(knownTags) {
  if (!knownTags.has(ADMIN_TAG)) {
    throw new Error(
      `The '${ADMIN_TAG}' tag does not exist in the export, so /admin/invite-links would be ` +
        `unreachable. Known tags: ${[...knownTags].sort().join(', ')}`,
    )
  }
}

/**
 * Both arguments must be counts of *guests*. Passing the published index's
 * `Object.keys(guests).length` as the baseline is the one mistake to avoid:
 * that object is keyed per alias, and since aliasesFor mints several spellings
 * per guest it runs ~11% above the guest count — enough on its own to trip the
 * 10% floor below and stall the daily sync. Read `guestCount` off the previous
 * index instead.
 */
export function assertRosterPlausible(guestCount, previousCount) {
  if (guestCount === 0) throw new Error('Roster resolved to zero guests — refusing to publish.')
  if (previousCount && guestCount < previousCount * 0.9) {
    throw new Error(
      `Roster dropped from ${previousCount} to ${guestCount} guests (>10%). Refusing to ` +
        `publish in case the export is broken; re-run with --force if this is real.`,
    )
  }
}

/**
 * A guest carrying no gating tag resolves to no record at all, so they are
 * absent from the index and the site tells them we can't find them. That is
 * almost always a tagging slip in With Joy rather than a deliberate exclusion,
 * and as a warning it scrolled past unread — so it fails the sync instead.
 *
 * Rows, never names: the sync's output is counts-only by design, and a row
 * number is what locates them in the sheet anyway.
 */
export function assertEveryGuestResolves(unresolvedRows) {
  if (unresolvedRows.length === 0) return
  throw new Error(
    `${unresolvedRows.length} guest(s) carry no gating tag and would be absent from the ` +
      `index (sheet row(s) ${unresolvedRows.join(', ')}) — they would be told we can't find ` +
      `them. Tag them in With Joy, or re-run with --force to publish without them.`,
  )
}

const KERALA_TRIPS = new Set(['full', 'short'])
const KERALA_FLIGHTS = new Set(['rt', 'ow'])
const KERALA_OCCUPANCIES = new Set(['single', 'double'])
// Which bed the hotel puts in a shared room. Only ever asked of a room with two
// people in it: a single-occupancy guest has one bed and there is nothing to
// choose, so carrying the field there would be a second thing to keep true.
const KERALA_BEDS = new Set(['double', 'twin'])
/** Who a guest sent their money to, and how it got there. */
const KERALA_PAID_TO = new Set(['anupama', 'jackson'])
const KERALA_PAID_VIA = new Set(['zelle', 'venmo', 'paypal', 'roommate'])

/**
 * Attaches each Kerala trip-form response to its roster guest, keyed by email.
 *
 * Matching is against each guest's *own* row's emails, never the party-pooled
 * verifier list — a shared household address that appears on two rows is an
 * error here, not a convenience, because the payload is personal (Jackson's
 * response must not resolve to Anupama's record).
 *
 * Roommates are the other respondents sharing a room number, named by their
 * With Joy full name — first names alone are ambiguous in a family-sized
 * guest list — rather than anything from the form. Every payload rides
 * inside its own guest's encrypted envelope, so nobody can read who anyone
 * else rooms with.
 *
 * Returns `{ payloads, rooms }`: the per-guest Map above, and the same rooms
 * assembled whole for /admin/kerala-trip, which needs to see both occupants at
 * once to answer the agent's rooming questions. That one goes into the
 * passphrase-keyed admin envelope, not any guest's.
 */
export function resolveKeralaPayloads(guests, responses) {
  const byEmail = new Map()
  for (const guest of guests) {
    for (const email of guest.emails ?? []) {
      const key = email.trim().toLowerCase()
      const owners = byEmail.get(key)
      if (owners) owners.push(guest)
      else byEmail.set(key, [guest])
    }
  }

  const matched = new Map()
  for (const response of responses) {
    const { email, trip, flight, occupancy, room, bed } = response
    if (
      !KERALA_TRIPS.has(trip) ||
      !KERALA_FLIGHTS.has(flight) ||
      !KERALA_OCCUPANCIES.has(occupancy) ||
      !Number.isInteger(room) ||
      (response.priceOverride !== undefined &&
        !(Number.isFinite(response.priceOverride) && response.priceOverride > 0))
    ) {
      throw new Error(
        `Kerala response for '${email}' has invalid fields (trip=${trip}, flight=${flight}, ` +
          `occupancy=${occupancy}, room=${room}). Fix data/kerala-trip-responses.json.`,
      )
    }
    // What a guest has actually sent us — which goes to us, not to the agent,
    // and so settles their side without touching what we owe. `roommate` is the
    // one whose share went in with someone else's payment; the room says whose,
    // and the pairing is checked below once every response is matched.
    if (response.payment !== undefined) {
      const { usd, to, via } = response.payment
      const owed = via === 'roommate'
      if (
        !KERALA_PAID_VIA.has(via) ||
        (to !== undefined && !KERALA_PAID_TO.has(to)) ||
        (owed ? usd !== undefined : !(Number.isFinite(usd) && usd > 0))
      ) {
        throw new Error(
          `Kerala payment for '${email}' is malformed (usd=${JSON.stringify(usd)}, ` +
            `to=${JSON.stringify(to)}, via=${JSON.stringify(via)}). A payment needs a positive ` +
            `"usd" and a "via" of ${[...KERALA_PAID_VIA].join('/')}; a "roommate" payment ` +
            `carries no amount of its own. Fix data/kerala-trip-responses.json.`,
        )
      }
    }
    // A shorter name for the admin rooming table, where one 23-character name
    // was setting the width of a column twenty-four rows deep. Display only:
    // the guest's own record still names their roommates in full, because a
    // first name alone is ambiguous in a family-sized guest list.
    if (response.displayName !== undefined && !response.displayName.trim()) {
      throw new Error(
        `Kerala response for '${email}' has an empty displayName. Give it a name or remove ` +
          `the field. Fix data/kerala-trip-responses.json.`,
      )
    }
    // Whose trip this is. Their own places are not money any guest owes us, so
    // /admin/kerala-trip takes them out of what the guests are paying and puts
    // them in what we are covering. A flag in the data rather than a pair of
    // names in the source, which is published.
    if (response.host !== undefined && response.host !== true) {
      throw new Error(
        `Kerala response for '${email}' has host=${JSON.stringify(response.host)}; the field is ` +
          `either true or absent. Fix data/kerala-trip-responses.json.`,
      )
    }
    // What the agent charges over the rate card, as the fact rather than a
    // total: this guest's roommate leaves early, so their final night is a
    // single room. Only ever on a shared room on the full itinerary — the
    // figure is the difference between the two itineraries' final nights, and
    // a shortened stay has no such night to difference.
    if (response.soleUseNights !== undefined) {
      if (
        !Number.isInteger(response.soleUseNights) ||
        response.soleUseNights < 1 ||
        occupancy !== 'double' ||
        trip !== 'full'
      ) {
        throw new Error(
          `Kerala response for '${email}' has soleUseNights=${JSON.stringify(response.soleUseNights)}, ` +
            `which must be a positive integer on a full-itinerary double-occupancy stay. ` +
            `Fix data/kerala-trip-responses.json.`,
        )
      }
    }
    // What we are paying of this guest's own share. Not a discount the agent
    // gives and not a rate they quoted -- they invoice this guest at the card
    // rate like everyone else, and the money moves between us and the guest
    // only. So it never touches the total, and /admin/kerala-trip files it
    // under what we are covering instead.
    //
    // Bounded against `priceOverride` where there is one; where there is not,
    // the ceiling is the rate card, which lives in src/lib/keralaPricing.ts and
    // is TypeScript this file cannot import. Copying the eight rates over here
    // to check a bound is exactly the duplication that file's own header warns
    // against -- one table, two callers -- so the ceiling is left to the review
    // of the figure, and only the arithmetic that can be checked here is.
    if (response.hostCovers !== undefined) {
      if (
        !Number.isFinite(response.hostCovers) ||
        response.hostCovers <= 0 ||
        (response.priceOverride !== undefined && response.hostCovers >= response.priceOverride)
      ) {
        throw new Error(
          `Kerala response for '${email}' has hostCovers=${JSON.stringify(response.hostCovers)}, ` +
            `which must be a positive number of rupees smaller than the price it comes off. ` +
            `Fix data/kerala-trip-responses.json.`,
        )
      }
    }
    // Separate from the check above so the message can say which way it is
    // wrong: the agent asks about beds only for the shared rooms, and a `bed`
    // on a single is as much a mistake as a missing one on a double.
    if (occupancy === 'double' ? !KERALA_BEDS.has(bed) : bed !== undefined) {
      throw new Error(
        occupancy === 'double'
          ? `Kerala response for '${email}' needs a "bed" of "double" or "twin" (got ${JSON.stringify(bed)}) — ` +
              `it shares a room. Fix data/kerala-trip-responses.json.`
          : `Kerala response for '${email}' is single occupancy but carries a "bed" ` +
              `(${JSON.stringify(bed)}). Remove it from data/kerala-trip-responses.json.`,
      )
    }
    let owners = byEmail.get(email.trim().toLowerCase()) ?? []
    if (owners.length === 0) {
      throw new Error(
        `Kerala response email '${email}' matches no roster guest. Edit the address in ` +
          `data/kerala-trip-responses.json to the one With Joy has on file for them.`,
      )
    }
    // With Joy gives an unnamed plus-one placeholder row the invitee's own
    // email, so a shared address is a real shape, not a typo. A response may
    // carry a `name` naming its owner; anything still ambiguous stays fatal.
    if (owners.length > 1 && response.name) {
      owners = owners.filter(
        (owner) => fold(`${owner.firstName} ${owner.lastName}`.trim()) === fold(response.name),
      )
      if (owners.length === 0) {
        throw new Error(
          `Kerala response '${email}' names '${response.name}', but no roster guest with ` +
            `that email is called that. Fix the name in data/kerala-trip-responses.json.`,
        )
      }
    }
    if (owners.length > 1) {
      const rows = owners.map((owner) => `row ${owner.row}`).join(', ')
      throw new Error(
        `Kerala response email '${email}' matches ${owners.length} roster guests (${rows}) — ` +
          `it cannot say whose trip this is. Add a "name" field to the response in ` +
          `data/kerala-trip-responses.json naming the guest as With Joy spells them.`,
      )
    }
    const guest = owners[0]
    if (matched.has(guest)) {
      throw new Error(
        `Two Kerala responses resolve to the same roster guest (row ${guest.row}, ` +
          `'${response.email}'). Remove the stale one from data/kerala-trip-responses.json.`,
      )
    }
    matched.set(guest, response)
  }

  const rooms = new Map()
  for (const [guest, response] of matched) {
    const occupants = rooms.get(response.room)
    if (occupants) occupants.push(guest)
    else rooms.set(response.room, [guest])
  }
  for (const [room, occupants] of rooms) {
    if (occupants.length > 2) {
      throw new Error(
        `Kerala room ${room} has ${occupants.length} occupants — rooms hold at most two. ` +
          `Fix the room numbers in data/kerala-trip-responses.json.`,
      )
    }
    if (occupants.length === 1 && matched.get(occupants[0]).occupancy === 'double') {
      throw new Error(
        `Kerala room ${room} has a lone double-occupancy respondent ('${
          matched.get(occupants[0]).email
        }'). Pair them with a roommate, or mark them single.`,
      )
    }
    // The bed is a property of the room, stored per person because that is the
    // shape of the form export. Roommates who disagree describe a room that
    // cannot be booked, and the count sent to the agent would be off by one
    // whichever of the two it believed.
    if (occupants.length === 2) {
      const [first, second] = occupants.map((occupant) => matched.get(occupant))
      if (first.bed !== second.bed) {
        throw new Error(
          `Kerala room ${room} is '${first.bed}' for '${first.email}' but '${second.bed}' for ` +
            `'${second.email}' — roommates share one bed type. Fix data/kerala-trip-responses.json.`,
        )
      }
    }
    // A guest whose share went in with their roommate's payment needs that
    // roommate to have actually paid. Unchecked, a mistyped one reads as a
    // guest who has settled when nobody has sent anything for them.
    for (const occupant of occupants) {
      const response = matched.get(occupant)
      if (response.payment?.via !== 'roommate') continue
      const payer = occupants
        .filter((other) => other !== occupant)
        .map((other) => matched.get(other))
        .find((other) => other.payment?.usd !== undefined)
      if (!payer) {
        throw new Error(
          `Kerala payment for '${response.email}' says a roommate covered it, but nobody in ` +
            `room ${room} has a payment with an amount. Fix data/kerala-trip-responses.json.`,
        )
      }
    }
  }

  const payloads = new Map()
  for (const [guest, response] of matched) {
    payloads.set(guest, {
      trip: response.trip,
      flight: response.flight,
      occupancy: response.occupancy,
      roommates: rooms
        .get(response.room)
        .filter((occupant) => occupant !== guest)
        .map((occupant) => `${occupant.firstName} ${occupant.lastName}`.trim()),
      ...(response.priceOverride !== undefined ? { priceOverride: response.priceOverride } : {}),
      // Goes to the guest as well as to the admin page: it changes the figure
      // they are being asked for, so their own card has to know about it.
      ...(response.hostCovers !== undefined ? { hostCovers: response.hostCovers } : {}),
      ...(response.priceNote ? { priceNote: response.priceNote } : {}),
    })
  }

  // The same rooms again, this time whole rather than sliced per guest, for
  // /admin/kerala-trip. Built here rather than in a second pass of its own
  // because everything it needs — the email-to-guest join, the room grouping,
  // the validation that both survived — has already happened above.
  const adminRooms = [...rooms.entries()]
    .sort(([a], [b]) => a - b)
    .map(([room, occupants]) => ({
      room,
      ...(matched.get(occupants[0]).bed !== undefined
        ? { bed: matched.get(occupants[0]).bed }
        : {}),
      occupants: occupants.map((occupant) => {
        const response = matched.get(occupant)
        // Who covered them, when their share went in with a roommate's payment.
        // Resolved here rather than on the page, which has only the room and
        // would have to work the pairing out a second time.
        const payer =
          response.payment?.via === 'roommate'
            ? occupants.find(
                (other) => other !== occupant && matched.get(other).payment?.usd !== undefined,
              )
            : undefined
        return {
          name: response.displayName ?? `${occupant.firstName} ${occupant.lastName}`.trim(),
          trip: response.trip,
          flight: response.flight,
          occupancy: response.occupancy,
          ...(response.priceOverride !== undefined
            ? { priceOverride: response.priceOverride }
            : {}),
          // The one field above this line that is also in the guest's envelope:
          // the billing summary needs it to work out what we are covering, and
          // the guest needs it to see the right price.
          ...(response.hostCovers !== undefined ? { hostCovers: response.hostCovers } : {}),
          // Admin-side only, all of them. The guest's own envelope carries the
          // price they were asked for and nothing about what we are charged for
          // them, who is paying for whom, or what anyone has sent.
          ...(response.soleUseNights !== undefined
            ? { soleUseNights: response.soleUseNights }
            : {}),
          ...(response.host ? { host: true } : {}),
          ...(response.payment
            ? { payment: { ...response.payment, ...(payer ? { paidBy: payer.firstName } : {}) } }
            : {}),
        }
      }),
    }))

  return { payloads, rooms: adminRooms }
}

/** Builds one record per guest, before collision resolution. */
export function buildGuestRecords(guests, catalogEvents, keralaPayloads = null) {
  // Membership in a party is implicit in a shared `party` string — this is the
  // one place it is materialized, for the disambiguation label and the pooled
  // email verifier.
  const parties = new Map()
  for (const guest of guests) {
    if (!guest.party) continue
    const members = parties.get(guest.party)
    if (members) members.push(guest)
    else parties.set(guest.party, [guest])
  }

  return guests.flatMap((guest) => {
    const aliases = aliasesFor(guest)
    if (aliases.length === 0) return []

    const admin = guest.tags.has(ADMIN_TAG)
    const eventIds = resolveEventIds(guest.tags, catalogEvents)
    // An admin carrying no event tag is still owed a record — otherwise a
    // missing gate on their own row would lock them out of /admin/invite-links.
    if (eventIds.length === 0 && !admin) return []

    const party = guest.party ? (parties.get(guest.party) ?? [guest]) : [guest]
    // Any household address may verify the guest: half the colliding rows have
    // no email of their own but a spouse or parent in the party does.
    const emails = [...new Set(party.flatMap((member) => member.emails ?? []))]

    return [
      {
        row: guest.row,
        aliases,
        eventIds,
        admin,
        displayName: guest.firstName,
        hint: guest.party || '',
        hintLabel: partyHintLabel(guest, party),
        emails,
        kerala: keralaPayloads?.get(guest),
        golkonda: golkondaStay(guest),
      },
    ]
  })
}

/**
 * Encrypts the index.
 *
 * Private event details are encrypted once under a random per-event key, and
 * each guest record carries only the keys for its own events. Inlining full
 * event copy into every guest record instead would push the file past 600 KB
 * for 621 guests.
 */
/**
 * Fingerprints the inputs so an unchanged roster can skip republishing.
 *
 * The index cannot be byte-stable across runs — the salt and every AES-GCM IV
 * must be random, and reusing an IV under the same key would break
 * confidentiality outright. So instead of diffing the output, the generator
 * diffs the input, and the daily sync becomes a no-op commit when nothing
 * about the guest list or the catalog actually changed.
 *
 * INDEX_VERSION is one of the inputs because the *shape* of a record is as
 * load-bearing as its contents: adding a field while the roster sits still
 * leaves this hash identical, and the sync would report 'nothing to publish'
 * and never ship the new field. Bump the version whenever the payload changes.
 */
export async function sourceFingerprint(
  guests,
  catalogEvents,
  keralaResponses = null,
  adminPassphrase = '',
  keralaBilling = null,
) {
  const canonical = JSON.stringify({
    version: INDEX_VERSION,
    guests: guests
      .map((guest) =>
        [
          guest.firstName,
          guest.lastName,
          guest.envelopeName,
          guest.party,
          [...(guest.emails ?? [])].sort(),
          [...guest.tags].sort(),
          // RSVP answers move independently of the tags, and a guest who
          // declines their room has to stop seeing it on /hotels. All four wedding
          // columns are here rather than muhurtham alone, because
          // /admin/guest-summary reads every one of them.
          guest.pellikuthuruRsvp,
          guest.sangeetRsvp,
          guest.muhurthamRsvp,
          guest.receptionRsvp,
          guest.golkondaCoveredAnswer,
          guest.golkondaOwnAnswer,
        ].join(''),
      )
      .sort(),
    catalog: catalogEvents,
    kerala: keralaResponses,
    // Moves on its own, without the roster changing at all: recording a payment
    // is exactly the edit that would otherwise hash identical and never ship.
    keralaBilling,
    // Rotating the passphrase changes no roster input, so without this the
    // fingerprint would match, the sync would report 'nothing to publish', and
    // the old ciphertext would stay live under the old secret — a rotation that
    // appears to work and changes nothing.
    //
    // Hashed rather than joined in verbatim, so the passphrase never reaches a
    // string this function builds. The published sourceHash digests a canonical
    // form containing all 649 guest rows, so it is not an oracle an outsider
    // can run passphrase guesses against.
    adminPassphrase: await sha256Base64(adminPassphrase),
  })
  return sha256Base64(canonical)
}

export async function buildIndex({
  guests,
  catalogEvents,
  iterations = KDF_ITERATIONS,
  adminIterations = ADMIN_KDF_ITERATIONS,
  adminPassphrase,
  sourceHash,
  keralaResponses = null,
  keralaBilling = null,
}) {
  // Not a default, because there is no safe default. An index built with an
  // empty or forgotten passphrase would publish the roster under a key anyone
  // reading this file could derive, and would look exactly like a good one.
  if (!adminPassphrase) {
    throw new Error('buildIndex needs an adminPassphrase — the admin payload has no other key.')
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  // Its own salt, not the guest one: sharing it would let a single precomputed
  // table serve both cracking the passphrase and hashing guest names.
  const adminSalt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))

  const privateEvents = catalogEvents.filter((event) => !event.universal)
  const eventKeys = new Map()
  const events = {}

  for (const event of privateEvents) {
    const raw = crypto.getRandomValues(new Uint8Array(32))
    const key = await importEventKey(raw)
    eventKeys.set(event.id, bytesToBase64(raw))
    events[event.id] = await encryptJson(key, presentableEvent(event))
  }

  const kerala = keralaResponses ? resolveKeralaPayloads(guests, keralaResponses) : null
  const keralaPayloads = kerala?.payloads ?? null

  const records = buildGuestRecords(guests, catalogEvents, keralaPayloads)

  const resolvedRows = new Set(records.map((record) => record.row))
  const unresolvedRows = guests
    .filter((guest) => !resolvedRows.has(guest.row))
    .map((guest) => guest.row)

  // A respondent whose With Joy row resolves to no record (tags stripped, say)
  // would otherwise just quietly never see their personalized page.
  if (keralaPayloads) {
    const attached = records.filter((record) => record.kerala).length
    if (attached !== keralaPayloads.size) {
      const missing = [...keralaPayloads.keys()]
        .filter((guest) => !records.some((record) => record.kerala === keralaPayloads.get(guest)))
        .map((guest) => `row ${guest.row}`)
        .join(', ')
      throw new Error(
        `${keralaPayloads.size - attached} Kerala respondent(s) have no guest record ` +
          `(${missing}) — their With Joy rows resolve to no events. Check their tags.`,
      )
    }
  }

  // Hashed once per record rather than per bucket — records repeat across
  // alias buckets and the hashes depend only on the salt.
  for (const record of records) {
    record.emailHashes = await Promise.all(record.emails.map((email) => emailHash(email, salt)))
  }

  // Group by alias first so collisions are resolved per lookup key.
  const buckets = new Map()
  for (const record of records) {
    for (const alias of record.aliases) {
      const bucket = buckets.get(alias)
      if (bucket) bucket.push(record)
      else buckets.set(alias, [record])
    }
  }

  const guestIndex = {}
  for (const [alias, bucketRecords] of buckets) {
    const resolved = resolveBucket(bucketRecords)
    const key = await deriveGuestKey(alias, salt, iterations)
    const hash = await lookupHash(alias, salt)

    // Unlike hints, labels have no distinctness guarantee from resolveBucket —
    // two solo-party namesakes would both derive '' or matching envelope
    // fallbacks. Ship them only when every label in the bucket can actually
    // tell the guests apart; the UI falls back to the hint otherwise.
    const labels = resolved.map((record) => record.hintLabel)
    const labelsUsable =
      resolved.length > 1 && labels.every(Boolean) && new Set(labels).size === labels.length

    guestIndex[hash] = await Promise.all(
      resolved.map((record) =>
        encryptJson(key, {
          displayName: record.displayName,
          // Only meaningful when a bucket holds more than one record.
          hint: resolved.length > 1 ? record.hint : undefined,
          hintLabel: labelsUsable ? record.hintLabel : undefined,
          // The pooled household verifier; omitted when the party has no
          // emails on file so the client can skip the prompt entirely.
          emailHashes:
            resolved.length > 1 && record.emailHashes.length > 0 ? record.emailHashes : undefined,
          // Omitted rather than false: two guests carry this and 684 records
          // would otherwise each pay for the key. Rides inside the guest's own
          // envelope, so who is an admin is not public either.
          admin: record.admin || undefined,
          // The guest's own Kerala trip choices, roommate names included —
          // omitted for the hundreds of records that have none, and readable
          // only by whoever can derive this record's key.
          kerala: record.kerala || undefined,
          // Omitted for the 556 records with no room held, like `admin`. The
          // three roster columns behind it stay build-time only — what reaches
          // the browser is this one word, inside the guest's own envelope.
          golkonda: record.golkonda || undefined,
          eventIds: record.eventIds,
          // Positionally aligned with eventIds; null for universal events,
          // whose copy is bundled rather than encrypted. Parallel arrays
          // rather than an id-keyed object so event ids aren't repeated a
          // second time in every one of the 684 lookup records.
          keys: record.eventIds.map((id) => eventKeys.get(id) ?? null),
        }),
      ),
    )
  }

  // Built from `guests`, not `records`: the latter has already dropped everyone
  // with no event tag, and those are the rows /admin/guest-summary most needs.
  const summary = buildGuestSummary(guests)
  // Rooms whole, plus whatever the agent has been paid. Both are admin-only
  // views of data that already rides in the index per guest; neither adds a
  // reader, because this envelope's key is a GitHub secret rather than a name.
  const keralaTrip = kerala ? { rooms: kerala.rooms, billing: keralaBilling } : undefined
  const adminKey = await importEventKey(
    await deriveAdminKeyBytes(adminPassphrase, adminSalt, adminIterations),
  )

  return {
    index: {
      v: INDEX_VERSION,
      updatedAt: new Date().toISOString(),
      // The next run's plausibility baseline. Published because `guests` below
      // is keyed per alias and so cannot be counted for this, and it discloses
      // nothing that the size of that object does not already imply.
      guestCount: records.length,
      sourceHash,
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations,
        salt: bytesToBase64(salt),
      },
      events,
      guests: guestIndex,
      // What the admin tools read — the /admin/guest-summary roster and the
      // /admin/kerala-trip rooming — under the generated passphrase rather than
      // any guest's name. Unlike everything above it, this envelope is meant to
      // hold: the key exists in a GitHub secret and a local .env, nowhere the
      // public mirror can reach, so guessing a name buys nothing here.
      admin: {
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: adminIterations,
          salt: bytesToBase64(adminSalt),
        },
        payload: await encryptJson(adminKey, { summary, keralaTrip }),
      },
    },
    stats: {
      guests: records.length,
      admins: records.filter((record) => record.admin).length,
      summary: summary.length,
      summaryTagged: Object.fromEntries(
        SUMMARY_TAGS.map((tag) => [tag, summary.filter((entry) => entry.tag === tag).length]),
      ),
      summaryStatus: Object.fromEntries(
        ['attending', 'declined', 'none'].map((status) => [
          status,
          summary.filter((entry) => entry.status === status).length,
        ]),
      ),
      keralaResponses: records.filter((record) => record.kerala).length,
      keralaRooms: kerala?.rooms.length ?? 0,
      // Rooms, not people — the agent books one bed type per room, and this is
      // the number the sync log should let us sanity-check against their reply.
      keralaBeds: Object.fromEntries(
        [...KERALA_BEDS].map((bed) => [
          bed,
          (kerala?.rooms ?? []).filter((room) => room.bed === bed).length,
        ]),
      ),
      golkondaCovered: records.filter((record) => record.golkonda === 'covered').length,
      golkondaOwn: records.filter((record) => record.golkonda === 'own').length,
      // Sheet rows that resolved to no record at all and are absent from the
      // index. Rows rather than a bare count so the failure names where to
      // look; see assertEveryGuestResolves.
      unresolvedRows,
      lookupKeys: Object.keys(guestIndex).length,
      perEvent: Object.fromEntries(
        catalogEvents.map((event) => [
          event.id,
          records.filter((record) => record.eventIds.includes(event.id)).length,
        ]),
      ),
    },
  }
}
