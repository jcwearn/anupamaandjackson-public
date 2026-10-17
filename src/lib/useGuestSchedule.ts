import { useCallback, useEffect, useRef, useState } from 'react'
import { KERALA_EVENT_ID, universalEvents } from '../data/scheduleEvents'
import type { ScheduleEvent } from '../data/scheduleEvents'
import { setKeralaInvited } from './useNavItems'

/**
 * Served by functions/guest/lookup.ts, which asks Wedding HQ. Guests used to be
 * looked up here in the browser against an encrypted index of every guest —
 * a file anyone could download and try names against. Now only the name goes
 * out, and only that guest's own page comes back.
 */
const LOOKUP_URL = '/guest/lookup'
const STORAGE_KEY = 'schedule-guest'
/**
 * The last page HQ gave this guest, kept beside their name. A returning guest
 * sees their schedule at once, before the lookup comes back, and still sees it
 * if HQ is unreachable for a moment — a wedding week is the wrong time to show
 * someone an empty page because a server an ocean away is slow.
 */
const RECORD_KEY = 'schedule-record'

/** What HQ returns for a guest: their page, private event copy included. */
interface GuestRecord {
  displayName: string
  /** Raw party string, set only when the guest had to pick their household. */
  hint?: string
  admin?: boolean
  kerala?: KeralaGuestInfo
  golkonda?: GolkondaStay
  /** Omitted for guests not on the Golkonda room list. */
  golkondaRoom?: GolkondaRoom
  eventIds: string[]
  /** Copy for the private events in eventIds; universal ones are bundled. */
  events: Record<string, ScheduleEvent>
}

type LookupResult =
  | { status: 'found'; record: GuestRecord }
  | {
      status: 'choose'
      options: { hint: string; label: string }[]
      canVerifyEmail: boolean
      emailFailed?: boolean
    }
  | { status: 'not_found' }

/** The guest's Kerala trip-form choices, as Wedding HQ holds them. */
export interface KeralaGuestInfo {
  trip: 'full' | 'short'
  flight: 'rt' | 'ow'
  occupancy: 'single' | 'double'
  /** Full names of whoever shares their room; empty for single occupancy. */
  roommates: string[]
  /** In rupees, like the pricing table; replaces the table-derived price. */
  priceOverride?: number
  /**
   * Rupees off their price that we are paying for them. Comes off whichever
   * figure the two above settled on, and never off what the agent bills — see
   * `PriceChoice` in keralaPricing.ts for why that is a separate field.
   */
  hostCovers?: number
  /** Guest-specific pricing caveat (e.g. a roommate leaving a night early). */
  priceNote?: string
}

/**
 * Whether the guest's room at Golkonda is on us ('covered') or theirs to settle
 * ('own'). Absent unless the generator found all three of: a Golkonda tag, an
 * Attending muhurtham RSVP, and an answer accepting the room — see
 * `golkondaStay` in wedding-hq's src/shared/guestRules.ts. A guest on the
 * Golkonda room list has it whatever With Joy says, from their row's Self-pay
 * note — see `withRooms` in wedding-hq's src/worker/site.ts.
 */
export type GolkondaStay = 'covered' | 'own'

/**
 * The bed in a guest's Golkonda room, as the room list resolves it — what the
 * room is, turned over to what they asked for where the hotel can. `villa` is
 * the multi-bedroom villas and suites, which have no single bed to name.
 * `king-extra` and `king-sofa` are king rooms with a third guest, on an extra
 * bed or on the room's sofa cum bed.
 */
export type GolkondaBed = 'king' | 'twin' | 'king-extra' | 'king-sofa' | 'villa'

/**
 * The guest's own line on the Golkonda room list, which HQ reads from the
 * planners' sheet when someone presses Sync rooms there. Deliberately no room
 * number, no room type and no price: those stay with the planners, and how a
 * room is paid for is already said, for this guest only, by `golkonda`.
 */
export interface GolkondaRoom {
  bed: GolkondaBed
  /** Full roster names of whoever shares the room; empty when it is theirs alone. */
  roommates: string[]
  /** ISO dates, `2026-10-27`. */
  checkIn: string
  checkOut: string
}

export type GuestScheduleStatus =
  'loading' | 'anonymous' | 'resolving' | 'ambiguous' | 'identified' | 'notFound' | 'error'

export interface GuestScheduleState {
  status: GuestScheduleStatus
  /** Always renderable — falls back to the universal events. */
  events: ScheduleEvent[]
  /** Carries the `admin` With Joy tag; what /invites/links checks. */
  isAdmin: boolean
  displayName?: string
  /** The guest's own Kerala trip choices; absent without a form response. */
  kerala?: KeralaGuestInfo
  /** Set only for guests with a room held at Golkonda who are attending. */
  golkonda?: GolkondaStay
  /** Their room-list line, for guests on the Golkonda room list. */
  golkondaRoom?: GolkondaRoom
  /** Guest-facing party labels, only when several guests share the entered name. */
  candidates: string[]
  /** True while an ambiguous guest should be offered the email check first. */
  emailPrompt: boolean
  /** True after a submitted email matched no single record; also set alongside notFound. */
  emailFailed: boolean
  lookup: (first: string, last: string) => void
  submitEmail: (email: string) => void
  skipEmail: () => void
  chooseCandidate: (index: number) => void
  signOut: () => void
}

interface SavedGuest {
  first: string
  last: string
  /**
   * Household hint for guests who share a name with someone else. Stored as
   * the hint text rather than a position in the bucket: bucket order follows
   * roster row order, so a position would quietly start pointing at the other
   * household the first time a row is inserted above them.
   */
  hint?: string
  /**
   * The email that confirmed a spelling close to the guest's but not theirs
   * exactly. HQ takes no household hint for those, so a refresh sends this.
   */
  email?: string
}

function readSavedName(): SavedGuest | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveName(guest: SavedGuest) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(guest))
  } catch {
    // Private browsing can reject writes; the lookup still succeeded.
  }
}

interface CachedRecord extends SavedGuest {
  record: GuestRecord
}

function readCachedRecord(saved: SavedGuest): GuestRecord | null {
  try {
    const raw = window.localStorage.getItem(RECORD_KEY)
    const cached: CachedRecord | null = raw ? JSON.parse(raw) : null
    // Only for the same name: a cache left by whoever signed in last on a
    // shared phone must never paint for the next person.
    if (!cached || cached.first !== saved.first || cached.last !== saved.last) return null
    if ((cached.hint ?? '') !== (saved.hint ?? '')) return null
    if ((cached.email ?? '') !== (saved.email ?? '')) return null
    return cached.record
  } catch {
    return null
  }
}

function cacheRecord(saved: SavedGuest, record: GuestRecord) {
  try {
    window.localStorage.setItem(RECORD_KEY, JSON.stringify({ ...saved, record }))
  } catch {
    // As with the name: the guest still sees the page, just not offline.
  }
}

function forgetGuest() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(RECORD_KEY)
  } catch {
    // Ignore storage failures; state is reset either way.
  }
}

async function postLookup(body: SavedGuest): Promise<LookupResult> {
  const response = await fetch(LOOKUP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}

/** The guest's events in their own order, universal copy from the bundle. */
function eventsForRecord(record: GuestRecord): ScheduleEvent[] {
  return record.eventIds.flatMap((id) => {
    const event = universalEvents.find((bundled) => bundled.id === id) ?? record.events[id]
    return event ? [event] : []
  })
}

export function useGuestSchedule(): GuestScheduleState {
  const [status, setStatus] = useState<GuestScheduleStatus>('loading')
  const [events, setEvents] = useState<ScheduleEvent[]>(universalEvents)
  const [isAdmin, setIsAdmin] = useState(false)
  const [displayName, setDisplayName] = useState<string>()
  const [kerala, setKerala] = useState<KeralaGuestInfo>()
  const [golkonda, setGolkonda] = useState<GolkondaStay>()
  const [golkondaRoom, setGolkondaRoom] = useState<GolkondaRoom>()
  const [candidates, setCandidates] = useState<string[]>([])
  const [emailPrompt, setEmailPrompt] = useState(false)
  const [emailFailed, setEmailFailed] = useState(false)

  const pendingRef = useRef<{ first: string; last: string; hints: string[] } | null>(null)
  // Guards against a lookup landing after the component unmounts, after the
  // guest has signed out, or after a newer lookup has started.
  const activeRef = useRef(true)
  const generationRef = useRef(0)

  const applyRecord = useCallback((record: GuestRecord) => {
    const resolved = eventsForRecord(record)
    setEvents(resolved.length > 0 ? resolved : universalEvents)
    setIsAdmin(record.admin === true)
    setDisplayName(record.displayName)
    setKerala(record.kerala)
    setGolkonda(record.golkonda)
    setGolkondaRoom(record.golkondaRoom)
    setCandidates([])
    setEmailPrompt(false)
    setEmailFailed(false)
    setStatus('identified')
    // Off the resolved events rather than the record's raw ids: an event the
    // catalog no longer carries would otherwise still light up the nav link.
    setKeralaInvited(resolved.some((event) => event.id === KERALA_EVENT_ID))
  }, [])

  /**
   * Asks HQ and acts on the answer. `background` is a returning guest's
   * refresh behind a cached page: a failure there leaves the cached page up
   * rather than taking it away.
   */
  const resolve = useCallback(
    async (query: SavedGuest, background = false) => {
      const generation = ++generationRef.current
      if (!background) {
        setStatus('resolving')
        // A fresh lookup must not inherit a stale email sub-state.
        setEmailPrompt(false)
        setEmailFailed(false)
      }

      let result: LookupResult
      try {
        result = await postLookup(query)
      } catch {
        if (activeRef.current && generation === generationRef.current && !background) {
          setStatus('error')
        }
        return
      }
      if (!activeRef.current || generation !== generationRef.current) return

      const { first, last } = query
      if (result.status === 'found') {
        const saved = {
          first,
          last,
          ...(result.record.hint
            ? { hint: result.record.hint }
            : query.email
              ? { email: query.email }
              : {}),
        }
        saveName(saved)
        cacheRecord(saved, result.record)
        applyRecord(result.record)
        return
      }

      if (result.status === 'not_found') {
        // Off the list since last time, or never on it: either way the cached
        // page is no longer theirs to see.
        if (background) forgetGuest()
        setStatus('notFound')
        return
      }

      // A spelling close to a guest's but not theirs exactly: HQ offers no
      // households to pick from, only the email check, and without one there
      // is nobody to show.
      if (result.options.length === 0 && (!result.canVerifyEmail || result.emailFailed)) {
        if (background) forgetGuest()
        pendingRef.current = null
        setEmailFailed(result.emailFailed === true)
        setStatus('notFound')
        return
      }

      // More than one guest by this name, and their pages differ: ask which
      // household rather than guessing.
      pendingRef.current = { first, last, hints: result.options.map((option) => option.hint) }
      setCandidates(result.options.map((option) => option.label))
      setEmailPrompt(result.canVerifyEmail && !result.emailFailed)
      setEmailFailed(result.emailFailed === true)
      setStatus('ambiguous')
    },
    [applyRecord],
  )

  useEffect(() => {
    activeRef.current = true

    // localStorage is the external system here: the page is prerendered as
    // 'loading', with no storage to read, and must hydrate that way before
    // anything remembered on this device can show.
    const load = async () => {
      const saved = readSavedName()
      if (!saved) {
        setStatus('anonymous')
        return
      }
      const cached = readCachedRecord(saved)
      if (cached) applyRecord(cached)
      await resolve(saved, cached !== null)
    }

    void load()
    return () => {
      activeRef.current = false
    }
  }, [applyRecord, resolve])

  const submitEmail = useCallback(
    (email: string) => {
      const pending = pendingRef.current
      if (!pending) return
      void resolve({ first: pending.first, last: pending.last, email: email.trim() })
    },
    [resolve],
  )

  const skipEmail = useCallback(() => {
    setEmailPrompt(false)
    // With no households to fall back on, skipping the email leaves no way in.
    if (pendingRef.current?.hints.length === 0) setStatus('notFound')
  }, [])

  const chooseCandidate = useCallback(
    (choice: number) => {
      const pending = pendingRef.current
      const hint = pending?.hints[choice]
      if (!pending || hint === undefined) return
      void resolve({ first: pending.first, last: pending.last, hint })
    },
    [resolve],
  )

  const signOut = useCallback(() => {
    forgetGuest()
    generationRef.current += 1
    pendingRef.current = null
    setEvents(universalEvents)
    setIsAdmin(false)
    setDisplayName(undefined)
    setKerala(undefined)
    setGolkonda(undefined)
    setGolkondaRoom(undefined)
    setCandidates([])
    setEmailPrompt(false)
    setEmailFailed(false)
    setStatus('anonymous')
    // Takes the Kerala link back out of the nav along with everything else.
    setKeralaInvited(false)
  }, [])

  const lookup = useCallback(
    (first: string, last: string) => {
      void resolve({ first, last })
    },
    [resolve],
  )

  return {
    status,
    events,
    isAdmin,
    displayName,
    kerala,
    golkonda,
    golkondaRoom,
    candidates,
    emailPrompt,
    emailFailed,
    lookup,
    submitEmail,
    skipEmail,
    chooseCandidate,
    signOut,
  }
}
