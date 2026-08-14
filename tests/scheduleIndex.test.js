import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

import { readFixture } from '../scripts/lib/roster.js'
import {
  assertAdminTagExists,
  assertEveryGuestResolves,
  assertGatesExist,
  assertGolkondaAnswersRecognized,
  assertGolkondaColumnsExist,
  assertRosterPlausible,
  assertUniversalEventsMatch,
  buildIndex,
  gateMatches,
  golkondaStay,
  resolveBucket,
  resolveEventIds,
  resolveKeralaPayloads,
  sourceFingerprint,
} from '../scripts/lib/scheduleIndex.js'
import { normalizedKey } from '../src/lib/guestName.js'
import {
  base64ToBytes,
  decryptJson,
  deriveGuestKey,
  emailHash,
  importEventKey,
  lookupHash,
} from '../src/lib/guestCrypto.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// Low iterations keep the suite fast; production uses KDF_ITERATIONS.
const TEST_ITERATIONS = 1000

let catalogEvents
let guests
let keralaResponses
let index
let stats

beforeAll(async () => {
  catalogEvents = JSON.parse(
    await readFile(join(root, 'data', 'schedule-events.json'), 'utf-8')
  ).events
  guests = await readFixture(join(root, 'tests', 'fixtures', 'guests.sample.csv'))
  keralaResponses = JSON.parse(
    await readFile(join(root, 'tests', 'fixtures', 'kerala-responses.sample.json'), 'utf-8')
  ).responses
  ;({ index, stats } = await buildIndex({
    guests,
    catalogEvents,
    iterations: TEST_ITERATIONS,
    keralaResponses,
  }))
})

/** Mirrors what the browser does in useGuestSchedule. */
async function lookup(first, last) {
  const key = normalizedKey(first, last)
  const salt = base64ToBytes(index.kdf.salt)
  const bucket = index.guests[await lookupHash(key, salt)]
  if (!bucket) return null
  const cryptoKey = await deriveGuestKey(key, salt, index.kdf.iterations)
  return Promise.all(bucket.map((entry) => decryptJson(cryptoKey, entry)))
}

async function titlesFor(record) {
  const titles = []
  for (let i = 0; i < record.eventIds.length; i += 1) {
    const raw = record.keys[i]
    if (!raw) {
      titles.push(record.eventIds[i])
      continue
    }
    const key = await importEventKey(base64ToBytes(raw))
    titles.push((await decryptJson(key, index.events[record.eventIds[i]])).title)
  }
  return titles
}

/** One decrypted event out of a record, the way the browser opens it. */
async function eventFor(record, eventId) {
  const at = record.eventIds.indexOf(eventId)
  if (at === -1) throw new Error(`record has no '${eventId}'`)
  const key = await importEventKey(base64ToBytes(record.keys[at]))
  return decryptJson(key, index.events[eventId])
}

describe('gate resolution', () => {
  it('matches a single tag', () => {
    expect(gateMatches('sangeet', new Set(['sangeet']))).toBe(true)
    expect(gateMatches('sangeet', new Set(['reception']))).toBe(false)
  })

  it('treats an array gate as any-of', () => {
    const gate = ['hotel-golkonda-covered', 'hotel-golkonda-own']
    expect(gateMatches(gate, new Set(['hotel-golkonda-own']))).toBe(true)
    expect(gateMatches(gate, new Set(['hotel-golkonda-covered']))).toBe(true)
    expect(gateMatches(gate, new Set(['reception']))).toBe(false)
  })

  it('gives either Golkonda tag the same four hotel events', () => {
    const covered = resolveEventIds(new Set(['hotel-golkonda-covered']), catalogEvents)
    const own = resolveEventIds(new Set(['hotel-golkonda-own']), catalogEvents)
    expect(covered).toEqual(own)
    expect(covered).toEqual(['check-in', 'high-tea', 'farewell-breakfast', 'checkout'])
  })

  it('gives a guest with no hotel tag none of them', () => {
    expect(resolveEventIds(new Set(['muhurtam']), catalogEvents)).toEqual(['muhurtham', 'lunch'])
  })

  it('maps the sangeet tag to the Edurukolu evening', () => {
    expect(resolveEventIds(new Set(['sangeet']), catalogEvents)).toEqual(['welcome-edurukolu'])
  })
})

describe('golkonda stay', () => {
  const guest = (overrides) => ({
    row: 7,
    tags: new Set(['hotel-golkonda-own']),
    muhurthamRsvp: 'Attending',
    golkondaCoveredAnswer: '',
    golkondaOwnAnswer: "I'll be staying at Golkonda Resort.",
    ...overrides,
  })

  it('resolves each tag to its own value', () => {
    expect(golkondaStay(guest())).toBe('own')
    expect(
      golkondaStay(
        guest({
          tags: new Set(['hotel-golkonda-covered']),
          golkondaCoveredAnswer: "I'll be staying at Golkonda Resort.",
          golkondaOwnAnswer: '',
        })
      )
    ).toBe('covered')
  })

  it('counts the undecided as taking the room', () => {
    // They are all staying at Golkonda; the card is the pricing they asked for.
    const undecided =
      "I'd love to learn more about the accommodations and pricing before I make a decision."
    expect(golkondaStay(guest({ golkondaOwnAnswer: undecided }))).toBe('own')
  })

  it('drops a guest who declined the room', () => {
    expect(golkondaStay(guest({ golkondaOwnAnswer: 'I do not need accommodation.' }))).toBeUndefined()
    expect(
      golkondaStay(guest({ golkondaOwnAnswer: "I'll be arranging my own accommodation separately." }))
    ).toBeUndefined()
  })

  it('drops a guest who has not RSVPd yes to the wedding', () => {
    // 34 of the 86 own-tagged guests are in this state, so the tag alone would
    // tell a third of them about a room they are not coming to use.
    expect(golkondaStay(guest({ muhurthamRsvp: 'Not Attending' }))).toBeUndefined()
    expect(golkondaStay(guest({ muhurthamRsvp: '' }))).toBeUndefined()
  })

  it('drops a guest who answered but carries no tag', () => {
    expect(golkondaStay(guest({ tags: new Set(['muhurtam']) }))).toBeUndefined()
  })

  it('refuses a guest carrying both tags, who cannot be priced', () => {
    expect(() =>
      golkondaStay(guest({ tags: new Set(['hotel-golkonda-covered', 'hotel-golkonda-own']) }))
    ).toThrow(/both Golkonda tags/)
  })

  it('resolves the fixture the way the live roster resolves', () => {
    const by = (first) => guests.find((g) => g.firstName === first)
    expect(golkondaStay(by('Alan'))).toBe('covered')
    expect(golkondaStay(by('Hedy'))).toBe('own')
    expect(golkondaStay(by('Katherine'))).toBeUndefined()
    expect(golkondaStay(by('Barbara'))).toBeUndefined()
    expect(golkondaStay(by('Lise'))).toBeUndefined()
    expect(golkondaStay(by('Chien-Shiung'))).toBeUndefined()
  })

  it('rejects an answer this generator does not know', () => {
    // The gate turns on four exact strings; a reworded one would otherwise
    // match nobody and take the whole feature dark without a word.
    expect(() =>
      assertGolkondaAnswersRecognized([guest({ golkondaOwnAnswer: 'Sure, sounds lovely' })])
    ).toThrow(/does not recognize/)
    expect(() => assertGolkondaAnswersRecognized(guests)).not.toThrow()
  })

  it('rejects a roster missing the RSVP columns altogether', () => {
    expect(() => assertGolkondaColumnsExist([guest({ muhurthamRsvp: undefined })])).toThrow(
      /muhurthamRsvp/
    )
    expect(() => assertGolkondaColumnsExist(guests)).not.toThrow()
  })
})

describe('collision handling', () => {
  const record = (row, eventIds, hint, admin = false) => ({
    row,
    eventIds,
    hint,
    admin,
    aliases: [],
    displayName: 'x',
  })

  it('collapses guests whose invite sets are identical', () => {
    const resolved = resolveBucket([
      record(1, ['muhurtham', 'reception'], 'Doe'),
      record(2, ['reception', 'muhurtham'], 'Doe'),
    ])
    expect(resolved).toHaveLength(1)
  })

  it('keeps both when invite sets differ and hints distinguish them', () => {
    const resolved = resolveBucket([
      record(1, ['muhurtham'], 'Smith Family'),
      record(2, ['muhurtham', 'reception'], 'Smith Household'),
    ])
    expect(resolved).toHaveLength(2)
  })

  it('refuses to publish when differing guests cannot be told apart', () => {
    // Silently serving one of these guests the other's schedule is the exact
    // failure this build check exists to prevent.
    expect(() =>
      resolveBucket([record(1, ['muhurtham'], ''), record(2, ['muhurtham', 'reception'], '')])
    ).toThrow(/distinguishing household hint/)

    expect(() =>
      resolveBucket([record(1, ['muhurtham'], 'Same'), record(2, ['reception'], 'Same')])
    ).toThrow(/distinguishing household hint/)
  })

  it('keeps an admin apart from a namesake with the same events', () => {
    // Collapsing these would hand one of the two the other's /invites/links.
    const resolved = resolveBucket([
      record(1, ['muhurtham'], 'Admin Household', true),
      record(2, ['muhurtham'], 'Other Household'),
    ])
    expect(resolved).toHaveLength(2)
  })

  it('keeps namesakes apart when only who pays for the room differs', () => {
    // The four hotel events are gated on both tags, so these two have identical
    // event lists. Collapsing them would quote one of them the other's price.
    const resolved = resolveBucket([
      { ...record(1, ['check-in'], 'Covered Household'), golkonda: 'covered' },
      { ...record(2, ['check-in'], 'Paying Household'), golkonda: 'own' },
    ])
    expect(resolved).toHaveLength(2)
  })
})

describe('build-time guards', () => {
  it('only lets the style guide name events that exist', async () => {
    // Each outfit on /what-to-wear lists the events it suits, by id. A typo
    // renders no chip and fails nothing — the card just quietly stops saying
    // when to wear the thing. Checked here because this file has the catalog
    // open; src/ deliberately never reads data/schedule-events.json.
    const { mensOutfits, womensOutfits } = await import('../src/data/attire.ts')
    const ids = new Set(catalogEvents.map((event) => event.id))

    for (const outfit of [...mensOutfits, ...womensOutfits]) {
      for (const id of outfit.events) {
        expect(ids.has(id), `outfit '${outfit.slug}' names '${id}', which is not an event`).toBe(
          true
        )
      }
    }
  })

  it('rejects an event gated on a tag the export does not have', () => {
    expect(() => assertGatesExist([{ id: 'x', gate: 'nope' }], new Set(['muhurtam']))).toThrow(
      /does not exist in the export/
    )
  })

  it('rejects universal copy that has drifted from the bundled module', () => {
    expect(() =>
      assertUniversalEventsMatch(
        [{ id: 'muhurtham', universal: true, title: 'Renamed Ceremony' }],
        "export const universalEvents = [{ id: 'muhurtham', title: 'Wedding Ceremony' }]"
      )
    ).toThrow(/missing from src\/data\/scheduleEvents.ts/)
  })

  // These two were off the guard's field list once. The failure is silent and
  // one-sided: the dress code gets rewritten here, and every visitor who hasn't
  // identified themselves goes on reading the old one out of the bundle.
  it('rejects a universal dress code that has drifted', () => {
    expect(() =>
      assertUniversalEventsMatch(
        [{ id: 'muhurtham', universal: true, attire: 'Saris and kurtas, newly reworded' }],
        "export const universalEvents = [{ id: 'muhurtham', attire: 'Saris and kurtas' }]"
      )
    ).toThrow(/has a attire in data\/schedule-events.json/)
  })

  it('rejects universal Indian-wear notes that have drifted', () => {
    expect(() =>
      assertUniversalEventsMatch(
        [
          {
            id: 'muhurtham',
            universal: true,
            indianWear: { women: 'Bright saris', men: 'A white kurta and pancha' },
          },
        ],
        "export const universalEvents = [{ id: 'muhurtham', indianWear: { women: 'Bright saris', men: 'A white kurta' } }]"
      )
    ).toThrow(/indianWear\.men/)
  })

  it('accepts universal copy that matches', async () => {
    const bundled = await readFile(join(root, 'src', 'data', 'scheduleEvents.ts'), 'utf-8')
    expect(() => assertUniversalEventsMatch(catalogEvents, bundled)).not.toThrow()
  })

  it('rejects an export with no admin tag', () => {
    // No event is gated on it, so assertGatesExist never looks — and losing the
    // tag would just quietly make /invites/links unreachable.
    expect(() => assertAdminTagExists(new Set(['muhurtam', 'reception']))).toThrow(
      /'admin' tag does not exist/
    )
    expect(() => assertAdminTagExists(new Set(['muhurtam', 'admin']))).not.toThrow()
  })

  it('refuses an empty roster or a suspicious drop', () => {
    expect(() => assertRosterPlausible(0, 100)).toThrow(/zero guests/)
    expect(() => assertRosterPlausible(50, 100)).toThrow(/>10%/)
    expect(() => assertRosterPlausible(95, 100)).not.toThrow()
  })

  it('publishes a guest count for the next run to compare against', () => {
    // The whole point of the field: `guests` is keyed per alias, so it cannot
    // stand in for the roster size. A sync that counted those keys instead
    // compared 648 guests against 721 lookup keys and stalled for a day.
    expect(index.guestCount).toBe(stats.guests)
    expect(Object.keys(index.guests).length).toBeGreaterThan(index.guestCount)
    expect(() => assertRosterPlausible(stats.guests, index.guestCount)).not.toThrow()
    expect(() => assertRosterPlausible(648, 721)).toThrow(/>10%/)
  })

  it('refuses to publish while a guest carries no gating tag', () => {
    // Row 18 is the fixture's Tagless Guest, who resolves to no record at all.
    expect(stats.unresolvedRows).toEqual([18])
    expect(() => assertEveryGuestResolves(stats.unresolvedRows)).toThrow(/sheet row\(s\) 18/)
    expect(() => assertEveryGuestResolves([12, 40])).toThrow(/2 guest\(s\).*row\(s\) 12, 40/s)
    expect(() => assertEveryGuestResolves([])).not.toThrow()
  })
})

describe('encrypted index round trip', () => {
  it('returns a guest their full schedule', async () => {
    const [alan] = await lookup('Alan', 'Turing')
    expect(await titlesFor(alan)).toEqual([
      'Pellikuthuru (Making of the Bride)',
      'Check-in',
      'High Tea',
      'Welcome Celebration & Edurukolu',
      'muhurtham',
      'lunch',
      'Reception & Dinner',
      'Farewell Breakfast',
      'Checkout',
      'Optional weekend trip to Kerala',
    ])
  })

  it('resolves alias spellings', async () => {
    expect(await lookup('Mary', 'Evans')).not.toBeNull()
    expect(await lookup('Ana Sofia', 'Ruiz')).not.toBeNull()
    expect(await lookup('Dr. Emmett', 'Brown')).not.toBeNull()
    expect(await lookup('Prince', '')).not.toBeNull()
  })

  it('returns nothing for an unknown name', async () => {
    expect(await lookup('Nobody', 'Here')).toBeNull()
  })

  it('prompts only for genuinely ambiguous names', async () => {
    expect(await lookup('Jane', 'Doe')).toHaveLength(1)

    const smiths = await lookup('John', 'Smith')
    expect(smiths).toHaveLength(2)
    expect(smiths.map((record) => record.hint).sort()).toEqual([
      'Smith Family',
      'Smith Household',
    ])
    expect(smiths[0].eventIds).not.toEqual(smiths[1].eventIds)
  })

  it('labels ambiguous guests by their party mates, not the party string', async () => {
    const smiths = await lookup('John', 'Smith')
    expect(smiths.map((record) => record.hintLabel).sort()).toEqual([
      'With Mary Smith',
      'With Peter Smith',
    ])

    // Single-record buckets need no label; the field would be dead weight.
    const [jane] = await lookup('Jane', 'Doe')
    expect(jane.hintLabel).toBeUndefined()
    expect(jane.emailHashes).toBeUndefined()
  })

  it('pools email verifiers across the whole party', async () => {
    const salt = base64ToBytes(index.kdf.salt)
    const smiths = await lookup('John', 'Smith')
    const family = smiths.find((record) => record.hint === 'Smith Family')
    const household = smiths.find((record) => record.hint === 'Smith Household')

    // John-Family has no email of his own; Mary's covers him. Her cell is
    // uppercase in the fixture, so this also pins the lowercase round trip.
    expect(family.emailHashes).toEqual([await emailHash('mary@example.com', salt)])
    expect(household.emailHashes).toEqual([
      await emailHash('john.h@example.com', salt),
      await emailHash('jsmith@example.org', salt),
    ])
  })

  it('ships no email hashes or labels when a bucket has neither to offer', async () => {
    // The Prayagas: solo parties, no emails anywhere — the client should skip
    // the email prompt and the label falls back to the party hint.
    const prayagas = await lookup('Ram', 'Prayaga')
    expect(prayagas).toHaveLength(2)
    for (const record of prayagas) {
      expect(record.emailHashes).toBeUndefined()
      expect(record.hintLabel).toBeUndefined()
    }
    expect(prayagas.map((record) => record.hint).sort()).toEqual([
      'Prayaga North',
      'Prayaga South',
    ])
  })

  it('republishes when only an email changes', async () => {
    const before = await sourceFingerprint(guests, catalogEvents)
    const edited = guests.map((guest) =>
      guest.firstName === 'Grace' ? { ...guest, emails: ['grace@example.com'] } : guest
    )
    expect(await sourceFingerprint(edited, catalogEvents)).not.toBe(before)
  })

  it('republishes when an RSVP answer changes but the tags do not', async () => {
    // The tags are what the old fingerprint watched. A guest declining their
    // room moves none of them, so without this the change would never ship.
    const before = await sourceFingerprint(guests, catalogEvents)
    const declined = guests.map((guest) =>
      guest.firstName === 'Hedy'
        ? { ...guest, golkondaOwnAnswer: 'I do not need accommodation.' }
        : guest
    )
    expect(await sourceFingerprint(declined, catalogEvents)).not.toBe(before)

    const withdrawn = guests.map((guest) =>
      guest.firstName === 'Alan' ? { ...guest, muhurthamRsvp: 'Not Attending' } : guest
    )
    expect(await sourceFingerprint(withdrawn, catalogEvents)).not.toBe(before)
  })

  it('cannot be decrypted with the wrong name', async () => {
    const salt = base64ToBytes(index.kdf.salt)
    const target = index.guests[await lookupHash(normalizedKey('Alan', 'Turing'), salt)][0]
    const wrongKey = await deriveGuestKey(
      normalizedKey('Wrong', 'Person'),
      salt,
      index.kdf.iterations
    )
    expect(await decryptJson(wrongKey, target)).toBeNull()
  })

  it('marks admins, and only admins', async () => {
    const [alan] = await lookup('Alan', 'Turing')
    expect(alan.admin).toBe(true)

    const [ada] = await lookup('Ada', 'Lovelace')
    // Omitted rather than stored as false, so 684 records don't each pay for
    // the key — the browser reads a missing value as "not an admin".
    expect(ada.admin).toBeUndefined()

    expect(stats.admins).toBe(2)
  })

  it('keeps an admin who is invited to nothing', async () => {
    // The events are what normally earn a guest a record. An admin with no
    // gating tag would otherwise be locked out of the page they administer.
    const [record] = await lookup('Admin', 'Withoutevents')
    expect(record.admin).toBe(true)
    expect(record.eventIds).toEqual([])
  })

  it('omits guests who carry no gating tag', async () => {
    // Invited to nothing, so there is no record to serve and the guest falls
    // to the not-found path. The generator warns about these separately.
    expect(await lookup('Tagless', 'Guest')).toBeNull()
  })

  it('carries the golkonda stay for the guests who have a room', async () => {
    const [alan] = await lookup('Alan', 'Turing')
    expect(alan.golkonda).toBe('covered')

    const [hedy] = await lookup('Hedy', 'Lamarr')
    expect(hedy.golkonda).toBe('own')

    expect(stats.golkondaCovered).toBe(1)
    expect(stats.golkondaOwn).toBe(1)
  })

  it('leaves the tagged-but-not-coming with the events and no room', async () => {
    // Barbara still has the four hotel events — they are gated on the tag — but
    // /hotels must look no different to her than to a stranger.
    const [barbara] = await lookup('Barbara', 'McClintock')
    expect(barbara.eventIds).toContain('check-in')
    expect(barbara.golkonda).toBeUndefined()

    const [ada] = await lookup('Ada', 'Lovelace')
    expect(ada.golkonda).toBeUndefined()
  })
})

describe('kerala payload', () => {
  const rosterGuest = (row, firstName, lastName, emails) => ({
    row,
    firstName,
    lastName,
    emails,
    tags: new Set(['optional-trip']),
  })
  const response = (email, overrides = {}) => ({
    email,
    trip: 'full',
    flight: 'rt',
    occupancy: 'double',
    room: 1,
    ...overrides,
  })

  it('rides the encrypted record with roster-named roommates', async () => {
    // Vera's fixture email is uppercased; matching must not care. Her roommate
    // is fully named from Carl's With Joy row — a first name alone is
    // ambiguous in a family-sized guest list — not from anything in the form.
    const [vera] = await lookup('Vera', 'Rubin')
    expect(vera.kerala).toEqual({
      trip: 'full',
      flight: 'rt',
      occupancy: 'double',
      roommates: ['Carl Sagan'],
      priceOverride: 67440,
      priceNote: 'Carl heads home a night early, so your last night is single occupancy.',
    })

    const [carl] = await lookup('Carl', 'Sagan')
    expect(carl.kerala).toEqual({
      trip: 'short',
      flight: 'ow',
      occupancy: 'double',
      roommates: ['Vera Rubin'],
    })
    expect(stats.keralaResponses).toBe(3)
  })

  it('gives a single-occupancy respondent no roommates', async () => {
    const [enrico] = await lookup('Enrico', 'Fermi')
    expect(enrico.kerala).toEqual({
      trip: 'full',
      flight: 'ow',
      occupancy: 'single',
      roommates: [],
    })
  })

  it('leaves invited guests without a response untouched', async () => {
    // Alan carries the optional-trip tag but never filled out the trip form.
    const [alan] = await lookup('Alan', 'Turing')
    expect(alan.kerala).toBeUndefined()
  })

  it('refuses an email that matches no roster guest', () => {
    expect(() =>
      resolveKeralaPayloads(
        [rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com'])],
        [response('stranger@example.com', { occupancy: 'single' })]
      )
    ).toThrow(/stranger@example.com.*matches no roster guest/)
  })

  it('refuses a household email shared by two roster rows', () => {
    // The payload is personal — a pooled address cannot say whose trip it is.
    expect(() =>
      resolveKeralaPayloads(
        [
          rosterGuest(1, 'Vera', 'Rubin', ['shared@example.com']),
          rosterGuest(2, 'Carl', 'Sagan', ['shared@example.com']),
        ],
        [response('shared@example.com', { occupancy: 'single' })]
      )
    ).toThrow(/matches 2 roster guests \(row 1, row 2\)/)
  })

  it('lets a name settle a shared email, the plus-one placeholder shape', () => {
    // With Joy gives an unnamed plus-one row the invitee's own email, so the
    // real guest's response has to be able to say which row is theirs.
    const roster = [
      rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
      rosterGuest(2, "Vera's Guest", '', ['vera@example.com']),
    ]
    const payloads = resolveKeralaPayloads(roster, [
      response('vera@example.com', { occupancy: 'single', name: 'Vera Rubin' }),
    ])
    expect(payloads.get(roster[0])).toBeDefined()
    expect(payloads.get(roster[1])).toBeUndefined()

    expect(() =>
      resolveKeralaPayloads(roster, [
        response('vera@example.com', { occupancy: 'single', name: 'Someone Else' }),
      ])
    ).toThrow(/names 'Someone Else', but no roster guest/)
  })

  it('refuses two responses that resolve to one guest', () => {
    expect(() =>
      resolveKeralaPayloads(
        [rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com', 'vr@example.org'])],
        [
          response('vera@example.com', { occupancy: 'single' }),
          response('vr@example.org', { occupancy: 'single', room: 2 }),
        ]
      )
    ).toThrow(/Two Kerala responses resolve to the same roster guest/)
  })

  it('refuses implausible rooms', () => {
    const roster = [
      rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
      rosterGuest(2, 'Carl', 'Sagan', ['carl@example.com']),
      rosterGuest(3, 'Enrico', 'Fermi', ['enrico@example.com']),
    ]
    // A double-occupancy respondent alone in a room is the pre-correction
    // spreadsheet mistake this exists to catch.
    expect(() =>
      resolveKeralaPayloads(roster, [response('vera@example.com')])
    ).toThrow(/lone double-occupancy respondent/)
    expect(() =>
      resolveKeralaPayloads(roster, [
        response('vera@example.com'),
        response('carl@example.com'),
        response('enrico@example.com'),
      ])
    ).toThrow(/3 occupants/)
  })

  it('lets a pending roommate hold a double room alone', () => {
    // Someone whose roommate has not RSVPd yet is knowingly booked double and
    // quoted the double rate — the guest sees no roommate rather than a name.
    const roster = [rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com'])]
    const payloads = resolveKeralaPayloads(roster, [
      response('vera@example.com', { roommatePending: true }),
    ])
    expect(payloads.get(roster[0])).toEqual({
      trip: 'full',
      flight: 'rt',
      occupancy: 'double',
      roommates: [],
    })
  })

  it('refuses malformed response fields', () => {
    expect(() =>
      resolveKeralaPayloads(
        [rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com'])],
        [response('vera@example.com', { trip: 'medium', occupancy: 'single' })]
      )
    ).toThrow(/invalid fields/)

    expect(() =>
      resolveKeralaPayloads(
        [rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com'])],
        [response('vera@example.com', { occupancy: 'single', priceOverride: -5 })]
      )
    ).toThrow(/invalid fields/)

    expect(() =>
      resolveKeralaPayloads(
        [rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com'])],
        [response('vera@example.com', { occupancy: 'single', roommatePending: 'yes' })]
      )
    ).toThrow(/invalid fields/)
  })

  it('keeps namesakes apart when only their trip data differs', () => {
    // Collapsing these would serve one namesake the other's price, roommate
    // and itinerary.
    const record = (row, hint, kerala) => ({
      row,
      eventIds: ['kerala'],
      hint,
      admin: false,
      aliases: [],
      displayName: 'x',
      kerala,
    })
    const trip = { trip: 'full', flight: 'rt', occupancy: 'double', roommates: ['Carl'] }
    expect(
      resolveBucket([record(1, 'North', trip), record(2, 'South', undefined)])
    ).toHaveLength(2)
    expect(
      resolveBucket([record(1, 'North', trip), record(2, 'South', { ...trip })])
    ).toHaveLength(1)
  })

  it('republishes when a response changes', async () => {
    const before = await sourceFingerprint(guests, catalogEvents, keralaResponses)
    expect(await sourceFingerprint(guests, catalogEvents, null)).not.toBe(before)

    const edited = keralaResponses.map((entry) =>
      entry.email === 'carl.sagan@example.com' ? { ...entry, flight: 'rt' } : entry
    )
    expect(await sourceFingerprint(guests, catalogEvents, edited)).not.toBe(before)
    expect(
      await sourceFingerprint(
        guests,
        catalogEvents,
        keralaResponses.map((entry) => ({ ...entry }))
      )
    ).toBe(before)
  })
})

describe('privacy invariants', () => {
  it('contains no guest name in plaintext', () => {
    const serialized = JSON.stringify(index)
    // Names shorter than 5 characters are skipped deliberately: the index is
    // mostly base64, where a 3-letter run like 'Not' is overwhelmingly likely
    // to appear by chance, making the assertion flaky rather than meaningful.
    const names = guests
      .flatMap((guest) => [guest.firstName, guest.lastName])
      .filter((name) => name && name.length >= 5)

    expect(names.length).toBeGreaterThan(5)
    for (const name of names) {
      expect(serialized).not.toContain(name)
    }
  })

  it('contains no private event detail in plaintext', () => {
    const serialized = JSON.stringify(index)
    expect(serialized).not.toContain('Mada Manzil')
    expect(serialized).not.toContain('Pellikuthuru (Making of the Bride)')
    expect(serialized).not.toContain('Welcome Celebration')
  })

  it('contains no kerala response detail in plaintext', () => {
    // The build-time join key (email) and the payload itself must ride only
    // inside encrypted envelopes.
    const serialized = JSON.stringify(index)
    for (const entry of keralaResponses) {
      expect(serialized.toLowerCase()).not.toContain(entry.email.toLowerCase())
    }
    expect(serialized).not.toContain('roommates')
    expect(serialized).not.toContain('priceNote')
  })

  it('contains no golkonda answer or stay in plaintext', () => {
    // Who is having their room paid for is exactly as private as who is on the
    // Kerala trip, and the RSVP answers behind it never leave the generator.
    const serialized = JSON.stringify(index)
    expect(serialized).not.toContain('golkonda')
    expect(serialized).not.toContain('Golkonda Resort')
    expect(serialized).not.toContain('accommodation')
  })

  it('does not encrypt the universal events, which are bundled instead', () => {
    expect(Object.keys(index.events)).not.toContain('muhurtham')
    expect(Object.keys(index.events)).not.toContain('lunch')
  })

  it('carries the Indian-wear notes through to the guest, and only to them', async () => {
    // The field is optional and RENDERED_FIELDS decides what survives the trip.
    // Left off that list it vanishes silently: the page renders, the section is
    // simply missing, and nothing fails.
    const [alan] = await lookup('Alan', 'Turing')
    const pellikuthuru = await eventFor(alan, 'pellikuthuru')

    expect(pellikuthuru.indianWear).toBeDefined()
    expect(pellikuthuru.indianWear.women).toMatch(/saris/i)
    expect(pellikuthuru.indianWear.men).toMatch(/kurta/i)

    // And it is genuinely behind the encryption, like the rest of the event.
    expect(JSON.stringify(index)).not.toContain(pellikuthuru.indianWear.women)
  })
})
