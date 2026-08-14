import { aliasesFor, fold } from '../../src/lib/guestName.js'
import { partyHintLabel } from './partyLabel.js'
import {
  KDF_ITERATIONS,
  SALT_BYTES,
  bytesToBase64,
  deriveGuestKey,
  emailHash,
  encryptJson,
  importEventKey,
  lookupHash,
} from '../../src/lib/guestCrypto.js'

// Bumped to 2 when the guest record gained `golkonda`, to 3 when events gained
// `indianWear`, and to 4 when the index gained `guestCount`. Feeds
// sourceFingerprint, so bumping it is what makes a shape change actually
// republish.
export const INDEX_VERSION = 4

/**
 * The With Joy tag that admits a guest to the unlinked /invites/links page.
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

const MUHURTHAM_ATTENDING = 'Attending'

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
        `room is covered or their own. Clear one in With Joy.`
    )
  }
  if (held.length === 0) return undefined
  if (guest.muhurthamRsvp !== MUHURTHAM_ATTENDING) return undefined
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
        `at Golkonda and /hotels would silently lose its personalization. Check the sheet.`
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
          `taking the room.`
      )
    }
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
        `served each other's schedules.`
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
        `guests see before they identify themselves.`
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
            `Known tags: ${[...knownTags].sort().join(', ')}`
        )
      }
    }
  }
}

/**
 * No event is gated on the admin tag, so `assertGatesExist` never looks at it —
 * and a tag renamed or dropped in With Joy would otherwise just mean nobody can
 * open /invites/links, with nothing in the sync output saying why.
 */
export function assertAdminTagExists(knownTags) {
  if (!knownTags.has(ADMIN_TAG)) {
    throw new Error(
      `The '${ADMIN_TAG}' tag does not exist in the export, so /invites/links would be ` +
        `unreachable. Known tags: ${[...knownTags].sort().join(', ')}`
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
        `publish in case the export is broken; re-run with --force if this is real.`
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
      `them. Tag them in With Joy, or re-run with --force to publish without them.`
  )
}

const KERALA_TRIPS = new Set(['full', 'short'])
const KERALA_FLIGHTS = new Set(['rt', 'ow'])
const KERALA_OCCUPANCIES = new Set(['single', 'double'])

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
    const { email, trip, flight, occupancy, room } = response
    if (
      !KERALA_TRIPS.has(trip) ||
      !KERALA_FLIGHTS.has(flight) ||
      !KERALA_OCCUPANCIES.has(occupancy) ||
      !Number.isInteger(room) ||
      (response.priceOverride !== undefined &&
        !(Number.isFinite(response.priceOverride) && response.priceOverride > 0)) ||
      (response.roommatePending !== undefined && typeof response.roommatePending !== 'boolean')
    ) {
      throw new Error(
        `Kerala response for '${email}' has invalid fields (trip=${trip}, flight=${flight}, ` +
          `occupancy=${occupancy}, room=${room}). Fix data/kerala-trip-responses.json.`
      )
    }
    let owners = byEmail.get(email.trim().toLowerCase()) ?? []
    if (owners.length === 0) {
      throw new Error(
        `Kerala response email '${email}' matches no roster guest. Edit the address in ` +
          `data/kerala-trip-responses.json to the one With Joy has on file for them.`
      )
    }
    // With Joy gives an unnamed plus-one placeholder row the invitee's own
    // email, so a shared address is a real shape, not a typo. A response may
    // carry a `name` naming its owner; anything still ambiguous stays fatal.
    if (owners.length > 1 && response.name) {
      owners = owners.filter(
        (owner) => fold(`${owner.firstName} ${owner.lastName}`.trim()) === fold(response.name)
      )
      if (owners.length === 0) {
        throw new Error(
          `Kerala response '${email}' names '${response.name}', but no roster guest with ` +
            `that email is called that. Fix the name in data/kerala-trip-responses.json.`
        )
      }
    }
    if (owners.length > 1) {
      const rows = owners.map((owner) => `row ${owner.row}`).join(', ')
      throw new Error(
        `Kerala response email '${email}' matches ${owners.length} roster guests (${rows}) — ` +
          `it cannot say whose trip this is. Add a "name" field to the response in ` +
          `data/kerala-trip-responses.json naming the guest as With Joy spells them.`
      )
    }
    const guest = owners[0]
    if (matched.has(guest)) {
      throw new Error(
        `Two Kerala responses resolve to the same roster guest (row ${guest.row}, ` +
          `'${response.email}'). Remove the stale one from data/kerala-trip-responses.json.`
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
          `Fix the room numbers in data/kerala-trip-responses.json.`
      )
    }
    // `roommatePending` is the deliberate exception: someone whose roommate has
    // not RSVPd yet is knowingly booked double and quoted the double rate, and
    // must not be mistaken for the typo this check exists to catch.
    if (
      occupants.length === 1 &&
      matched.get(occupants[0]).occupancy === 'double' &&
      !matched.get(occupants[0]).roommatePending
    ) {
      throw new Error(
        `Kerala room ${room} has a lone double-occupancy respondent ('${
          matched.get(occupants[0]).email
        }'). Pair them with a roommate, mark them single, or set "roommatePending": true.`
      )
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
      ...(response.priceNote ? { priceNote: response.priceNote } : {}),
    })
  }
  return payloads
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
    // missing gate on their own row would lock them out of /invites/links.
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
export async function sourceFingerprint(guests, catalogEvents, keralaResponses = null) {
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
          // declines their room has to stop seeing it on /hotels.
          guest.muhurthamRsvp,
          guest.golkondaCoveredAnswer,
          guest.golkondaOwnAnswer,
        ]
          .join('')
      )
      .sort(),
    catalog: catalogEvents,
    kerala: keralaResponses,
  })
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return bytesToBase64(new Uint8Array(digest))
}

export async function buildIndex({
  guests,
  catalogEvents,
  iterations = KDF_ITERATIONS,
  sourceHash,
  keralaResponses = null,
}) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))

  const privateEvents = catalogEvents.filter((event) => !event.universal)
  const eventKeys = new Map()
  const events = {}

  for (const event of privateEvents) {
    const raw = crypto.getRandomValues(new Uint8Array(32))
    const key = await importEventKey(raw)
    eventKeys.set(event.id, bytesToBase64(raw))
    events[event.id] = await encryptJson(key, presentableEvent(event))
  }

  const keralaPayloads = keralaResponses ? resolveKeralaPayloads(guests, keralaResponses) : null

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
          `(${missing}) — their With Joy rows resolve to no events. Check their tags.`
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
            resolved.length > 1 && record.emailHashes.length > 0
              ? record.emailHashes
              : undefined,
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
        })
      )
    )
  }

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
    },
    stats: {
      guests: records.length,
      admins: records.filter((record) => record.admin).length,
      keralaResponses: records.filter((record) => record.kerala).length,
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
        ])
      ),
    },
  }
}
