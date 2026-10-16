import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

// The checks on data/schedule-events.json that used to run only in the nightly
// index generator. The generator is gone, and the lookup Function bundles the
// file as is, so these now run on every PR instead — before a bad edit
// deploys, rather than the night after.

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The two universal events are intentionally duplicated — one copy has to
 * ship in the JS bundle to paint instantly — and this is what stops the two
 * drifting.
 *
 * `attire` and `indianWear` are on the list because they are the fields most
 * likely to be reworded: they were left off it once, and the muhurtham dress
 * code could be rewritten in the catalog while every visitor who had not
 * identified themselves went on reading the old one out of the bundle.
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

function universalDrift(catalogEvents, bundledSource) {
  const drift = []
  for (const event of catalogEvents.filter((candidate) => candidate.universal)) {
    for (const field of MIRRORED_FIELDS) {
      const value = event[field]
      if (value && !bundledSource.includes(value)) drift.push(`${event.id}.${field}`)
    }
    // An object rather than a string, so it is checked a member at a time. The
    // bundled copy must hold each line as one literal — a string Prettier has
    // split across a `+` would read as missing.
    for (const [key, value] of Object.entries(event.indianWear ?? {})) {
      if (value && !bundledSource.includes(value)) drift.push(`${event.id}.indianWear.${key}`)
    }
  }
  return drift
}

let catalogEvents

beforeAll(async () => {
  catalogEvents = JSON.parse(
    await readFile(join(root, 'data', 'schedule-events.json'), 'utf-8'),
  ).events
})

describe('the catalog', () => {
  it('gives every event a unique id', () => {
    const ids = catalogEvents.map((event) => event.id)
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gates every event on a tag or a non-empty list of them', () => {
    // HQ matches these against each guest's tags on every lookup. Anything
    // else matches nobody, and the event silently disappears for everyone.
    for (const { id, gate } of catalogEvents) {
      const gates = Array.isArray(gate) ? gate : [gate]
      expect(gates.length, `event '${id}' has an empty gate`).toBeGreaterThan(0)
      for (const tag of gates) {
        expect(typeof tag === 'string' && tag.length > 0, `event '${id}' gate ${tag}`).toBe(true)
      }
    }
  })

  it('only lets the style guide name events that exist', async () => {
    // Each outfit on /what-to-wear lists the events it suits, by id. A typo
    // renders no chip and fails nothing — the card just quietly stops saying
    // when to wear the thing. Checked here because src/ deliberately never
    // reads data/schedule-events.json.
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
})

describe('the universal events', () => {
  it('match the copy bundled in src/data/scheduleEvents.ts', async () => {
    const bundled = await readFile(join(root, 'src', 'data', 'scheduleEvents.ts'), 'utf-8')
    expect(universalDrift(catalogEvents, bundled)).toEqual([])
  })

  it('catch a title that has drifted', () => {
    expect(
      universalDrift(
        [{ id: 'muhurtham', universal: true, title: 'Renamed Ceremony' }],
        "export const universalEvents = [{ id: 'muhurtham', title: 'Wedding Ceremony' }]",
      ),
    ).toEqual(['muhurtham.title'])
  })

  // These two were off the field list once. The failure is silent and
  // one-sided: the dress code gets rewritten in the catalog, and every visitor
  // who hasn't identified themselves goes on reading the old one out of the
  // bundle.
  it('catch a dress code that has drifted', () => {
    expect(
      universalDrift(
        [{ id: 'muhurtham', universal: true, attire: 'Saris and kurtas, newly reworded' }],
        "export const universalEvents = [{ id: 'muhurtham', attire: 'Saris and kurtas' }]",
      ),
    ).toEqual(['muhurtham.attire'])
  })

  it('catch Indian-wear notes that have drifted', () => {
    expect(
      universalDrift(
        [
          {
            id: 'muhurtham',
            universal: true,
            indianWear: { women: 'Bright saris', men: 'A white kurta and pancha' },
          },
        ],
        "export const universalEvents = [{ id: 'muhurtham', indianWear: { women: 'Bright saris', men: 'A white kurta' } }]",
      ),
    ).toEqual(['muhurtham.indianWear.men'])
  })
})
