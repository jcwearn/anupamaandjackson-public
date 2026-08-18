import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

import { readFixture } from '../scripts/lib/roster.js'
import {
  assertAdminTagExists,
  assertEveryGuestHasAnInvite,
  assertEveryGuestResolves,
  assertGatesExist,
  assertGolkondaAnswersRecognized,
  assertGolkondaColumnsExist,
  assertInviteSideTagsExist,
  assertRosterPlausible,
  assertSummaryRsvpColumnsExist,
  assertSummaryTagsExist,
  assertUniversalEventsMatch,
  buildGuestSummary,
  buildIndex,
  EVENT_ANSWERS,
  gateMatches,
  golkondaStay,
  guestEventAnswers,
  guestSummaryStatus,
  resolveBucket,
  resolveEventIds,
  resolveKeralaPayloads,
  sourceFingerprint,
  summaryAnswersOutsideInvite,
} from '../scripts/lib/scheduleIndex.js'
import { normalizedKey } from '../src/lib/guestName.js'
import {
  base64ToBytes,
  decryptJson,
  deriveAdminKeyBytes,
  deriveGuestKey,
  emailHash,
  importEventKey,
  lookupHash,
} from '../src/lib/guestCrypto.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
// Low iterations keep the suite fast; production uses KDF_ITERATIONS.
const TEST_ITERATIONS = 1000
const TEST_PASSPHRASE = 'correct-horse-battery-staple'

let catalogEvents
let guests
let keralaResponses
let keralaBilling
let index
let stats

beforeAll(async () => {
  catalogEvents = JSON.parse(
    await readFile(join(root, 'data', 'schedule-events.json'), 'utf-8'),
  ).events
  guests = await readFixture(join(root, 'tests', 'fixtures', 'guests.sample.csv'))
  const keralaFile = JSON.parse(
    await readFile(join(root, 'tests', 'fixtures', 'kerala-responses.sample.json'), 'utf-8'),
  )
  keralaResponses = keralaFile.responses
  keralaBilling = keralaFile.billing
  ;({ index, stats } = await buildIndex({
    guests,
    catalogEvents,
    iterations: TEST_ITERATIONS,
    adminIterations: TEST_ITERATIONS,
    adminPassphrase: TEST_PASSPHRASE,
    keralaResponses,
    keralaBilling,
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
        }),
      ),
    ).toBe('covered')
  })

  it('counts the undecided as taking the room', () => {
    // They are all staying at Golkonda; the card is the pricing they asked for.
    const undecided =
      "I'd love to learn more about the accommodations and pricing before I make a decision."
    expect(golkondaStay(guest({ golkondaOwnAnswer: undecided }))).toBe('own')
  })

  it('drops a guest who declined the room', () => {
    expect(
      golkondaStay(guest({ golkondaOwnAnswer: 'I do not need accommodation.' })),
    ).toBeUndefined()
    expect(
      golkondaStay(
        guest({ golkondaOwnAnswer: "I'll be arranging my own accommodation separately." }),
      ),
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
      golkondaStay(guest({ tags: new Set(['hotel-golkonda-covered', 'hotel-golkonda-own']) })),
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
      assertGolkondaAnswersRecognized([guest({ golkondaOwnAnswer: 'Sure, sounds lovely' })]),
    ).toThrow(/does not recognize/)
    expect(() => assertGolkondaAnswersRecognized(guests)).not.toThrow()
  })

  it('rejects a roster missing the RSVP columns altogether', () => {
    expect(() => assertGolkondaColumnsExist([guest({ muhurthamRsvp: undefined })])).toThrow(
      /muhurthamRsvp/,
    )
    expect(() => assertGolkondaColumnsExist(guests)).not.toThrow()
  })
})

describe('guest summary status', () => {
  const guest = (overrides) => ({
    row: 7,
    tags: new Set(),
    pellikuthuruRsvp: '',
    sangeetRsvp: '',
    muhurthamRsvp: '',
    receptionRsvp: '',
    ...overrides,
  })

  it('files a guest who answered nothing under no response', () => {
    // The whole reason the page exists. A blank is an unasked question, not a
    // no, and merging the two would hide everyone still worth chasing.
    expect(guestSummaryStatus(guest())).toBe('none')
  })

  it('files a yes to any one event as attending', () => {
    expect(guestSummaryStatus(guest({ sangeetRsvp: 'Attending' }))).toBe('attending')
    expect(guestSummaryStatus(guest({ receptionRsvp: 'Attending' }))).toBe('attending')
    expect(guestSummaryStatus(guest({ pellikuthuruRsvp: 'Attending' }))).toBe('attending')
  })

  it('lets one yes outweigh any number of nos', () => {
    // Someone coming to the muhurtham and skipping the rest is attending, and
    // filing them anywhere else would have their family chasing them for it.
    expect(
      guestSummaryStatus(
        guest({
          pellikuthuruRsvp: 'Not Attending',
          sangeetRsvp: 'Not Attending',
          muhurthamRsvp: 'Attending',
          receptionRsvp: 'Not Attending',
        }),
      ),
    ).toBe('attending')
  })

  it('files a guest as declined only when every answer given was a no', () => {
    expect(
      guestSummaryStatus(guest({ sangeetRsvp: 'Not Attending', muhurthamRsvp: 'Not Attending' })),
    ).toBe('declined')
    // Partly answered and all nos still counts: they have said no to what they
    // were asked about.
    expect(guestSummaryStatus(guest({ receptionRsvp: 'Not Attending' }))).toBe('declined')
  })

  it('ignores the optional trip, whose third answer is neither', () => {
    // 'I am interested to learn more about the trip' is not a decline, and
    // reading that column would file those guests as one.
    expect(
      guestSummaryStatus(
        guest({ optionalTripRsvp: 'I am interested to learn more about the trip' }),
      ),
    ).toBe('none')
  })
})

describe('guest summary answers per event', () => {
  let summary

  beforeAll(() => {
    summary = buildGuestSummary(guests)
  })

  const named = (name) => summary.find((entry) => entry.name === name)

  it('answers each dot from its own RSVP column', () => {
    // The tag is 'muhurtam' and the column beside it is 'muhurthamRsvp'.
    // Deriving one from the other would leave the middle column unread and turn
    // every guest grey on the one event nearly all of them are coming to.
    expect(EVENT_ANSWERS).toEqual([
      { letter: 'P', field: 'pellikuthuruRsvp' },
      { letter: 'S', field: 'sangeetRsvp' },
      { letter: 'M', field: 'muhurthamRsvp' },
      { letter: 'R', field: 'receptionRsvp' },
    ])
  })

  it("splits a guest's events into the ones they said yes to and the ones they said no", () => {
    // The row the whole change exists for: coming to one of the two events they
    // were invited to, and not to the other.
    expect(named('Mary Ann Evans')).toMatchObject({ events: 'MR', attending: 'M', declined: 'R' })
  })

  it('leaves an event nobody has answered about out of both', () => {
    // Invited to four, answered about one. The other three are not declines,
    // and colouring them as such is the mistake this exists to stop — 'no
    // response' is the answer the page is built to find.
    expect(named('Katherine Johnson')).toMatchObject({ events: 'PSMR', attending: 'M' })
    expect(named('Katherine Johnson').declined).toBeUndefined()
    expect(named('Lise Meitner').attending).toBeUndefined()
    expect(named('Lise Meitner').declined).toBeUndefined()
  })

  it('never claims an answer for an event the guest carries no tag for', () => {
    // The fixture has it both ways round, as the real roster does: a row that
    // declined events it carries no tag for, and rows that said yes to the
    // muhurtham carrying no muhurtam tag at all. The table has one cell per
    // invitation and no cell for either.
    expect(named('Not Coming')).toMatchObject({ events: 'M', declined: 'M' })
    expect(named('Not Coming').attending).toBeUndefined()
    expect(named('Tagless Guest').attending).toBeUndefined()
    expect(named('Tagless Guest').declined).toBeUndefined()
  })

  it('keeps both answers inside `events`, and apart from each other', () => {
    // The invariant the page reads: three subsets of one string, so a dot can
    // never be two colours at once and never a colour for an event nobody was
    // asked about.
    for (const entry of summary) {
      for (const letter of entry.attending ?? '') expect(entry.events).toContain(letter)
      for (const letter of entry.declined ?? '') expect(entry.events).toContain(letter)
      for (const letter of entry.attending ?? '') expect(entry.declined ?? '').not.toContain(letter)
    }
  })

  it('agrees with the whole-guest verdict wherever it can', () => {
    // One direction only. A yes to any event makes the guest attending, but the
    // converse still does not hold, even now that all four verdict columns have
    // a column on the table: an answer about an event the guest carries no tag
    // for counts towards the verdict and is intersected away here, so a guest
    // can be 'attending' above four dots that say otherwise.
    for (const entry of summary) if (entry.attending) expect(entry.status).toBe('attending')
  })

  it('drops a blank rather than reading it as a no', () => {
    // Same reasoning as guestSummaryStatus, one level down, and the reason
    // guestEventAnswers is worth a unit test of its own: a red dot beside a
    // guest who has said nothing is the one thing this page must never draw.
    const guest = { sangeetRsvp: '', muhurthamRsvp: 'Attending', receptionRsvp: 'Not Attending' }
    expect(guestEventAnswers(guest, 'SMR')).toEqual({ attending: 'M', declined: 'R' })
    expect(guestEventAnswers({}, 'SMR')).toEqual({ attending: '', declined: '' })
  })

  it('counts the rows whose answers reach past their tags, without naming them', () => {
    // A warning rather than a failure, because the '… (tag)' columns and With
    // Joy's own per-event lists drift apart in the ordinary course of things.
    // The affirmative rows are the ones worth an afternoon: a yes to an event
    // we do not think is theirs means either a missing tag — so the wrong
    // printed invitation is going out — or a wrong list.
    expect(summaryAnswersOutsideInvite(guests)).toEqual({
      rows: [17, 18, 19, 27],
      affirmativeRows: [18, 19],
    })
  })
})

describe('guest summary roster', () => {
  let summary

  beforeAll(() => {
    summary = buildGuestSummary(guests)
  })

  const named = (name) => summary.find((entry) => entry.name === name)

  it('carries every roster row, including guests with no gating tag', () => {
    // buildGuestRecords drops the tagless row; this must not. Those guests are
    // exactly the ones a 'who has not responded' list is for.
    expect(summary).toHaveLength(guests.length)
    expect(named('Tagless Guest')).toBeDefined()
  })

  it('tags each guest with their side, and leaves the rest untagged', () => {
    expect(named('Ada Lovelace').tag).toBe('vidya')
    expect(named('Grace Hopper').tag).toBe('venkat')
    expect(named('Jane Doe').tag).toBeUndefined()
  })

  it('carries the name, verdict, household and invitation, and nothing else', () => {
    // The page lists names and hands out invitations. Anything more here is
    // guest data shipped for no reason — and this payload leaves the generator.
    // Ada travels alone, so she does not even carry the household id.
    const fields = ['attending', 'events', 'name', 'side', 'status', 'tag']
    expect(Object.keys(named('Ada Lovelace')).sort()).toEqual(fields)
    expect(Object.keys(named('John Smith')).sort()).toEqual([...fields, 'party'].sort())
    expect(Object.keys(named('Jane Doe')).sort()).toEqual([
      'attending',
      'events',
      'name',
      'party',
      'side',
      'status',
    ])
    // Neither answer field on a guest who has answered nothing, which is the
    // commonest row on the real list — and, not by accident, the same shape an
    // index built before the two fields existed has for everyone.
    expect(Object.keys(named('Lise Meitner')).sort()).toEqual([
      'events',
      'name',
      'side',
      'status',
      'tag',
    ])
  })

  it("carries each guest's side and events, which is what names their invitation", () => {
    expect(named('Ada Lovelace')).toMatchObject({ side: 'anupama', events: 'MR' })
    expect(named('Grace Hopper')).toMatchObject({ side: 'anupama', events: 'SMR' })
    // 'PSMR', not 'SMR': `events` is every column on the table, and the
    // pellikuthuru narrows no invitation — his page is still /invites/wearn/.
    expect(named('Alan Turing')).toMatchObject({ side: 'jackson', events: 'PSMR' })
    expect(named('Prince')).toMatchObject({ side: 'anupama', events: 'M' })
  })

  it('leaves the deliberately tagless rows with no side and no events', () => {
    // They are carried, because the page's whole job is surfacing them — they
    // just have no invitation to be given yet.
    expect(named('Tagless Guest').side).toBeUndefined()
    expect(named('Tagless Guest').events).toBe('')
  })

  it('joins a first name with no last name into just the first', () => {
    expect(named('Prince')).toBeDefined()
    expect(named('Prince ')).toBeUndefined()
  })

  it("drops With Joy's '.' placeholder surname instead of printing it", () => {
    // 13 rows on the real roster carry it. Joined naively they read
    // 'Firstname .', and all 13 sort to the head of the list under '.'.
    expect(named('Cleopatra')).toBeDefined()
    expect(named('Cleopatra .')).toBeUndefined()
    expect(summary.map((entry) => entry.name.split(' ').at(-1))).not.toContain('.')
  })

  it('reads a status for each of the three buckets', () => {
    expect(named('Ada Lovelace').status).toBe('attending')
    expect(named('Not Coming').status).toBe('declined')
    expect(named('Lise Meitner').status).toBe('none')
  })

  it('sorts by surname, the way a guest list reads', () => {
    // Households move as a block, so the run of surnames is only sorted once
    // each household is collapsed to the member it sorts under.
    const heads = []
    for (const entry of summary) {
      if (entry.party !== undefined && entry.party === summary[summary.indexOf(entry) - 1]?.party) {
        continue
      }
      heads.push(entry.name.split(' ').at(-1))
    }
    expect(heads).toEqual([...heads].sort((a, b) => a.localeCompare(b)))
  })

  it('gives everyone in a household the same party, and nobody else theirs', () => {
    const smiths = summary.filter((entry) => entry.name === 'John Smith')
    expect(smiths).toHaveLength(2)
    // Two households, two namesakes: they must not be drawn together.
    expect(smiths[0].party).not.toBe(smiths[1].party)

    const family = summary.filter((entry) => ['John Smith', 'Mary Smith'].includes(entry.name))
    expect(new Set(family.map((entry) => entry.party)).size).toBe(2)
  })

  it('leaves a guest travelling alone with no party at all', () => {
    // A lone member is not a household, and a bracket around one name says
    // nothing. 44 real rows carry no party string; two more are parties of one.
    expect(named('Ada Lovelace').party).toBeUndefined()
    expect(named('Tycho Brahe').party).toBeUndefined()
  })

  it('keeps the members of a household adjacent', () => {
    // The page groups by walking adjacent rows, so this ordering is the
    // contract it relies on rather than a nicety.
    const seen = new Set()
    summary.forEach((entry, position) => {
      if (entry.party === undefined) return
      if (seen.has(entry.party)) {
        expect(summary[position - 1]?.party, `party ${entry.party} is split`).toBe(entry.party)
      }
      seen.add(entry.party)
    })
  })

  it('never ships the party name, only an opaque id', () => {
    // 'Smith Family' and 'Prayaga North' are guest data the page has no use
    // for; all it needs is that two rows belong together.
    const serialized = JSON.stringify(summary)
    expect(serialized).not.toContain('Family')
    expect(serialized).not.toContain('Household')
    expect(serialized).not.toContain('Prayaga North')
    for (const entry of summary) {
      if (entry.party !== undefined) expect(typeof entry.party).toBe('number')
    }
  })

  it('sorts a household under its alphabetically first member', () => {
    // The two Prayaga namesakes are in different parties, so they stay apart;
    // what matters is that a household does not pull its block out of order.
    const positionOf = (name) => summary.findIndex((entry) => entry.name === name)
    expect(positionOf('Ada Lovelace')).toBeLessThan(positionOf('Chien-Shiung Wu'))
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
      resolveBucket([record(1, ['muhurtham'], ''), record(2, ['muhurtham', 'reception'], '')]),
    ).toThrow(/distinguishing household hint/)

    expect(() =>
      resolveBucket([record(1, ['muhurtham'], 'Same'), record(2, ['reception'], 'Same')]),
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
          true,
        )
      }
    }
  })

  it('rejects an event gated on a tag the export does not have', () => {
    expect(() => assertGatesExist([{ id: 'x', gate: 'nope' }], new Set(['muhurtam']))).toThrow(
      /does not exist in the export/,
    )
  })

  it('rejects a roster missing either side-of-the-family tag', () => {
    // Nothing else in the pipeline looks at these, so a dropped column would
    // just empty one of the page's two filters with no error anywhere.
    expect(() => assertSummaryTagsExist(new Set(['admin', 'venkat']))).toThrow(/vidya/)
    expect(() => assertSummaryTagsExist(new Set(['admin', 'vidya']))).toThrow(/venkat/)
    expect(() =>
      assertSummaryTagsExist(new Set(guests.flatMap((guest) => [...guest.tags]))),
    ).not.toThrow()
  })

  it('rejects a roster missing either side-of-the-wedding tag', () => {
    expect(() => assertInviteSideTagsExist(new Set(['admin', 'jackson']))).toThrow(/anupama/)
    expect(() => assertInviteSideTagsExist(new Set(['admin', 'anupama']))).toThrow(/jackson/)
    expect(() =>
      assertInviteSideTagsExist(new Set(guests.flatMap((guest) => [...guest.tags]))),
    ).not.toThrow()
  })

  it('rejects a guest no invitation covers', () => {
    // A blank link cell is the thing nobody notices until the wrong invitation
    // has already gone out, so it fails the sync with the row to fix instead.
    const withTags = (row, tags) => ({ ...guests[0], row, tags: new Set(tags) })

    // Jackson's side has one page and no narrowed variant, so anything short of
    // all three events has nowhere to point.
    expect(() =>
      assertEveryGuestHasAnInvite([withTags(41, ['jackson', 'muhurtam', 'reception'])]),
    ).toThrow(/Rows: 41 \(jackson, MR\)/)

    // Both sides or neither: there is no side to pick a page from.
    expect(() => assertEveryGuestHasAnInvite([withTags(7, ['anupama', 'jackson'])])).toThrow(
      /Rows: 7/,
    )
    expect(() => assertEveryGuestHasAnInvite([withTags(9, ['muhurtam'])])).toThrow(/Rows: 9/)

    // Every offending row at once, so they can be fixed in one pass.
    expect(() =>
      assertEveryGuestHasAnInvite([withTags(3, ['muhurtam']), withTags(5, ['muhurtam'])]),
    ).toThrow(/Rows: 3, 5/)

    expect(() =>
      assertEveryGuestHasAnInvite(guests.filter((guest) => guest.tags.size > 1)),
    ).not.toThrow()
  })

  it('rejects a roster missing the summary RSVP columns', () => {
    // Absent columns would read as 'nobody has answered anything', which the
    // page would report with total confidence.
    expect(() => assertSummaryRsvpColumnsExist([{ ...guests[0], sangeetRsvp: undefined }])).toThrow(
      /sangeetRsvp/,
    )
    expect(() => assertSummaryRsvpColumnsExist(guests)).not.toThrow()
  })

  it('refuses to build an index with no admin passphrase', () => {
    // The failure this prevents is invisible: an index built without it looks
    // entirely normal and publishes the roster under a key nobody chose.
    return expect(
      buildIndex({ guests, catalogEvents, iterations: TEST_ITERATIONS, keralaResponses }),
    ).rejects.toThrow(/adminPassphrase/)
  })

  it('rejects universal copy that has drifted from the bundled module', () => {
    expect(() =>
      assertUniversalEventsMatch(
        [{ id: 'muhurtham', universal: true, title: 'Renamed Ceremony' }],
        "export const universalEvents = [{ id: 'muhurtham', title: 'Wedding Ceremony' }]",
      ),
    ).toThrow(/missing from src\/data\/scheduleEvents.ts/)
  })

  // These two were off the guard's field list once. The failure is silent and
  // one-sided: the dress code gets rewritten here, and every visitor who hasn't
  // identified themselves goes on reading the old one out of the bundle.
  it('rejects a universal dress code that has drifted', () => {
    expect(() =>
      assertUniversalEventsMatch(
        [{ id: 'muhurtham', universal: true, attire: 'Saris and kurtas, newly reworded' }],
        "export const universalEvents = [{ id: 'muhurtham', attire: 'Saris and kurtas' }]",
      ),
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
        "export const universalEvents = [{ id: 'muhurtham', indianWear: { women: 'Bright saris', men: 'A white kurta' } }]",
      ),
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
      /'admin' tag does not exist/,
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
    expect(smiths.map((record) => record.hint).sort()).toEqual(['Smith Family', 'Smith Household'])
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
    expect(prayagas.map((record) => record.hint).sort()).toEqual(['Prayaga North', 'Prayaga South'])
  })

  it('republishes when only an email changes', async () => {
    const before = await sourceFingerprint(guests, catalogEvents)
    const edited = guests.map((guest) =>
      guest.firstName === 'Grace' ? { ...guest, emails: ['grace@example.com'] } : guest,
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
        : guest,
    )
    expect(await sourceFingerprint(declined, catalogEvents)).not.toBe(before)

    const withdrawn = guests.map((guest) =>
      guest.firstName === 'Alan' ? { ...guest, muhurthamRsvp: 'Not Attending' } : guest,
    )
    expect(await sourceFingerprint(withdrawn, catalogEvents)).not.toBe(before)
  })

  it('republishes when any of the four wedding RSVPs changes', async () => {
    // /guest-summary reads all four. Only muhurtham was ever on this list, so
    // a sangeet or reception answer used to move nothing the sync could see.
    const before = await sourceFingerprint(guests, catalogEvents)
    for (const field of ['pellikuthuruRsvp', 'sangeetRsvp', 'receptionRsvp']) {
      const edited = guests.map((guest) =>
        guest.firstName === 'Grace' ? { ...guest, [field]: 'Not Attending' } : guest,
      )
      expect(await sourceFingerprint(edited, catalogEvents), field).not.toBe(before)
    }
  })

  it('republishes when the admin passphrase is rotated', async () => {
    // Rotating the secret changes no roster input. Without this the sync would
    // report 'nothing to publish' and leave the old ciphertext live under the
    // old passphrase — a rotation that appears to work and changes nothing.
    const before = await sourceFingerprint(guests, catalogEvents, keralaResponses, 'old-secret')
    expect(await sourceFingerprint(guests, catalogEvents, keralaResponses, 'new-secret')).not.toBe(
      before,
    )
  })

  it('cannot be decrypted with the wrong name', async () => {
    const salt = base64ToBytes(index.kdf.salt)
    const target = index.guests[await lookupHash(normalizedKey('Alan', 'Turing'), salt)][0]
    const wrongKey = await deriveGuestKey(
      normalizedKey('Wrong', 'Person'),
      salt,
      index.kdf.iterations,
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

describe('admin payload', () => {
  /** Mirrors what the browser does in useAdminUnlock. */
  const open = async (passphrase) => {
    const key = await importEventKey(
      await deriveAdminKeyBytes(
        passphrase,
        base64ToBytes(index.admin.kdf.salt),
        index.admin.kdf.iterations,
      ),
    )
    return decryptJson(key, index.admin.payload)
  }

  it('opens with the passphrase it was built under', async () => {
    const payload = await open(TEST_PASSPHRASE)
    expect(payload.summary).toHaveLength(guests.length)
  })

  it('carries the whole rooming and the billing beside the roster', async () => {
    // /admin/kerala-trip answers the agent's questions about rooms it does not
    // occupy, so unlike the per-guest payload this one sees both occupants.
    const { keralaTrip } = await open(TEST_PASSPHRASE)
    expect(keralaTrip.rooms).toEqual([
      {
        room: 1,
        bed: 'twin',
        occupants: [
          {
            name: 'Vera Rubin',
            trip: 'full',
            flight: 'rt',
            occupancy: 'double',
            priceOverride: 67440,
          },
          { name: 'Carl Sagan', trip: 'short', flight: 'ow', occupancy: 'double' },
        ],
      },
      {
        room: 2,
        occupants: [
          {
            name: 'Enrico Fermi',
            trip: 'full',
            flight: 'ow',
            occupancy: 'single',
            // Here as well as in his own envelope: the billing summary needs it
            // to tell what we are covering from what the agent is charging.
            hostCovers: 9531,
          },
        ],
      },
    ])
    expect(keralaTrip.billing).toEqual(keralaBilling)
    expect(stats.keralaRooms).toBe(2)
    expect(stats.keralaBeds).toEqual({ double: 0, twin: 1 })
  })

  it('stays shut for every other passphrase', async () => {
    // Not a comparison the client makes and could be talked out of — a wrong
    // key is an AES-GCM tag failure, and there is nothing else to try.
    expect(await open('wrong')).toBeNull()
    expect(await open(`${TEST_PASSPHRASE} `)).toBeNull()
    expect(await open('')).toBeNull()
  })

  it('salts the passphrase separately from the guest names', () => {
    // Sharing the salt would let one precomputed table serve both cracking the
    // passphrase and hashing names.
    expect(index.admin.kdf.salt).not.toBe(index.kdf.salt)
  })

  it('puts the key nowhere near a guest record', async () => {
    // The admin tag says who may see the page. It is not, and must not become,
    // a way of reading the payload — an admin's name is guessable.
    const [alan] = await lookup('Alan', 'Turing')
    expect(alan.admin).toBe(true)
    expect(JSON.stringify(alan)).not.toContain(index.admin.kdf.salt)
    expect(Object.keys(alan)).not.toContain('summaryKey')
  })

  it('leaves no summary name in plaintext', () => {
    // The rest of the index hides names behind guest-name keys, which its own
    // header concedes are guessable. This one is the file's only real secret,
    // and it holds 649 names in one envelope.
    const serialized = JSON.stringify(index)
    expect(serialized).not.toContain('Lovelace')
    expect(serialized).not.toContain('attending')
    expect(serialized).not.toContain('declined')
    expect(serialized).not.toContain('vidya')
    expect(serialized).not.toContain('venkat')
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
  const response = (email, overrides = {}) => {
    const built = {
      email,
      trip: 'full',
      flight: 'rt',
      occupancy: 'double',
      bed: 'double',
      room: 1,
      ...overrides,
    }
    // The generator rejects a bed on a single, so an `occupancy: 'single'`
    // override has to drop the default one rather than have every caller say so.
    if (built.occupancy === 'single' && overrides.bed === undefined) delete built.bed
    return built
  }

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
      // His is the fixture's subsidised share: ₹82,032 at the card, ₹9,531 of
      // it ours, so he is asked $761 rather than $861.
      hostCovers: 9531,
      priceNote: 'We are covering $100 of this one, so your price is $761 rather than $861.',
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
        [response('stranger@example.com', { occupancy: 'single' })],
      ),
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
        [response('shared@example.com', { occupancy: 'single' })],
      ),
    ).toThrow(/matches 2 roster guests \(row 1, row 2\)/)
  })

  it('lets a name settle a shared email, the plus-one placeholder shape', () => {
    // With Joy gives an unnamed plus-one row the invitee's own email, so the
    // real guest's response has to be able to say which row is theirs.
    const roster = [
      rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
      rosterGuest(2, "Vera's Guest", '', ['vera@example.com']),
    ]
    const { payloads } = resolveKeralaPayloads(roster, [
      response('vera@example.com', { occupancy: 'single', name: 'Vera Rubin' }),
    ])
    expect(payloads.get(roster[0])).toBeDefined()
    expect(payloads.get(roster[1])).toBeUndefined()

    expect(() =>
      resolveKeralaPayloads(roster, [
        response('vera@example.com', { occupancy: 'single', name: 'Someone Else' }),
      ]),
    ).toThrow(/names 'Someone Else', but no roster guest/)
  })

  it('refuses two responses that resolve to one guest', () => {
    expect(() =>
      resolveKeralaPayloads(
        [rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com', 'vr@example.org'])],
        [
          response('vera@example.com', { occupancy: 'single' }),
          response('vr@example.org', { occupancy: 'single', room: 2 }),
        ],
      ),
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
    expect(() => resolveKeralaPayloads(roster, [response('vera@example.com')])).toThrow(
      /lone double-occupancy respondent/,
    )
    expect(() =>
      resolveKeralaPayloads(roster, [
        response('vera@example.com'),
        response('carl@example.com'),
        response('enrico@example.com'),
      ]),
    ).toThrow(/3 occupants/)
  })

  it('refuses a bed that is missing, misspelt, or on a single', () => {
    const roster = [
      rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
      rosterGuest(2, 'Carl', 'Sagan', ['carl@example.com']),
    ]
    const pair = (overrides = {}) => [
      response('vera@example.com', overrides),
      response('carl@example.com', overrides),
    ]

    expect(() => resolveKeralaPayloads(roster, pair({ bed: undefined }))).toThrow(
      /needs a "bed" of "double" or "twin"/,
    )
    expect(() => resolveKeralaPayloads(roster, pair({ bed: 'queen' }))).toThrow(
      /needs a "bed" of "double" or "twin"/,
    )
    // The other direction: a single has one bed and nothing to choose, so a
    // stray value there is a row that was edited without being re-read.
    expect(() =>
      resolveKeralaPayloads(
        [rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com'])],
        [response('vera@example.com', { occupancy: 'single', bed: 'twin', room: 9 })],
      ),
    ).toThrow(/single occupancy but carries a "bed"/)
  })

  it('carries a sole-use night to the admin rooms and nowhere else', async () => {
    // What the agent charges us over the rate card, kept apart from the price
    // the guest was quoted. The guest's own envelope must not carry it: what
    // we are billed for them is not their business.
    const { rooms, payloads } = resolveKeralaPayloads(
      [
        rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
        rosterGuest(2, 'Carl', 'Sagan', ['carl@example.com']),
      ],
      [
        response('vera@example.com', { priceOverride: 67440, soleUseNights: 1 }),
        response('carl@example.com', { trip: 'short' }),
      ],
    )
    expect(rooms[0].occupants[0]).toMatchObject({ priceOverride: 67440, soleUseNights: 1 })
    expect([...payloads.values()][0]).not.toHaveProperty('soleUseNights')
  })

  it('carries what we cover to the guest as well as to the admin rooms', () => {
    // The one price field that belongs in both. The guest has to see it —
    // it changes the figure they are being asked for — and the admin page has
    // to see it to know the difference is ours rather than the agent's.
    const { rooms, payloads } = resolveKeralaPayloads(
      [
        rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
        rosterGuest(2, 'Carl', 'Sagan', ['carl@example.com']),
      ],
      [response('vera@example.com', { hostCovers: 23283 }), response('carl@example.com')],
    )
    expect(rooms[0].occupants[0]).toMatchObject({ hostCovers: 23283 })
    expect(rooms[0].occupants[1]).not.toHaveProperty('hostCovers')
    expect([...payloads.values()][0]).toMatchObject({ hostCovers: 23283 })
    expect([...payloads.values()][1]).not.toHaveProperty('hostCovers')
  })

  it('refuses a covered share that is not a positive figure under the price', () => {
    const roster = [
      rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
      rosterGuest(2, 'Carl', 'Sagan', ['carl@example.com']),
    ]
    const pair = (overrides) => [
      response('vera@example.com', overrides),
      response('carl@example.com'),
    ]
    expect(() => resolveKeralaPayloads(roster, pair({ hostCovers: 0 }))).toThrow(/hostCovers/)
    expect(() => resolveKeralaPayloads(roster, pair({ hostCovers: -5 }))).toThrow(/hostCovers/)
    expect(() => resolveKeralaPayloads(roster, pair({ hostCovers: 'lots' }))).toThrow(/hostCovers/)
    // Covering more than the guest was quoted would hand them a negative price.
    expect(() =>
      resolveKeralaPayloads(roster, pair({ priceOverride: 20000, hostCovers: 20000 })),
    ).toThrow(/hostCovers/)
  })

  it('carries the host flag to the admin rooms and nowhere else', () => {
    // Whose trip it is, which decides whether their place counts as money a
    // guest owes. A flag in the data rather than two names in the source,
    // which is published — and not in the guest's own envelope either.
    const { rooms, payloads } = resolveKeralaPayloads(
      [
        rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
        rosterGuest(2, 'Carl', 'Sagan', ['carl@example.com']),
      ],
      [response('vera@example.com', { host: true }), response('carl@example.com')],
    )
    expect(rooms[0].occupants[0]).toMatchObject({ host: true })
    expect(rooms[0].occupants[1]).not.toHaveProperty('host')
    expect([...payloads.values()][0]).not.toHaveProperty('host')
  })

  it('refuses a host flag that is anything but true', () => {
    const roster = [
      rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
      rosterGuest(2, 'Carl', 'Sagan', ['carl@example.com']),
    ]
    expect(() =>
      resolveKeralaPayloads(roster, [
        response('vera@example.com', { host: false }),
        response('carl@example.com'),
      ]),
    ).toThrow(/host=false/)
  })

  it('carries a payment to the admin rooms, naming who covered whom', () => {
    // Guest money is admin business: their own envelope carries the price they
    // were asked for and nothing about what anyone has actually sent.
    const { rooms, payloads } = resolveKeralaPayloads(
      [
        rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
        rosterGuest(2, 'Carl', 'Sagan', ['carl@example.com']),
      ],
      [
        response('vera@example.com', { payment: { usd: 1178, to: 'anupama', via: 'zelle' } }),
        response('carl@example.com', { payment: { via: 'roommate' } }),
      ],
    )
    expect(rooms[0].occupants[0].payment).toEqual({ usd: 1178, to: 'anupama', via: 'zelle' })
    // Resolved here, where the pairing is already known, rather than on a page
    // that would have to work out who paid for whom a second time.
    expect(rooms[0].occupants[1].payment).toEqual({ via: 'roommate', paidBy: 'Vera' })
    for (const payload of payloads.values()) expect(payload).not.toHaveProperty('payment')
  })

  it('refuses a malformed payment', () => {
    const roster = [
      rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
      rosterGuest(2, 'Carl', 'Sagan', ['carl@example.com']),
    ]
    const pair = (payment) => [
      response('vera@example.com', { payment }),
      response('carl@example.com'),
    ]
    expect(() => resolveKeralaPayloads(roster, pair({ usd: 100, via: 'cheque' }))).toThrow(
      /malformed/,
    )
    expect(() =>
      resolveKeralaPayloads(roster, pair({ usd: 100, to: 'someone', via: 'zelle' })),
    ).toThrow(/malformed/)
    expect(() => resolveKeralaPayloads(roster, pair({ via: 'zelle' }))).toThrow(/malformed/)
    expect(() => resolveKeralaPayloads(roster, pair({ usd: -5, via: 'zelle' }))).toThrow(
      /malformed/,
    )
    // A roommate payment carries no amount of its own; the payer's row has it.
    expect(() => resolveKeralaPayloads(roster, pair({ usd: 100, via: 'roommate' }))).toThrow(
      /malformed/,
    )
  })

  it('refuses a roommate payment with no roommate who actually paid', () => {
    // Unchecked, a mistyped one reads as a guest who has settled when nobody
    // has sent a penny for them.
    const roster = [
      rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
      rosterGuest(2, 'Carl', 'Sagan', ['carl@example.com']),
    ]
    expect(() =>
      resolveKeralaPayloads(roster, [
        response('vera@example.com', { payment: { via: 'roommate' } }),
        response('carl@example.com'),
      ]),
    ).toThrow(/nobody in room 1 has a payment with an amount/)
  })

  it('refuses a sole-use night on a stay that has no final night to cost', () => {
    // The figure is the difference between the two itineraries' final nights,
    // so a shortened stay has nothing to difference — and a single-occupancy
    // guest is already being charged the single rate.
    const roster = [
      rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
      rosterGuest(2, 'Carl', 'Sagan', ['carl@example.com']),
    ]
    const pair = (overrides) => [
      response('vera@example.com', overrides),
      response('carl@example.com', overrides),
    ]
    expect(() => resolveKeralaPayloads(roster, pair({ trip: 'short', soleUseNights: 1 }))).toThrow(
      /soleUseNights/,
    )
    expect(() =>
      resolveKeralaPayloads(
        [roster[0]],
        [response('vera@example.com', { occupancy: 'single', soleUseNights: 1, room: 9 })],
      ),
    ).toThrow(/soleUseNights/)
    expect(() => resolveKeralaPayloads(roster, pair({ soleUseNights: 0 }))).toThrow(/soleUseNights/)
    expect(() => resolveKeralaPayloads(roster, pair({ soleUseNights: 1.5 }))).toThrow(
      /soleUseNights/,
    )
  })

  it('refuses roommates who disagree about the bed', () => {
    // The room can only be booked one way, and the count sent to the agent
    // would be off by one whichever of the two it believed.
    expect(() =>
      resolveKeralaPayloads(
        [
          rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
          rosterGuest(2, 'Carl', 'Sagan', ['carl@example.com']),
        ],
        [
          response('vera@example.com', { bed: 'double' }),
          response('carl@example.com', { bed: 'twin' }),
        ],
      ),
    ).toThrow(/roommates share one bed type/)
  })

  it('assembles whole rooms for the admin page, in room order', () => {
    const { rooms } = resolveKeralaPayloads(
      [
        rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com']),
        rosterGuest(2, 'Carl', 'Sagan', ['carl@example.com']),
        rosterGuest(3, 'Enrico', 'Fermi', ['enrico@example.com']),
      ],
      [
        response('enrico@example.com', { occupancy: 'single', flight: 'ow', room: 9 }),
        response('vera@example.com', { bed: 'twin', priceOverride: 67440 }),
        response('carl@example.com', { bed: 'twin', trip: 'short', flight: 'ow' }),
      ],
    )

    // Sorted numerically, not by the order the responses happened to be typed
    // in — the admin table is read against the agent's own room numbering.
    expect(rooms).toEqual([
      {
        room: 1,
        bed: 'twin',
        occupants: [
          {
            name: 'Vera Rubin',
            trip: 'full',
            flight: 'rt',
            occupancy: 'double',
            priceOverride: 67440,
          },
          { name: 'Carl Sagan', trip: 'short', flight: 'ow', occupancy: 'double' },
        ],
      },
      {
        room: 9,
        occupants: [{ name: 'Enrico Fermi', trip: 'full', flight: 'ow', occupancy: 'single' }],
      },
    ])
  })

  it('refuses malformed response fields', () => {
    expect(() =>
      resolveKeralaPayloads(
        [rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com'])],
        [response('vera@example.com', { trip: 'medium', occupancy: 'single' })],
      ),
    ).toThrow(/invalid fields/)

    expect(() =>
      resolveKeralaPayloads(
        [rosterGuest(1, 'Vera', 'Rubin', ['vera@example.com'])],
        [response('vera@example.com', { occupancy: 'single', priceOverride: -5 })],
      ),
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
    expect(resolveBucket([record(1, 'North', trip), record(2, 'South', undefined)])).toHaveLength(2)
    expect(resolveBucket([record(1, 'North', trip), record(2, 'South', { ...trip })])).toHaveLength(
      1,
    )
  })

  it('republishes when a response changes', async () => {
    const before = await sourceFingerprint(guests, catalogEvents, keralaResponses)
    expect(await sourceFingerprint(guests, catalogEvents, null)).not.toBe(before)

    const edited = keralaResponses.map((entry) =>
      entry.email === 'carl.sagan@example.com' ? { ...entry, flight: 'rt' } : entry,
    )
    expect(await sourceFingerprint(guests, catalogEvents, edited)).not.toBe(before)
    expect(
      await sourceFingerprint(
        guests,
        catalogEvents,
        keralaResponses.map((entry) => ({ ...entry })),
      ),
    ).toBe(before)
  })

  it('republishes when a payment is recorded', async () => {
    // Recording a payment moves nothing about the roster, so without billing in
    // the fingerprint this is exactly the edit that hashes identical and never
    // ships — the sync would say 'nothing to publish' and mean it.
    const args = [guests, catalogEvents, keralaResponses, '']
    const before = await sourceFingerprint(...args, keralaBilling)
    expect(await sourceFingerprint(...args, null)).not.toBe(before)
    expect(
      await sourceFingerprint(...args, {
        ...keralaBilling,
        payments: [...keralaBilling.payments, { date: '2026-09-05', amount: 1, note: 'Second' }],
      }),
    ).not.toBe(before)
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
    // The admin rooming names both occupants of every room in one object, and
    // the billing says what we owe. Both sit inside the passphrase envelope;
    // the name check above already covers the occupants themselves.
    expect(serialized).not.toContain('keralaTrip')
    expect(serialized).not.toContain('occupants')
    // What a guest has sent us is ours and theirs, not the index's.
    expect(serialized).not.toContain('payment')
    expect(serialized).not.toContain('zelle')
    expect(serialized).not.toContain('venmo')
    expect(serialized).not.toContain('paypal')
    expect(serialized).not.toContain(String(keralaBilling.payments[0].amount))
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
