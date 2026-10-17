import React, { useEffect, useId, useRef } from 'react'
import type { GolkondaRoom } from '../lib/useGuestSchedule'
import { BED_LABEL, nightsCount, nightsRange, roommatesLabel } from '../lib/golkondaStay'

type GolkondaStayModalProps = {
  open: boolean
  onClose: () => void
  room: GolkondaRoom
  displayName?: string
}

/**
 * The guest's own line on the Golkonda room list: who they share with, the bed
 * and the nights. Follows RsvpModal's conventions (Escape, scroll lock, focus
 * to the close button, backdrop click) and borrows the Kerala "Your Trip"
 * card's panel, so the two personal summaries on the site read as one family.
 *
 * Nothing here about the room number, the room type or money. The planners and
 * the front desk have the first two; the card behind this already says, for
 * this guest alone, whether there is anything to settle.
 */
const GolkondaStayModal: React.FC<GolkondaStayModalProps> = ({
  open,
  onClose,
  room,
  displayName,
}) => {
  const closeRef = useRef<HTMLButtonElement>(null)
  const headingId = useId()

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0)

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      window.clearTimeout(focusTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4"
      style={{ pointerEvents: open ? 'auto' : 'none' }}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className="absolute inset-0 bg-zeus/60 backdrop-blur-sm"
        style={{
          opacity: open ? 1 : 0,
          transition: 'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative w-full max-w-md rounded-2xl bg-peach p-6 shadow-2xl"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'scale(1)' : 'scale(0.96)',
          transition:
            'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zeus/60 transition-colors hover:bg-zeus/5 hover:text-zeus"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="h-4 w-4">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>

        {displayName && (
          <p className="pr-8 font-body text-xs uppercase tracking-wide text-zeus/60">
            For {displayName}
          </p>
        )}
        <h2 id={headingId} className="mt-1 pr-8 font-display text-2xl text-rosewood">
          Your Golkonda Stay
        </h2>

        {/* The Kerala card's panel: muted eyebrows over big serif values. */}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 rounded-lg border border-gold/40 bg-white/60 px-4 py-4 font-body">
          <div>
            <dt className="text-xs uppercase tracking-wide text-zeus/60">Room</dt>
            <dd>
              <p className="mt-1.5 font-display text-2xl leading-tight text-rosewood">
                {BED_LABEL[room.bed]}
              </p>
              {/* Who they wake up next to is the fact guests scan for — full
                  ink, not the muted detail shade, as on the Kerala card. */}
              <p className="mt-1.5 text-sm font-medium text-zeus">
                {roommatesLabel(room.roommates)}
              </p>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zeus/60">Nights</dt>
            <dd>
              <p className="mt-1.5 font-display text-2xl leading-tight text-rosewood">
                {nightsRange(room.checkIn, room.checkOut)}
              </p>
              <p className="mt-1.5 text-sm text-zeus/80">
                {nightsCount(room.checkIn, room.checkOut)}
              </p>
            </dd>
          </div>
        </dl>

        <p className="mt-3 font-body text-xs text-zeus/60">
          Does anything here look wrong? Let us know and we’ll fix it.
        </p>
      </div>
    </div>
  )
}

export default GolkondaStayModal
