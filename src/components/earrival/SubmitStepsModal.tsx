import React, { useEffect, useId, useRef } from 'react'
import SubmitSteps from './SubmitSteps'

type SubmitStepsModalProps = {
  open: boolean
  onClose: () => void
  portalUrl: string
}

/**
 * Stands between the "Fill it out on the official portal" button and the
 * portal itself, repeating what happens after Submit. The same steps sit in a
 * card right under the button, but a guest heading for the portal clicks
 * straight past it, and the step they miss — wait, don't press Submit again —
 * is the one the portal punishes.
 *
 * It is that card, lifted off the page: same border, same heading, same
 * width — 40rem is the page column's max-w-2xl less its px-4, and the
 * overlay's p-4 matches that gutter on a phone — with the buttons added
 * underneath. Even a few pixels' difference shows: the two snapshots
 * crossfade mid-morph, and their text drifts apart and ghosts. The page opens it inside a view
 * transition, and the shared `submit-steps` name morphs the card into this
 * panel and back again on close (see the e-Arrival rules in globals.css). It
 * only renders while open, because a view transition needs the name to move
 * from one element to the other, not to live on both.
 *
 * Follows GolkondaStayModal's conventions (Escape, scroll lock, focus on open,
 * backdrop click). Focus goes to the continue link rather than the close
 * button, because continuing is what nearly everyone came to do.
 */
const SubmitStepsModal: React.FC<SubmitStepsModalProps> = ({ open, onClose, portalUrl }) => {
  const continueRef = useRef<HTMLAnchorElement>(null)
  const headingId = useId()

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => continueRef.current?.focus(), 0)

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      window.clearTimeout(focusTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  // A tint and no blur, unlike GolkondaStayModal. Chrome leaves
  // backdrop-filter out of a view transition's snapshots, so a blurred
  // backdrop tinted the page during the morph and only blurred it, all at
  // once, when the morph finished.
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div onClick={onClose} className="animate-backdrop-fade-in absolute inset-0 bg-zeus/60" />
      {/* lily/30 on its own is see-through, so both this panel and the card
          it grows out of stack the page's layers underneath — the body's
          #fff4f8, then the page's peach/20 — to land on the same solid
          colour. Left translucent, the card's snapshot let the portal button
          behind it show through mid-morph. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="relative w-full max-w-[40rem] overflow-hidden rounded-xl border-2 border-gold/70 bg-[#fff4f8] shadow-2xl"
        style={{ viewTransitionName: 'submit-steps' }}
      >
        <div className="bg-peach/20">
          <div className="bg-lily/30 p-4 font-body text-sm leading-relaxed text-zeus/80">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-2 right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zeus/60 transition-colors hover:bg-zeus/5 hover:text-zeus"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="h-4 w-4">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>

            <h2 id={headingId} className="pr-8 font-display text-lg text-rosewood">
              What happens when you submit
            </h2>
            <div className="mt-2">
              <SubmitSteps />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <a
                ref={continueRef}
                href={portalUrl}
                target="_blank"
                rel="noreferrer"
                onClick={onClose}
                className="btn-primary"
              >
                Got it — open the portal →
              </a>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer text-sm text-zeus/70 underline hover:text-rosewood"
              >
                Not yet
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubmitStepsModal
