import { useCallback, useEffect, useRef, useState } from 'react'
import type { Envelope } from './guestCrypto'
import type { InviteSide } from './inviteLink'
import {
  base64ToBytes,
  bytesToBase64,
  decryptJson,
  deriveAdminKeyBytes,
  importEventKey,
} from './guestCrypto'

const INDEX_URL = '/schedule-index.json'
const STORAGE_KEY = 'admin-unlock'

export type GuestSummaryStatus = 'attending' | 'declined' | 'none'

/** One row of the /guest-summary roster. `tag` is absent on either side's list. */
export interface GuestSummaryEntry {
  name: string
  tag?: 'vidya' | 'venkat'
  /**
   * Which side of the wedding, and so which family of invite pages is theirs.
   * A different axis from `tag` above, which splits Anupama's side between her
   * parents' lists — a guest can and usually does carry one of each.
   *
   * Optional only because the fixture roster carries deliberately untagged rows
   * and can build an index for local dev; every guest on the real roster has
   * one, and the sync fails rather than publish a guest who doesn't.
   */
  side?: InviteSide
  /**
   * The guest's events as letters in SUMMARY_EVENTS order: 'PSMR', 'PM', 'MR'.
   * Every event the table has a column for, which is one more than the three an
   * invitation is narrowed by — the pellikuthuru has its own tag and its own
   * RSVP column and no invitation of its own. With `side`, this still names
   * their invitation, by way of `inviteEventsIn` — see `inviteLinkFor`.
   *
   * Optional for the same reason as `side`, plus one the page has to survive:
   * this bundle and schedule-index.json deploy separately, so between shipping
   * the JS and the next sync the index in front of it is a version behind and
   * has neither field. An empty column beats a blank page.
   */
  events?: string
  /**
   * Which of `events` the guest has said yes to, and which no — the same
   * letters in the same order, each a subset of `events`. A letter in neither
   * is an event they were invited to and have not answered about.
   *
   * Two subsets rather than a verdict per event because `.includes(letter)` is
   * the question the table already asks three times a row, and because both
   * being optional is what keeps the stale-index case honest. Between shipping
   * this bundle and the next sync the index in front of it has neither field —
   * and neither does a guest on a current index who has answered nothing. Both
   * read as "no response", which is the one reading that is true either way. A
   * single field spelling out a verdict per event would have had to invent a
   * value meaning "this index is too old to say", and anything else it invented
   * would have been a claim about a guest.
   *
   * The same two words as `status` below, one level down: `status` is these
   * collapsed together with the pellikuthuru answer, which has no column on the
   * table. So a guest can be `attending` and still have declined an event here.
   */
  attending?: string
  declined?: string
  status: GuestSummaryStatus
  /**
   * Opaque household id, absent for guests who travel alone. Not the party's
   * name — the generator keeps that — just enough to tell that two adjacent
   * rows belong together. Entries sharing one are always adjacent in the
   * payload, which is what lets the page group them by a single pass.
   */
  party?: number
}

/**
 * One person in a room, as /admin/kerala-trip needs them.
 *
 * Deliberately not KeralaGuestInfo: that one is written from a single guest's
 * point of view and says `roommates`, which is the wrong shape for a table with
 * a row per room. `priceNote` is left off too — the admin page totals prices, it
 * does not explain them.
 */
export interface KeralaRoomOccupant {
  name: string
  trip: 'full' | 'short'
  flight: 'rt' | 'ow'
  occupancy: 'single' | 'double'
  /** What the guest was asked to pay, when it is not the rate card figure. */
  priceOverride?: number
  /**
   * Rupees of their share we are paying ourselves. Unlike the two fields either
   * side of it, this one moves what the guest owes without moving what the
   * agent bills, so it lands under "you are covering" rather than in the total.
   */
  hostCovers?: number
  /**
   * Nights their room is theirs alone because a roommate left early. What the
   * agent charges us on top of the rate card, which since one guest paid an
   * earlier figure is no longer the same as what they paid.
   */
  soleUseNights?: number
  /**
   * Whose trip this is. Their places are not money a guest owes us, so the
   * billing counts them as covered rather than as guests paying.
   */
  host?: boolean
  /** What they have sent us, which is not what the agent has been paid. */
  payment?: KeralaPayerRecord
}

/**
 * A guest's own transfer, in the dollars they were quoted and sent.
 *
 * `via: 'roommate'` is the guest whose share went in with someone else's
 * payment: no amount of their own, and `paidBy` names who covered them.
 */
export interface KeralaPayerRecord {
  usd?: number
  to?: 'anupama' | 'jackson'
  via: 'zelle' | 'venmo' | 'paypal' | 'roommate'
  paidBy?: string
}

/** `bed` is absent exactly when the room holds one person. */
export interface KeralaRoom {
  room: number
  bed?: 'double' | 'twin'
  occupants: KeralaRoomOccupant[]
}

/** A payment with no `date` is one whose receipt has not been dug out yet. */
export interface KeralaPayment {
  date?: string
  amount: number
  note?: string
}

/** `pct` of the total; a row without one is the remainder. */
export interface KeralaScheduledPayment {
  due: string
  pct?: number
  note?: string
}

export interface KeralaBilling {
  payments: KeralaPayment[]
  schedule: KeralaScheduledPayment[]
}

export interface KeralaTrip {
  rooms: KeralaRoom[]
  billing: KeralaBilling | null
}

interface AdminPayload {
  summary: GuestSummaryEntry[]
  /**
   * Optional for the reason `side` and `events` above are: this bundle and
   * schedule-index.json deploy separately, so between shipping the JS and the
   * next sync the index in front of it is a version behind and has no rooming
   * at all. The page says so rather than rendering a table of nothing.
   */
  keralaTrip?: KeralaTrip
}

interface AdminBlock {
  kdf: { iterations: number; salt: string }
  payload: Envelope
}

export type AdminUnlockStatus =
  | 'loading'
  | 'locked'
  | 'deriving'
  | 'unlocked'
  /** A passphrase was submitted and did not open the payload. */
  | 'wrong'
  | 'error'

export interface AdminUnlockState {
  status: AdminUnlockStatus
  summary: GuestSummaryEntry[]
  kerala: KeralaTrip | null
  unlock: (passphrase: string) => void
  forget: () => void
}

/**
 * The passphrase gate on the admin pages.
 *
 * Deliberately not folded into useGuestSchedule: that hook runs on every page
 * for every guest, and none of this belongs anywhere but the two pages that
 * ask for it.
 *
 * There is nothing here that checks a password and then decides what to render.
 * The passphrase *is* the AES key — a wrong one is an AES-GCM tag failure,
 * which `decryptJson` already reports as null — so a reader of the public
 * source learns how the lock works and still has nothing to open it with.
 */
export function useAdminUnlock(): AdminUnlockState {
  const [status, setStatus] = useState<AdminUnlockStatus>('loading')
  const [summary, setSummary] = useState<GuestSummaryEntry[]>([])
  const [kerala, setKerala] = useState<KeralaTrip | null>(null)

  const blockRef = useRef<AdminBlock | null>(null)
  // Guards a slow PBKDF2 landing after unmount, or after the admin has hit
  // "Forget this device" while it was still running.
  const activeRef = useRef(true)

  /** Returns the roster, or null when these bytes are not the right key. */
  const openWith = useCallback(async (keyBytes: Uint8Array) => {
    const block = blockRef.current
    if (!block) return null
    const key = await importEventKey(keyBytes)
    return decryptJson<AdminPayload>(key, block.payload)
  }, [])

  useEffect(() => {
    activeRef.current = true

    const load = async () => {
      try {
        const response = await fetch(INDEX_URL, { cache: 'no-cache' })
        if (!response.ok) throw new Error(String(response.status))
        const index = await response.json()
        blockRef.current = index.admin ?? null
      } catch {
        if (activeRef.current) setStatus('error')
        return
      }

      if (!activeRef.current) return
      // An index published before this feature has no admin block, and no
      // passphrase would ever open it.
      if (!blockRef.current) {
        setStatus('error')
        return
      }

      let stored: string | null = null
      try {
        stored = window.localStorage.getItem(STORAGE_KEY)
      } catch {
        // Private browsing can reject reads; treat it as never unlocked.
      }

      if (!stored) {
        setStatus('locked')
        return
      }

      // A stored key that no longer opens the payload means the passphrase was
      // rotated. Drop it and ask again rather than sitting on a dead key.
      const opened = await openWith(base64ToBytes(stored))
      if (!activeRef.current) return
      if (!opened) {
        forgetStoredKey()
        setStatus('locked')
        return
      }

      setSummary(opened.summary)
      setKerala(opened.keralaTrip ?? null)
      setStatus('unlocked')
    }

    void load()
    return () => {
      activeRef.current = false
    }
  }, [openWith])

  const unlock = useCallback(
    (passphrase: string) => {
      void (async () => {
        const block = blockRef.current
        if (!block) return

        setStatus('deriving')
        const keyBytes = await deriveAdminKeyBytes(
          passphrase,
          base64ToBytes(block.kdf.salt),
          block.kdf.iterations,
        )
        const opened = await openWith(keyBytes)
        if (!activeRef.current) return

        if (!opened) {
          setStatus('wrong')
          return
        }

        // The derived key, never the passphrase: whoever reads this later gets
        // something scoped to this one payload rather than a secret its owner
        // may have used elsewhere.
        try {
          window.localStorage.setItem(STORAGE_KEY, bytesToBase64(keyBytes))
        } catch {
          // Storage refused, so this unlock lasts the session. Still unlocked.
        }
        setSummary(opened.summary)
        setKerala(opened.keralaTrip ?? null)
        setStatus('unlocked')
      })()
    },
    [openWith],
  )

  const forget = useCallback(() => {
    forgetStoredKey()
    setSummary([])
    setKerala(null)
    setStatus('locked')
  }, [])

  return { status, summary, kerala, unlock, forget }
}

function forgetStoredKey() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing was stored if the write failed in the first place.
  }
}
