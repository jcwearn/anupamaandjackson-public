import React from 'react'
import { useGuestScheduleContext } from '../lib/GuestScheduleProvider'
import type { UnlockCopy } from '../lib/GuestScheduleProvider'

interface Props {
  /** What the guest gets by unlocking, in the voice of the section it sits in. */
  lockedBlurb: React.ReactNode
  /** Call to action on the locked prompt, e.g. 'Unlock Your Events'. */
  unlockLabel: string
  /** Wording for the dialog this opens; defaults to the Schedule page's. */
  unlockCopy?: UnlockCopy
}

/**
 * The shared "this section knows who you are — or could" marker.
 *
 * Pages that vary by guest are easy to miss: the content simply looks like the
 * whole story either way. This says which of the two you're reading, and gives
 * the anonymous half a way in without leaving the page.
 *
 * It never hides the section's generic advice — callers render that above and
 * drop this underneath, so an unidentified guest is still told something useful.
 */
const GuestGateNotice: React.FC<Props> = ({ lockedBlurb, unlockLabel, unlockCopy }) => {
  const { status, displayName, signOut, openUnlock, openJoy } = useGuestScheduleContext()

  if (status === 'identified') {
    return (
      <p className="mt-5 rounded-lg bg-lily/25 px-3 py-2 text-sm text-zeus/80">
        <span aria-hidden="true" className="mr-1.5 text-rosewood">
          ✓
        </span>
        Showing your invitation, {displayName}.{' '}
        <button
          type="button"
          onClick={signOut}
          className="underline decoration-rosewood/40 underline-offset-2 hover:text-rosewood"
        >
          Not you?
        </button>
      </p>
    )
  }

  // A missing or unreadable index is the one state with no way forward here, so
  // it points at Joy instead of offering a lookup that can't succeed.
  if (status === 'error') {
    return (
      <p className="mt-5 rounded-lg bg-lily/25 px-3 py-2 text-sm text-zeus/80">
        We’re having trouble loading personalized details right now —{' '}
        <button
          type="button"
          onClick={openJoy}
          className="underline decoration-rosewood/40 underline-offset-2 hover:text-rosewood"
        >
          view your full details on Joy
        </button>
        .
      </p>
    )
  }

  return (
    <div className="card mt-5 text-center">
      <p className="text-sm leading-relaxed text-zeus/80">{lockedBlurb}</p>
      <button
        type="button"
        onClick={() => openUnlock(unlockCopy)}
        disabled={status === 'loading'}
        className="btn-primary mt-4 text-sm"
      >
        {unlockLabel}
      </button>
    </div>
  )
}

export default GuestGateNotice
