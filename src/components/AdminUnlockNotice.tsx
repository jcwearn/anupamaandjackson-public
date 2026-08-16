import React, { useState } from 'react'
import type { AdminUnlockStatus } from '../lib/adminUnlock'

interface Props {
  status: AdminUnlockStatus
  onUnlock: (passphrase: string) => void
  /** What this passphrase opens, in the voice of the page asking for it. */
  blurb: string
}

/**
 * The passphrase prompt shared by the two admin pages.
 *
 * Separate from GuestGateNotice, which asks a guest who they are: that answer
 * is a name we already hold, and being wrong there is an ordinary mistake. This
 * asks for a secret, so it looks like a password field, autofills like one, and
 * says plainly when it did not work.
 */
const AdminUnlockNotice: React.FC<Props> = ({ status, onUnlock, blurb }) => {
  const [passphrase, setPassphrase] = useState('')
  const deriving = status === 'deriving'

  // Both admin pages fetch the index twice over — once for the guest's own
  // record, once for this block — and an admin who unlocked months ago would
  // otherwise watch a password field flash past on every visit.
  if (status === 'loading') return null

  if (status === 'error') {
    return (
      <div className="card mt-5 text-center">
        <p className="text-sm leading-relaxed text-zeus/80">
          We’re having trouble loading this page’s details right now. Try again in a little while.
        </p>
      </div>
    )
  }

  return (
    <form
      className="card mt-5 text-center"
      onSubmit={(event) => {
        event.preventDefault()
        if (!deriving && passphrase) onUnlock(passphrase)
      }}
    >
      <p className="text-sm leading-relaxed text-zeus/80">{blurb}</p>
      <input
        type="password"
        autoComplete="current-password"
        aria-label="Admin passphrase"
        value={passphrase}
        onChange={(event) => setPassphrase(event.target.value)}
        className="mt-4 w-full rounded-full border border-gold/50 bg-white/70 px-4 py-2 text-center font-body text-base text-zeus placeholder:text-zeus/40 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
        placeholder="Passphrase"
      />
      {status === 'wrong' ? (
        <p role="alert" className="mt-3 text-sm text-buccaneer">
          That’s not the passphrase. Try again.
        </p>
      ) : null}
      <button type="submit" disabled={deriving || !passphrase} className="btn-primary mt-4 text-sm">
        {/* The wait is a 600k-iteration PBKDF2, not a network round trip, so it
            says what it is rather than 'Loading…'. */}
        {deriving ? 'Unlocking…' : 'Unlock'}
      </button>
    </form>
  )
}

/**
 * The way back out, for a phone that gets handed around or lent to someone.
 * Sits at the foot of both unlocked pages rather than in the prompt above,
 * which by then is gone.
 */
export const AdminForgetButton: React.FC<{ onForget: () => void }> = ({ onForget }) => (
  <p className="mt-12 text-center text-sm text-zeus/60">
    <button
      type="button"
      onClick={onForget}
      className="underline decoration-rosewood/40 underline-offset-2 hover:text-rosewood"
    >
      Forget this device
    </button>
  </p>
)

export default AdminUnlockNotice
