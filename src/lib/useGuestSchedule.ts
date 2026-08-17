import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizedKey } from './guestName'
import type { Envelope } from './guestCrypto'
import {
  base64ToBytes,
  decryptJson,
  deriveGuestKey,
  emailHash,
  importEventKey,
  lookupHash,
} from './guestCrypto'
import { KERALA_EVENT_ID, universalEvents } from '../data/scheduleEvents'
import type { ScheduleEvent } from '../data/scheduleEvents'
import { setKeralaInvited } from './useNavItems'

const INDEX_URL = '/schedule-index.json'
const STORAGE_KEY = 'schedule-guest'

interface ScheduleIndex {
  v: number
  updatedAt: string
  kdf: { iterations: number; salt: string }
  events: Record<string, Envelope>
  guests: Record<string, Envelope[]>
}

/** The guest's Kerala trip-form choices, baked into their encrypted record. */
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
 * `golkondaStay` in scripts/lib/scheduleIndex.js.
 */
export type GolkondaStay = 'covered' | 'own'

interface GuestRecord {
  displayName: string
  /** Raw party string; stays the identity token persisted to localStorage. */
  hint?: string
  /** Guest-facing label ('With Venkat & Aditya Tadanki') shown instead of the hint. */
  hintLabel?: string
  /** Salted hashes of every email in the guest's party; absent when none on file. */
  emailHashes?: string[]
  /** Omitted rather than false by the generator, so absent means "not an admin". */
  admin?: boolean
  /** Omitted for guests who never filled out the trip form. */
  kerala?: KeralaGuestInfo
  /** Omitted unless a room at the resort is held for them and they're coming. */
  golkonda?: GolkondaStay
  eventIds: string[]
  /** Parallel to eventIds; null where the event is bundled, not encrypted. */
  keys: (string | null)[]
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
  /** Guest-facing party labels, only when several guests share the entered name. */
  candidates: string[]
  /** True while an ambiguous guest should be offered the email check first. */
  emailPrompt: boolean
  /** True after a submitted email matched no single record. */
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

/** Decrypts a guest's events, pulling universal copy from the bundle. */
async function eventsForRecord(
  record: GuestRecord,
  index: ScheduleIndex,
): Promise<ScheduleEvent[]> {
  const events: ScheduleEvent[] = []

  for (let i = 0; i < record.eventIds.length; i += 1) {
    const id = record.eventIds[i]
    const rawKey = record.keys[i]

    if (!rawKey) {
      const bundled = universalEvents.find((event) => event.id === id)
      if (bundled) events.push(bundled)
      continue
    }

    const envelope = index.events[id]
    if (!envelope) continue
    const key = await importEventKey(base64ToBytes(rawKey))
    const detail = await decryptJson<ScheduleEvent>(key, envelope)
    if (detail) events.push(detail)
  }

  return events
}

export function useGuestSchedule(): GuestScheduleState {
  const [status, setStatus] = useState<GuestScheduleStatus>('loading')
  const [events, setEvents] = useState<ScheduleEvent[]>(universalEvents)
  const [isAdmin, setIsAdmin] = useState(false)
  const [displayName, setDisplayName] = useState<string>()
  const [kerala, setKerala] = useState<KeralaGuestInfo>()
  const [golkonda, setGolkonda] = useState<GolkondaStay>()
  const [candidates, setCandidates] = useState<string[]>([])
  const [emailPrompt, setEmailPrompt] = useState(false)
  const [emailFailed, setEmailFailed] = useState(false)

  const indexRef = useRef<ScheduleIndex | null>(null)
  const pendingRef = useRef<{ first: string; last: string; records: GuestRecord[] } | null>(null)
  // Guards against a resolved lookup landing after the component unmounts or
  // after the guest has already signed out again.
  const activeRef = useRef(true)

  const applyRecord = useCallback(async (record: GuestRecord, index: ScheduleIndex) => {
    const resolved = await eventsForRecord(record, index)
    if (!activeRef.current) return
    setEvents(resolved.length > 0 ? resolved : universalEvents)
    setIsAdmin(record.admin === true)
    setDisplayName(record.displayName)
    setKerala(record.kerala)
    setGolkonda(record.golkonda)
    setCandidates([])
    setEmailPrompt(false)
    setEmailFailed(false)
    setStatus('identified')
    // Off the resolved events rather than the record's raw ids: an event the
    // catalog no longer carries would otherwise still light up the nav link.
    setKeralaInvited(resolved.some((event) => event.id === KERALA_EVENT_ID))
  }, [])

  const resolve = useCallback(
    async (first: string, last: string, savedHint?: string) => {
      const index = indexRef.current
      if (!index) {
        setStatus('error')
        return
      }

      setStatus('resolving')
      // A fresh lookup must not inherit a stale email sub-state.
      setEmailPrompt(false)
      setEmailFailed(false)
      const key = normalizedKey(first, last)
      const salt = base64ToBytes(index.kdf.salt)
      const bucket = index.guests[await lookupHash(key, salt)]

      if (!bucket) {
        if (activeRef.current) setStatus('notFound')
        return
      }

      const cryptoKey = await deriveGuestKey(key, salt, index.kdf.iterations)
      const records = (
        await Promise.all(bucket.map((entry) => decryptJson<GuestRecord>(cryptoKey, entry)))
      ).filter((record): record is GuestRecord => record !== null)

      if (!activeRef.current) return

      if (records.length === 0) {
        setStatus('notFound')
        return
      }

      // More than one record only survives the generator when the guests
      // sharing this name have genuinely different invite sets, so ask which
      // household rather than guessing.
      if (records.length > 1) {
        const remembered = savedHint
          ? records.find((record) => record.hint === savedHint)
          : undefined

        if (!remembered) {
          pendingRef.current = { first, last, records }
          setCandidates(records.map((record) => record.hintLabel ?? record.hint ?? ''))
          // Offer the email check first when any record can verify one; a
          // bucket with no emails on file goes straight to the choice buttons.
          setEmailPrompt(records.some((record) => (record.emailHashes ?? []).length > 0))
          setStatus('ambiguous')
          return
        }

        await applyRecord(remembered, index)
        return
      }

      saveName({ first, last })
      await applyRecord(records[0], index)
    },
    [applyRecord],
  )

  useEffect(() => {
    activeRef.current = true

    const load = async () => {
      try {
        const response = await fetch(INDEX_URL, { cache: 'no-cache' })
        // A missing index is expected until the first sync runs; treat it the
        // same as a failure and fall back to the universal events.
        if (!response.ok) throw new Error(String(response.status))
        indexRef.current = await response.json()
      } catch {
        if (activeRef.current) setStatus('error')
        return
      }

      if (!activeRef.current) return

      const saved = readSavedName()
      if (saved) await resolve(saved.first, saved.last, saved.hint)
      else setStatus('anonymous')
    }

    void load()
    return () => {
      activeRef.current = false
    }
  }, [resolve])

  const submitEmail = useCallback(
    (email: string) => {
      void (async () => {
        const pending = pendingRef.current
        const index = indexRef.current
        if (!pending || !index) return

        const hash = await emailHash(email.trim().toLowerCase(), base64ToBytes(index.kdf.salt))
        if (!activeRef.current) return

        const matches = pending.records.filter((record) => record.emailHashes?.includes(hash))
        // Anything but exactly one match — including one address shared by
        // both households — falls back to asking outright.
        if (matches.length !== 1) {
          setEmailPrompt(false)
          setEmailFailed(true)
          return
        }

        saveName({ first: pending.first, last: pending.last, hint: matches[0].hint })
        await applyRecord(matches[0], index)
      })()
    },
    [applyRecord],
  )

  const skipEmail = useCallback(() => {
    setEmailPrompt(false)
  }, [])

  const chooseCandidate = useCallback(
    (choice: number) => {
      const pending = pendingRef.current
      const index = indexRef.current
      if (!pending || !index) return
      const record = pending.records[choice]
      if (!record) return

      saveName({ first: pending.first, last: pending.last, hint: record.hint })
      void applyRecord(record, index)
    },
    [applyRecord],
  )

  const signOut = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore storage failures; state is reset either way.
    }
    pendingRef.current = null
    setEvents(universalEvents)
    setIsAdmin(false)
    setDisplayName(undefined)
    setKerala(undefined)
    setGolkonda(undefined)
    setCandidates([])
    setEmailPrompt(false)
    setEmailFailed(false)
    setStatus('anonymous')
    // Takes the Kerala link back out of the nav along with everything else.
    setKeralaInvited(false)
  }, [])

  const lookup = useCallback(
    (first: string, last: string) => {
      void resolve(first, last)
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
