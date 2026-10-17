import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

// Imported through Vite rather than read off disk: this file is typechecked by
// `tsc -b` along with the rest of src, and there is no @types/node here.
import catalog from '../../data/schedule-events.json'
import { useGuestSchedule } from './useGuestSchedule'
import {
  GOLKONDA_STAY_EVENT_ID,
  PELLIKUTHURU_EVENT_ID,
  universalEvents,
} from '../data/scheduleEvents'

/**
 * A stand-in for Wedding HQ behind /guest/lookup. Which guest gets which page —
 * aliases, gates, namesakes, party labels — is HQ's to decide, and its own
 * suite holds that to the old index generator with golden vectors. What this
 * file tests is the browser's half: asking, remembering, and what it shows
 * while it waits or when HQ cannot be reached.
 */
const event = (id: string, title: string) => ({ id, title, date: '2026-10-27', time: '10:00' })

const RECORDS: Record<string, Record<string, unknown>> = {
  'grace hopper': {
    displayName: 'Grace',
    eventIds: ['muhurtham', 'reception'],
    events: { reception: event('reception', 'Reception') },
  },
  'ada lovelace': {
    displayName: 'Ada',
    eventIds: ['muhurtham', 'reception'],
    events: { reception: event('reception', 'Reception') },
  },
  'alan turing': {
    displayName: 'Alan',
    admin: true,
    golkonda: 'covered',
    eventIds: [PELLIKUTHURU_EVENT_ID, GOLKONDA_STAY_EVENT_ID, 'muhurtham', 'kerala'],
    events: {
      [PELLIKUTHURU_EVENT_ID]: event(PELLIKUTHURU_EVENT_ID, 'Pellikuthuru'),
      [GOLKONDA_STAY_EVENT_ID]: event(GOLKONDA_STAY_EVENT_ID, 'Check-in'),
      kerala: event('kerala', 'Kerala'),
    },
  },
  'vera rubin': {
    displayName: 'Vera',
    eventIds: ['muhurtham', 'kerala'],
    events: { kerala: event('kerala', 'Kerala') },
    kerala: {
      trip: 'full',
      flight: 'rt',
      occupancy: 'double',
      roommates: ['Carl Sagan'],
      priceOverride: 67440,
    },
  },
}

const SMITHS = {
  'With Mary Smith': { hint: 'Smith Family', email: 'mary@example.com', eventIds: ['muhurtham'] },
  'With Peter Smith': {
    hint: 'Smith Household',
    email: 'peter@example.com',
    eventIds: ['muhurtham', 'reception'],
  },
}

type Body = { first: string; last: string; hint?: string; email?: string }

function hq(body: Body) {
  const name = `${body.first} ${body.last}`.trim().toLowerCase()
  if (name === 'john smith') {
    const households = Object.entries(SMITHS)
    const chosen =
      households.find(([, h]) => h.hint === body.hint) ??
      households.find(([, h]) => body.email && h.email === body.email.trim().toLowerCase())
    if (chosen) {
      const [, h] = chosen
      return {
        status: 'found',
        record: {
          displayName: 'John',
          hint: h.hint,
          eventIds: h.eventIds,
          events: { reception: event('reception', 'Reception') },
        },
      }
    }
    return {
      status: 'choose',
      options: households.map(([label, h]) => ({ hint: h.hint, label })),
      canVerifyEmail: body.email === undefined,
      ...(body.email !== undefined ? { emailFailed: true } : {}),
    }
  }
  if (name === 'gracie hopper') {
    // A spelling close to a guest's but not theirs: HQ confirms only by email.
    if (body.email?.trim().toLowerCase() === 'grace@example.com') {
      return { status: 'found', record: RECORDS['grace hopper'] }
    }
    return {
      status: 'choose',
      options: [],
      canVerifyEmail: body.email === undefined,
      ...(body.email !== undefined ? { emailFailed: true } : {}),
    }
  }
  if (name === 'lise meitner') {
    return { status: 'choose', options: [], canVerifyEmail: false }
  }
  if (name === 'emmy noether') {
    // Namesakes with nobody in either party to label them by, and no email.
    return {
      status: 'choose',
      options: [
        { hint: 'Noether North', label: 'Noether North' },
        { hint: 'Noether South', label: 'Noether South' },
      ],
      canVerifyEmail: false,
    }
  }
  const record = RECORDS[name]
  return record ? { status: 'found', record } : { status: 'not_found' }
}

let lookups: Body[]

const serveHq = (
  respond: (body: Body) => Promise<Response> | Response = (body) => Response.json(hq(body)),
) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('/guest/lookup')
      const body = JSON.parse(String(init?.body)) as Body
      lookups.push(body)
      return respond(body)
    }),
  )
}

beforeEach(() => {
  window.localStorage.clear()
  lookups = []
  serveHq()
})

afterEach(() => {
  vi.unstubAllGlobals()
  // Not just globals: the localStorage test spies on Storage.prototype, and an
  // unrestored spy there quietly swallows every later write.
  vi.restoreAllMocks()
})

const ids = (events: { id: string }[]) => events.map((e) => e.id)

async function signIn(first: string, last: string) {
  const hook = renderHook(() => useGuestSchedule())
  await waitFor(() => expect(hook.result.current.status).toBe('anonymous'))
  act(() => hook.result.current.lookup(first, last))
  return hook
}

describe('useGuestSchedule', () => {
  it('settles on anonymous with no remembered guest, without asking HQ anything', async () => {
    const { result } = renderHook(() => useGuestSchedule())

    await waitFor(() => expect(result.current.status).toBe('anonymous'))
    // Something useful is on screen before anyone types a name.
    expect(result.current.events).toEqual(universalEvents)
    expect(lookups).toEqual([])
  })

  it('shows a guest their own schedule, bundled and private events in their order', async () => {
    const { result } = await signIn('Alan', 'Turing')

    await waitFor(() => expect(result.current.status).toBe('identified'))
    expect(result.current.displayName).toBe('Alan')
    expect(ids(result.current.events)).toEqual([
      PELLIKUTHURU_EVENT_ID,
      GOLKONDA_STAY_EVENT_ID,
      'muhurtham',
      'kerala',
    ])
    // The ceremony's copy comes from the bundle, not from HQ.
    expect(result.current.events[2]).toBe(universalEvents.find((e) => e.id === 'muhurtham'))
    expect(result.current.isAdmin).toBe(true)
  })

  it('sends only the name', async () => {
    await signIn('Grace', 'Hopper')
    await waitFor(() => expect(lookups).toHaveLength(1))
    expect(lookups[0]).toEqual({ first: 'Grace', last: 'Hopper' })
  })

  it('reports a name that is not on the list', async () => {
    const { result } = await signIn('Nobody', 'Here')

    await waitFor(() => expect(result.current.status).toBe('notFound'))
    expect(result.current.events).toEqual(universalEvents)
  })

  it('says so when HQ cannot be reached, and keeps the main celebrations up', async () => {
    serveHq(() => new Response('{}', { status: 503 }))
    const { result } = await signIn('Grace', 'Hopper')

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.events).toEqual(universalEvents)
  })

  it('treats a network failure the same way', async () => {
    serveHq(() => Promise.reject(new Error('offline')))
    const { result } = await signIn('Grace', 'Hopper')

    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('asks which household when two guests share a name and differ', async () => {
    const { result } = await signIn('John', 'Smith')

    await waitFor(() => expect(result.current.status).toBe('ambiguous'))
    expect(result.current.candidates).toEqual(['With Mary Smith', 'With Peter Smith'])
    // Both households have an email on file, so the email check comes first.
    expect(result.current.emailPrompt).toBe(true)
    expect(result.current.emailFailed).toBe(false)
  })

  it('resolves silently when the offered email matches one household', async () => {
    const { result } = await signIn('John', 'Smith')
    await waitFor(() => expect(result.current.status).toBe('ambiguous'))

    act(() => result.current.submitEmail('  mary@example.com '))

    await waitFor(() => expect(result.current.status).toBe('identified'))
    expect(lookups.at(-1)).toEqual({ first: 'John', last: 'Smith', email: 'mary@example.com' })

    // The match also remembers the household, so a reload skips every prompt.
    const reloaded = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(reloaded.result.current.status).toBe('identified'))
    await waitFor(() =>
      expect(lookups.at(-1)).toEqual({ first: 'John', last: 'Smith', hint: 'Smith Family' }),
    )
  })

  it('falls back to the household choice when the email matches nothing', async () => {
    const { result } = await signIn('John', 'Smith')
    await waitFor(() => expect(result.current.status).toBe('ambiguous'))

    act(() => result.current.submitEmail('nobody@example.com'))

    await waitFor(() => expect(result.current.emailFailed).toBe(true))
    expect(result.current.emailPrompt).toBe(false)
    expect(result.current.status).toBe('ambiguous')

    // The buttons still work after the failed attempt.
    act(() => result.current.chooseCandidate(0))
    await waitFor(() => expect(result.current.status).toBe('identified'))
  })

  it('lets a guest skip the email check', async () => {
    const { result } = await signIn('John', 'Smith')
    await waitFor(() => expect(result.current.status).toBe('ambiguous'))

    act(() => result.current.skipEmail())

    expect(result.current.emailPrompt).toBe(false)
    expect(result.current.emailFailed).toBe(false)
    expect(result.current.status).toBe('ambiguous')
  })

  it('skips the email check when no household has one on file', async () => {
    const { result } = await signIn('Emmy', 'Noether')

    await waitFor(() => expect(result.current.status).toBe('ambiguous'))
    expect(result.current.emailPrompt).toBe(false)
    expect(result.current.candidates).toEqual(['Noether North', 'Noether South'])
  })

  describe('a close spelling HQ confirms only by email', () => {
    it('asks for the email, with no households to offer', async () => {
      const { result } = await signIn('Gracie', 'Hopper')

      await waitFor(() => expect(result.current.status).toBe('ambiguous'))
      expect(result.current.emailPrompt).toBe(true)
      expect(result.current.candidates).toEqual([])
    })

    it('shows the page once the email confirms them', async () => {
      const { result } = await signIn('Gracie', 'Hopper')
      await waitFor(() => expect(result.current.status).toBe('ambiguous'))

      act(() => result.current.submitEmail('grace@example.com'))

      await waitFor(() => expect(result.current.status).toBe('identified'))
      expect(result.current.displayName).toBe('Grace')

      // With no household to remember, a reload confirms by the same email.
      const reloaded = renderHook(() => useGuestSchedule())
      await waitFor(() => expect(reloaded.result.current.status).toBe('identified'))
      await waitFor(() =>
        expect(lookups.at(-1)).toEqual({
          first: 'Gracie',
          last: 'Hopper',
          email: 'grace@example.com',
        }),
      )
    })

    it('is not found when the email does not confirm them', async () => {
      const { result } = await signIn('Gracie', 'Hopper')
      await waitFor(() => expect(result.current.status).toBe('ambiguous'))

      act(() => result.current.submitEmail('nobody@example.com'))

      await waitFor(() => expect(result.current.status).toBe('notFound'))
      expect(result.current.emailFailed).toBe(true)
    })

    it('is not found when the guest skips the email', async () => {
      const { result } = await signIn('Gracie', 'Hopper')
      await waitFor(() => expect(result.current.status).toBe('ambiguous'))

      act(() => result.current.skipEmail())

      expect(result.current.status).toBe('notFound')
      expect(result.current.emailFailed).toBe(false)
    })

    it('is not found when nobody it could be has an email', async () => {
      const { result } = await signIn('Lise', 'Meitner')

      await waitFor(() => expect(result.current.status).toBe('notFound'))
      expect(result.current.emailPrompt).toBe(false)
    })
  })

  it('resolves the schedule once a household is chosen, by its hint', async () => {
    const { result } = await signIn('John', 'Smith')
    await waitFor(() => expect(result.current.status).toBe('ambiguous'))

    act(() => result.current.chooseCandidate(1))

    await waitFor(() => expect(result.current.status).toBe('identified'))
    expect(lookups.at(-1)).toEqual({ first: 'John', last: 'Smith', hint: 'Smith Household' })
    expect(ids(result.current.events)).toEqual(['muhurtham', 'reception'])
    expect(result.current.candidates).toEqual([])
  })

  it('shows a returning guest their page at once, then refreshes it from HQ', async () => {
    const first = await signIn('Grace', 'Hopper')
    await waitFor(() => expect(first.result.current.status).toBe('identified'))
    first.unmount()

    // HQ has moved on since: Grace is now invited to the Kerala trip too.
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    serveHq(async () => {
      await gate
      return Response.json({
        status: 'found',
        record: {
          displayName: 'Grace',
          eventIds: ['muhurtham', 'reception', 'kerala'],
          events: { reception: event('reception', 'Reception'), kerala: event('kerala', 'Kerala') },
        },
      })
    })

    const second = renderHook(() => useGuestSchedule())
    // Straight to identified from the cache — never anonymous, never resolving.
    await waitFor(() => expect(second.result.current.status).toBe('identified'))
    expect(ids(second.result.current.events)).toEqual(['muhurtham', 'reception'])

    release()
    await waitFor(() => expect(ids(second.result.current.events)).toContain('kerala'))
  })

  it('keeps a returning guest’s page up when HQ cannot be reached', async () => {
    const first = await signIn('Grace', 'Hopper')
    await waitFor(() => expect(first.result.current.status).toBe('identified'))
    first.unmount()

    serveHq(() => new Response('{}', { status: 503 }))
    const second = renderHook(() => useGuestSchedule())

    await waitFor(() => expect(lookups).toHaveLength(2))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(second.result.current.status).toBe('identified')
    expect(second.result.current.displayName).toBe('Grace')
  })

  it('takes the page away when HQ no longer knows the guest', async () => {
    const first = await signIn('Grace', 'Hopper')
    await waitFor(() => expect(first.result.current.status).toBe('identified'))
    first.unmount()

    serveHq(() => Response.json({ status: 'not_found' }))
    const second = renderHook(() => useGuestSchedule())

    await waitFor(() => expect(second.result.current.status).toBe('notFound'))
    expect(window.localStorage.getItem('schedule-record')).toBeNull()
  })

  it('never paints one guest’s cached page for another name', async () => {
    const first = await signIn('Grace', 'Hopper')
    await waitFor(() => expect(first.result.current.status).toBe('identified'))
    first.unmount()

    // Someone else's name ends up remembered on the same phone.
    window.localStorage.setItem(
      'schedule-guest',
      JSON.stringify({ first: 'Ada', last: 'Lovelace' }),
    )
    serveHq(() => new Promise<Response>(() => {}))
    const second = renderHook(() => useGuestSchedule())

    await waitFor(() => expect(second.result.current.status).toBe('resolving'))
    expect(second.result.current.displayName).toBeUndefined()
  })

  it('forgets the guest, and their cached page, on sign out', async () => {
    const { result, unmount } = await signIn('Grace', 'Hopper')
    await waitFor(() => expect(result.current.status).toBe('identified'))

    act(() => result.current.signOut())

    expect(result.current.status).toBe('anonymous')
    expect(result.current.displayName).toBeUndefined()
    expect(result.current.events).toEqual(universalEvents)
    expect(window.localStorage.getItem('schedule-record')).toBeNull()

    unmount()
    const reopened = renderHook(() => useGuestSchedule())
    await waitFor(() => expect(reopened.result.current.status).toBe('anonymous'))
  })

  it('ignores an answer that lands after sign out', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    serveHq(async (body) => {
      await gate
      return Response.json(hq(body))
    })
    const { result } = await signIn('Grace', 'Hopper')
    await waitFor(() => expect(result.current.status).toBe('resolving'))

    act(() => result.current.signOut())
    release()

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(result.current.status).toBe('anonymous')
  })

  it('survives localStorage being unavailable', async () => {
    // Private browsing rejects writes; the lookup still succeeded.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { result } = await signIn('Grace', 'Hopper')

    await waitFor(() => expect(result.current.status).toBe('identified'))
    expect(result.current.displayName).toBe('Grace')
  })

  it('records a Kerala guest, so the nav can offer that link', async () => {
    const { result } = await signIn('Alan', 'Turing')
    await waitFor(() => expect(result.current.status).toBe('identified'))

    expect(window.localStorage.getItem('schedule-kerala-invited')).toBe('true')
  })

  it('records nothing for a guest who is not on the Kerala trip', async () => {
    const { result } = await signIn('Ada', 'Lovelace')
    await waitFor(() => expect(result.current.status).toBe('identified'))

    expect(window.localStorage.getItem('schedule-kerala-invited')).toBeNull()
  })

  it('clears it again when a Kerala guest is replaced by one who is not', async () => {
    // Identifying as someone else must not leave the previous guest's link up.
    const { result } = await signIn('Alan', 'Turing')
    await waitFor(() => expect(result.current.status).toBe('identified'))
    expect(window.localStorage.getItem('schedule-kerala-invited')).toBe('true')

    act(() => result.current.signOut())
    act(() => result.current.lookup('Ada', 'Lovelace'))
    await waitFor(() => expect(result.current.displayName).toBe('Ada'))

    expect(window.localStorage.getItem('schedule-kerala-invited')).toBeNull()
  })

  it('carries the guest their Kerala trip choices, and forgets them on sign out', async () => {
    const { result } = await signIn('Vera', 'Rubin')
    await waitFor(() => expect(result.current.status).toBe('identified'))

    expect(result.current.kerala).toEqual({
      trip: 'full',
      flight: 'rt',
      occupancy: 'double',
      roommates: ['Carl Sagan'],
      priceOverride: 67440,
    })

    act(() => result.current.signOut())
    expect(result.current.kerala).toBeUndefined()
  })

  it('carries the guest their Golkonda room, and forgets it on sign out', async () => {
    const { result } = await signIn('Alan', 'Turing')
    await waitFor(() => expect(result.current.status).toBe('identified'))
    expect(result.current.golkonda).toBe('covered')

    act(() => result.current.signOut())
    expect(result.current.golkonda).toBeUndefined()
  })
})

describe('the event catalog', () => {
  it('gates the two event ids /hotels reads on the tags it assumes', () => {
    // /hotels reads "invited to the Pellikuthuru" and "tagged for a room at the
    // resort" off these ids because the catalog gates them on exactly those
    // tags. Nothing else ties the constants to the catalog, so this is the test
    // that goes red if the gate moves instead of the page silently showing the
    // wrong hotels. HQ gates by the same catalog (npm run import:site-events).
    const gateOf = (id: string) => catalog.events.find((e) => e.id === id)?.gate

    expect(gateOf(PELLIKUTHURU_EVENT_ID)).toBe('pellikuthuru')
    expect(gateOf(GOLKONDA_STAY_EVENT_ID)).toEqual(
      expect.arrayContaining(['hotel-golkonda-covered', 'hotel-golkonda-own']),
    )
  })
})
