import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

// Imported through Vite rather than read off disk: this file is typechecked by
// `tsc -b` along with the rest of src, and there is no @types/node here.
import catalog from '../../data/schedule-events.json'
import guestCsv from '../../tests/fixtures/guests.sample.csv?raw'
import keralaFixture from '../../tests/fixtures/kerala-responses.sample.json'
import { parseCsv, rowsToGuests } from '../../scripts/lib/roster.js'
import { buildIndex } from '../../scripts/lib/scheduleIndex.js'
import { useGuestSchedule } from './useGuestSchedule'
import { universalEvents } from '../data/scheduleEvents'

// Low iterations keep the suite fast; production uses KDF_ITERATIONS. Matches
// what tests/scheduleIndex.test.js does.
const TEST_ITERATIONS = 1000

// The real generator's output over the real fixture, not a hand-written index:
// this is the only test that exercises the browser half of the round trip, so
// what it decrypts has to be what the sync actually publishes.
let index: unknown

beforeAll(async () => {
  ;({ index } = await buildIndex({
    guests: rowsToGuests(parseCsv(guestCsv)),
    catalogEvents: catalog.events,
    iterations: TEST_ITERATIONS,
    keralaResponses: keralaFixture.responses,
  }))
})

const serveIndex = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => index }))
  )

beforeEach(() => {
  window.localStorage.clear()
  serveIndex()
})

afterEach(() => {
  vi.unstubAllGlobals()
  // Not just globals: the localStorage test spies on Storage.prototype, and an
  // unrestored spy there quietly swallows every later write.
  vi.restoreAllMocks()
})

const titles = (events: { title: string }[]) => events.map((event) => event.title)

describe('useGuestSchedule', () => {
  it('settles on anonymous once the index loads with no remembered guest', async () => {
    const { result } = renderHook(() => useGuestSchedule())

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('anonymous'))
    // Something useful is on screen before anyone types a name.
    expect(result.current.events).toEqual(universalEvents)
  })

  it('falls back to the universal events when the index will not load', async () => {
    // Expected until the first sync runs, and the page still has to render the
    // main celebrations rather than an empty schedule.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    )
    const { result } = renderHook(() => useGuestSchedule())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.events).toEqual(universalEvents)
  })

  it('treats a network failure the same as a missing index', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )
    const { result } = renderHook(() => useGuestSchedule())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.events).toEqual(universalEvents)
  })

  it('decrypts a guest their own schedule', async () => {
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('Alan', 'Turing'))

    await waitFor(() => expect(result.current.status).toBe('identified'))
    expect(result.current.displayName).toBe('Alan')
    // Turing carries every tag in the fixture, so this is more than the two
    // bundled events — proof the encrypted half decrypted.
    expect(result.current.events.length).toBeGreaterThan(universalEvents.length)
    expect(titles(result.current.events)).toContain('Wedding Ceremony & Muhurtham')
  })

  it('gives a guest with fewer invitations fewer events', async () => {
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('Ada', 'Lovelace'))
    await waitFor(() => expect(result.current.status).toBe('identified'))

    const ada = result.current.events.length
    expect(ada).toBeGreaterThan(0)

    act(() => result.current.signOut())
    act(() => result.current.lookup('Alan', 'Turing'))
    await waitFor(() => expect(result.current.status).toBe('identified'))

    expect(result.current.events.length).toBeGreaterThan(ada)
  })

  it('reports a name that is not on the list', async () => {
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('Nobody', 'Here'))

    await waitFor(() => expect(result.current.status).toBe('notFound'))
    expect(result.current.events).toEqual(universalEvents)
  })

  it('asks which household when two guests share a name and differ', async () => {
    // The two John Smiths in the fixture have different invite sets, so
    // guessing would show one of them the other's private events.
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('John', 'Smith'))

    await waitFor(() => expect(result.current.status).toBe('ambiguous'))
    // Labeled by party mates, never by the internal party string.
    expect(result.current.candidates).toEqual(
      expect.arrayContaining(['With Mary Smith', 'With Peter Smith'])
    )
    // Both Smith parties have an email on file, so the email check comes first.
    expect(result.current.emailPrompt).toBe(true)
    expect(result.current.emailFailed).toBe(false)
  })

  it('resolves silently when the offered email matches one household', async () => {
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('John', 'Smith'))
    await waitFor(() => expect(result.current.status).toBe('ambiguous'))

    // Mary's address covers John — party emails are pooled — and the mangled
    // casing and padding must not matter.
    act(() => result.current.submitEmail('  Mary@Example.COM '))

    await waitFor(() => expect(result.current.status).toBe('identified'))
    expect(result.current.displayName).toBe('John')

    // The match also persists the household, so a reload skips every prompt.
    const reloaded = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(reloaded.result.current.status).toBe('identified'))
    expect(reloaded.result.current.displayName).toBe('John')
  })

  it('falls back to the household choice when the email matches nothing', async () => {
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('John', 'Smith'))
    await waitFor(() => expect(result.current.status).toBe('ambiguous'))

    act(() => result.current.submitEmail('nobody@example.com'))

    await waitFor(() => expect(result.current.emailFailed).toBe(true))
    expect(result.current.emailPrompt).toBe(false)
    expect(result.current.status).toBe('ambiguous')

    // The buttons still work after the failed attempt.
    const family = result.current.candidates.indexOf('With Mary Smith')
    act(() => result.current.chooseCandidate(family))
    await waitFor(() => expect(result.current.status).toBe('identified'))
  })

  it('lets a guest skip the email check', async () => {
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('John', 'Smith'))
    await waitFor(() => expect(result.current.status).toBe('ambiguous'))

    act(() => result.current.skipEmail())

    expect(result.current.emailPrompt).toBe(false)
    expect(result.current.emailFailed).toBe(false)
    expect(result.current.status).toBe('ambiguous')
  })

  it('skips the email check when no colliding household has one on file', async () => {
    // Neither Ram Prayaga has an email anywhere in their party, so asking
    // would be pure friction before the same buttons.
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('Ram', 'Prayaga'))

    await waitFor(() => expect(result.current.status).toBe('ambiguous'))
    expect(result.current.emailPrompt).toBe(false)
    // No party mates to label with either — the party hint is the fallback.
    expect(result.current.candidates).toEqual(
      expect.arrayContaining(['Prayaga North', 'Prayaga South'])
    )
  })

  it('does not ask when the guests sharing a name have identical invitations', async () => {
    // Both Jane Does are invited to the same events, so either record serves.
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('Jane', 'Doe'))

    await waitFor(() => expect(result.current.status).toBe('identified'))
    expect(result.current.candidates).toEqual([])
  })

  it('resolves the schedule once a household is chosen', async () => {
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('John', 'Smith'))
    await waitFor(() => expect(result.current.status).toBe('ambiguous'))
    act(() => result.current.skipEmail())

    const family = result.current.candidates.indexOf('With Mary Smith')
    act(() => result.current.chooseCandidate(family))

    await waitFor(() => expect(result.current.status).toBe('identified'))
    expect(result.current.displayName).toBe('John')
    expect(result.current.candidates).toEqual([])
  })

  it('remembers the guest across a reload', async () => {
    const first = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(first.result.current.status).toBe('anonymous'))
    act(() => first.result.current.lookup('Grace', 'Hopper'))
    await waitFor(() => expect(first.result.current.status).toBe('identified'))
    first.unmount()

    const second = renderHook(() => useGuestSchedule())

    await waitFor(() => expect(second.result.current.status).toBe('identified'))
    expect(second.result.current.displayName).toBe('Grace')
    // Straight to identified — never anonymous in between.
    expect(second.result.current.candidates).toEqual([])
  })

  it('remembers which household, so a shared name is not asked twice', async () => {
    // Stored as the hint rather than a position in the bucket: bucket order
    // follows roster row order, so a position would start pointing at the
    // other household the first time a row is inserted above them.
    const first = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(first.result.current.status).toBe('anonymous'))
    act(() => first.result.current.lookup('John', 'Smith'))
    await waitFor(() => expect(first.result.current.status).toBe('ambiguous'))
    act(() => first.result.current.skipEmail())
    const household = first.result.current.candidates.indexOf('With Peter Smith')
    act(() => first.result.current.chooseCandidate(household))
    await waitFor(() => expect(first.result.current.status).toBe('identified'))
    const events = first.result.current.events.length
    first.unmount()

    const second = renderHook(() => useGuestSchedule())

    await waitFor(() => expect(second.result.current.status).toBe('identified'))
    expect(second.result.current.events.length).toBe(events)
  })

  it('forgets the guest on sign out', async () => {
    const { result, unmount } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))
    act(() => result.current.lookup('Grace', 'Hopper'))
    await waitFor(() => expect(result.current.status).toBe('identified'))

    act(() => result.current.signOut())

    expect(result.current.status).toBe('anonymous')
    expect(result.current.displayName).toBeUndefined()
    expect(result.current.events).toEqual(universalEvents)

    unmount()
    const reopened = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(reopened.result.current.status).toBe('anonymous'))
  })

  it('survives localStorage being unavailable', async () => {
    // Private browsing rejects writes; the lookup still succeeded.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('Grace', 'Hopper'))

    await waitFor(() => expect(result.current.status).toBe('identified'))
    expect(result.current.displayName).toBe('Grace')
  })

  it('records a Kerala guest, so the nav can offer that link', async () => {
    // Alan Turing carries optional-trip in the fixture.
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('Alan', 'Turing'))
    await waitFor(() => expect(result.current.status).toBe('identified'))

    expect(result.current.events.some((event) => event.id === 'kerala')).toBe(true)
    expect(window.localStorage.getItem('schedule-kerala-invited')).toBe('true')
  })

  it('records nothing for a guest who is not on the Kerala trip', async () => {
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('Ada', 'Lovelace'))
    await waitFor(() => expect(result.current.status).toBe('identified'))

    expect(result.current.events.some((event) => event.id === 'kerala')).toBe(false)
    expect(window.localStorage.getItem('schedule-kerala-invited')).toBeNull()
  })

  it('clears the Kerala record on sign out', async () => {
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))
    act(() => result.current.lookup('Alan', 'Turing'))
    await waitFor(() => expect(result.current.status).toBe('identified'))

    act(() => result.current.signOut())

    expect(window.localStorage.getItem('schedule-kerala-invited')).toBeNull()
  })

  it('clears it again when a Kerala guest is replaced by one who is not', async () => {
    // Identifying as someone else must not leave the previous guest's link up.
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))
    act(() => result.current.lookup('Alan', 'Turing'))
    await waitFor(() => expect(result.current.status).toBe('identified'))
    expect(window.localStorage.getItem('schedule-kerala-invited')).toBe('true')

    act(() => result.current.signOut())
    act(() => result.current.lookup('Ada', 'Lovelace'))
    await waitFor(() => expect(result.current.status).toBe('identified'))

    expect(window.localStorage.getItem('schedule-kerala-invited')).toBeNull()
  })

  it('carries the guest their Kerala trip choices, and forgets them on sign out', async () => {
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('Vera', 'Rubin'))
    await waitFor(() => expect(result.current.status).toBe('identified'))

    expect(result.current.kerala).toEqual({
      trip: 'full',
      flight: 'rt',
      occupancy: 'double',
      roommates: ['Carl Sagan'],
      priceOverride: 67440,
      priceNote: 'Carl heads home a night early, so your last night is single occupancy.',
    })

    act(() => result.current.signOut())
    expect(result.current.kerala).toBeUndefined()
  })

  it('carries no Kerala choices for a trip guest who never filled out the form', async () => {
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('Alan', 'Turing'))
    await waitFor(() => expect(result.current.status).toBe('identified'))

    expect(result.current.kerala).toBeUndefined()
  })

  it('carries the guest their Golkonda room, and forgets it on sign out', async () => {
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('Alan', 'Turing'))
    await waitFor(() => expect(result.current.status).toBe('identified'))
    expect(result.current.golkonda).toBe('covered')

    act(() => result.current.signOut())
    expect(result.current.golkonda).toBeUndefined()
  })

  it('leaves the room unset for a guest who is not taking one', async () => {
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    // Tagged and attending, but she declined the room.
    act(() => result.current.lookup('Katherine', 'Johnson'))
    await waitFor(() => expect(result.current.status).toBe('identified'))

    expect(result.current.golkonda).toBeUndefined()
    // She still has the hotel events; only /hotels changes.
    expect(result.current.events.some((event) => event.id === 'check-in')).toBe(true)
  })

  it('omits a guest carrying no gating tag', async () => {
    const { result } = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    act(() => result.current.lookup('Tagless', 'Guest'))

    await waitFor(() => expect(result.current.status).toBe('notFound'))
  })
})
