import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

// Imported through Vite rather than read off disk, like useGuestSchedule.test:
// this file is typechecked by `tsc -b` and there is no @types/node here.
import catalog from '../../data/schedule-events.json'
import guestCsv from '../../tests/fixtures/guests.sample.csv?raw'
import { parseCsv, rowsToGuests } from '../../scripts/lib/roster.js'
import { buildIndex } from '../../scripts/lib/scheduleIndex.js'
import { useAdminUnlock } from './adminUnlock'

const TEST_ITERATIONS = 1000
const PASSPHRASE = 'correct-horse-battery-staple'

// The real generator's output over the real fixture. The point of this file is
// the round trip, so a hand-written index would test nothing.
let index: unknown

beforeAll(async () => {
  ;({ index } = await buildIndex({
    guests: rowsToGuests(parseCsv(guestCsv)),
    catalogEvents: catalog.events,
    iterations: TEST_ITERATIONS,
    adminIterations: TEST_ITERATIONS,
    adminPassphrase: PASSPHRASE,
  }))
})

const serveIndex = (body: unknown = index) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => body })),
  )

beforeEach(() => {
  window.localStorage.clear()
  serveIndex()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Renders the hook and waits for the initial index fetch to settle. */
const mountLocked = async () => {
  const rendered = renderHook(() => useAdminUnlock())
  await waitFor(() => expect(rendered.result.current.status).toBe('locked'))
  return rendered
}

describe('useAdminUnlock', () => {
  it('settles on locked with nothing stored', async () => {
    const { result } = await mountLocked()
    expect(result.current.summary).toEqual([])
  })

  it('opens the roster with the right passphrase', async () => {
    const { result } = await mountLocked()

    act(() => result.current.unlock(PASSPHRASE))
    await waitFor(() => expect(result.current.status).toBe('unlocked'))

    expect(result.current.summary.length).toBeGreaterThan(20)
    expect(result.current.summary.map((entry) => entry.name)).toContain('Ada Lovelace')
  })

  it('reports a wrong passphrase without opening anything', async () => {
    const { result } = await mountLocked()

    act(() => result.current.unlock('not the passphrase'))
    await waitFor(() => expect(result.current.status).toBe('wrong'))

    expect(result.current.summary).toEqual([])
    expect(window.localStorage.getItem('admin-unlock')).toBeNull()
  })

  it('stores the derived key, never the passphrase', async () => {
    // A peek at localStorage should yield something that opens this one
    // payload, not a secret its owner may have used elsewhere.
    const { result } = await mountLocked()

    act(() => result.current.unlock(PASSPHRASE))
    await waitFor(() => expect(result.current.status).toBe('unlocked'))

    const stored = window.localStorage.getItem('admin-unlock')
    expect(stored).toBeTruthy()
    expect(stored).not.toContain(PASSPHRASE)
  })

  it('comes back unlocked on the next visit', async () => {
    const first = await mountLocked()
    act(() => first.result.current.unlock(PASSPHRASE))
    await waitFor(() => expect(first.result.current.status).toBe('unlocked'))

    const { result } = renderHook(() => useAdminUnlock())
    await waitFor(() => expect(result.current.status).toBe('unlocked'))
    expect(result.current.summary.map((entry) => entry.name)).toContain('Ada Lovelace')
  })

  it('re-locks and forgets the key on request', async () => {
    const { result } = await mountLocked()
    act(() => result.current.unlock(PASSPHRASE))
    await waitFor(() => expect(result.current.status).toBe('unlocked'))

    act(() => result.current.forget())

    expect(result.current.status).toBe('locked')
    expect(result.current.summary).toEqual([])
    expect(window.localStorage.getItem('admin-unlock')).toBeNull()
  })

  it('asks again when a stored key no longer opens the payload', async () => {
    // What a rotated passphrase looks like from the device: the key is still
    // there and is now useless, and sitting on it would show an empty page.
    const { result: unlocked } = await mountLocked()
    act(() => unlocked.current.unlock(PASSPHRASE))
    await waitFor(() => expect(unlocked.current.status).toBe('unlocked'))

    const { index: rotated } = await buildIndex({
      guests: rowsToGuests(parseCsv(guestCsv)),
      catalogEvents: catalog.events,
      iterations: TEST_ITERATIONS,
      adminIterations: TEST_ITERATIONS,
      adminPassphrase: 'rotated-passphrase',
    })
    serveIndex(rotated)

    const { result } = renderHook(() => useAdminUnlock())
    await waitFor(() => expect(result.current.status).toBe('locked'))
    expect(window.localStorage.getItem('admin-unlock')).toBeNull()
  })

  it('reports an error when the index carries no admin block', async () => {
    // An index published before this feature. No passphrase would ever open it,
    // so asking for one would be a prompt that cannot succeed.
    serveIndex({ v: 4, guests: {}, events: {} })

    const { result } = renderHook(() => useAdminUnlock())
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('reports an error when the index will not load at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    )

    const { result } = renderHook(() => useAdminUnlock())
    await waitFor(() => expect(result.current.status).toBe('error'))
  })
})
