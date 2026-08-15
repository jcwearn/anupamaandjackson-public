import React, { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { useGuestScheduleContext } from '../lib/GuestScheduleProvider'

interface Props {
  /**
   * `bar` sits on SiteNav's rosewood bar, where the row is crowded and the
   * sign-out has to hide behind a tap; `menu` is FloatingNav's light dropdown,
   * which has the room to lay both parts out flat.
   */
  variant: 'bar' | 'menu'
  /** Lets FloatingNav close its dropdown when the badge is used. */
  onAction?: () => void
}

const UNLOCK_COPY = {
  heading: 'Unlock your details',
  blurb:
    'Add your name as it appears on your invitation and we’ll tailor the schedule and travel tips to your celebrations.',
  submitLabel: 'Unlock',
}

const menuItemClass =
  'block w-full cursor-pointer rounded-lg px-3 py-2 text-left font-body text-base text-zeus transition-colors hover:bg-peach/40'

/**
 * The site-wide answer to "does this page know who I am?".
 *
 * Guest state used to be legible only on the Schedule page, which made every
 * other personalized section look like the whole story whether you'd unlocked
 * or not. Keeping the answer in the nav means guests learn it once, in a place
 * that follows them, instead of per page.
 */
const GuestBadge: React.FC<Props> = ({ variant, onAction }) => {
  const { status, displayName, signOut, openUnlock, available } = useGuestScheduleContext()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popoverOpen) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopoverOpen(false)
    }
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointerDown)
    }
  }, [popoverOpen])

  // Nothing to say before the index has loaded, in a layout with no guest state
  // (the invite and save-the-date pages share FloatingNav), or when the index
  // failed — an unlock that can't succeed is worse than silence, and the pages
  // that care already explain the failure inline.
  if (!available || status === 'loading' || status === 'error') return null

  const bar = variant === 'bar'

  const unlock = () => {
    onAction?.()
    openUnlock(UNLOCK_COPY)
  }

  const out = () => {
    setPopoverOpen(false)
    onAction?.()
    signOut()
  }

  if (status !== 'identified') {
    return (
      <button
        type="button"
        onClick={unlock}
        // The bar shows the short label and carries the full one as its
        // accessible name. Measured, not guessed: at the nav: breakpoint the
        // link row leaves this column only its 24px gap, and spelling out
        // "Unlock your details" there runs the RSVP pill 5px past the right
        // edge of the viewport once Kerala's link is showing. It comes back
        // clear at 900px. The dropdown has the room, so it says it in full.
        aria-label={bar ? 'Unlock your details' : undefined}
        className={clsx(
          'cursor-pointer whitespace-nowrap font-body transition-colors focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2',
          bar
            ? 'text-sm text-cream/70 underline decoration-gold/50 underline-offset-4 hover:text-peach'
            : menuItemClass,
        )}
      >
        {bar ? 'Unlock' : 'Unlock your details'}
      </button>
    )
  }

  if (!bar) {
    return (
      <>
        <p className="flex items-center gap-2 px-3 py-2 font-body text-base text-zeus">
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-fern" />
          <span className="sr-only">Signed in as&nbsp;</span>
          {displayName}
        </p>
        <button type="button" onClick={out} className={clsx(menuItemClass, 'text-sm text-zeus/70')}>
          Not you? Sign out
        </button>
      </>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={popoverOpen}
        // Labelled rather than relying on the visible text: the name alone
        // ("Grace") says nothing about what the control does.
        aria-label={`Signed in as ${displayName}`}
        onClick={() => setPopoverOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-cream/15 px-3 py-1 font-body text-sm text-cream transition-colors hover:bg-cream/25 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
        {displayName}
      </button>

      {popoverOpen && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-48 rounded-xl border border-gold/30 bg-white/95 p-2 shadow-xl backdrop-blur"
        >
          <p className="px-2 pt-1 pb-2 font-body text-xs text-zeus/60">
            You’re seeing the events on your invitation.
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={out}
            className="block w-full cursor-pointer rounded-lg px-2 py-1.5 text-left font-body text-sm text-zeus transition-colors hover:bg-peach/40"
          >
            Not you? Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default GuestBadge
