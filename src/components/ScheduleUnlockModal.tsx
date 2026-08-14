import React, { useEffect, useId, useRef, useState } from 'react'
import clsx from 'clsx'
import type { GuestScheduleStatus } from '../lib/useGuestSchedule'

type Props = {
  open: boolean
  onClose: () => void
  status: GuestScheduleStatus
  candidates: string[]
  emailPrompt: boolean
  emailFailed: boolean
  onSubmit: (first: string, last: string) => void
  onSubmitEmail: (email: string) => void
  onSkipEmail: () => void
  onChooseCandidate: (index: number) => void
  onViewOnJoy: () => void
  /** Wording for the surface that opened this; defaults suit the Schedule page. */
  heading?: string
  blurb?: string
  submitLabel?: string
}

/**
 * Follows RsvpModal's conventions — Escape to close, body scroll lock, focus
 * moved in on open — but focuses the first field rather than the close button,
 * since the whole point of opening this is to type a name.
 */
const ScheduleUnlockModal: React.FC<Props> = ({
  open,
  onClose,
  status,
  candidates,
  emailPrompt,
  emailFailed,
  onSubmit,
  onSubmitEmail,
  onSkipEmail,
  onChooseCandidate,
  onViewOnJoy,
  heading = 'Unlock your schedule',
  blurb = 'Add your name as it appears on your invitation and we’ll show you the events you’re invited to.',
  submitLabel = 'Unlock Your Schedule',
}) => {
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [email, setEmail] = useState('')
  const firstRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const headingId = useId()
  const busy = status === 'resolving'
  const showEmail = status === 'ambiguous' && emailPrompt

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => firstRef.current?.focus(), 0)

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      window.clearTimeout(focusTimer)
    }
  }, [open, onClose])

  // The email step appears mid-flight, after the name form already took focus.
  useEffect(() => {
    if (open && showEmail) emailRef.current?.focus()
  }, [open, showEmail])

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
        className="relative w-full max-w-sm rounded-2xl bg-peach p-6 shadow-2xl"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'scale(1)' : 'scale(0.96)',
          transition:
            'opacity 300ms cubic-bezier(0.4, 0, 0.2, 1), transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-zeus/60 transition-colors hover:bg-zeus/5 hover:text-zeus"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="h-4 w-4">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>

        <h2 id={headingId} className="pr-8 font-display text-2xl text-rosewood">
          {heading}
        </h2>

        {showEmail ? (
          <>
            <p className="mt-2 font-body text-sm text-zeus/80">
              We have more than one guest by that name. Enter the email you RSVP’d with and
              we’ll find your invitation.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (email.trim()) onSubmitEmail(email)
              }}
              className="mt-4 flex flex-col gap-3"
            >
              <label className="flex flex-col gap-1 text-left">
                <span className="text-xs uppercase tracking-wide text-zeus/60">Email</span>
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  className="rounded-md border border-rosewood/20 bg-white/70 px-3 py-2 font-body text-zeus focus:border-rosewood focus:outline-none"
                />
              </label>

              <button type="submit" className="btn-primary mt-1 w-full">
                Find My Invitation
              </button>
            </form>
            <p className="mt-3 font-body text-sm text-zeus/80">
              <button
                type="button"
                onClick={onSkipEmail}
                className="underline decoration-rosewood/40 underline-offset-2 hover:text-rosewood"
              >
                I didn’t share an email
              </button>
            </p>
          </>
        ) : status === 'ambiguous' ? (
          <>
            <p className="mt-2 font-body text-sm text-zeus/80">
              We have more than one guest by that name — which one is you?
            </p>
            {emailFailed && (
              <p role="status" className="mt-2 font-body text-sm text-zeus/80">
                We couldn’t match that email — pick your party below.
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {candidates.map((label, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => onChooseCandidate(index)}
                  className="btn-primary w-full"
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 font-body text-sm text-zeus/80">{blurb}</p>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (first.trim()) onSubmit(first, last)
              }}
              className="mt-4 flex flex-col gap-3"
            >
              <label className="flex flex-col gap-1 text-left">
                <span className="text-xs uppercase tracking-wide text-zeus/60">First name</span>
                <input
                  ref={firstRef}
                  value={first}
                  onChange={(event) => setFirst(event.target.value)}
                  autoComplete="given-name"
                  required
                  className="rounded-md border border-rosewood/20 bg-white/70 px-3 py-2 font-body text-zeus focus:border-rosewood focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1 text-left">
                <span className="text-xs uppercase tracking-wide text-zeus/60">Last name</span>
                <input
                  value={last}
                  onChange={(event) => setLast(event.target.value)}
                  autoComplete="family-name"
                  className="rounded-md border border-rosewood/20 bg-white/70 px-3 py-2 font-body text-zeus focus:border-rosewood focus:outline-none"
                />
              </label>

              <button
                type="submit"
                disabled={busy}
                className={clsx('btn-primary mt-1 w-full', busy && 'opacity-60')}
              >
                {busy ? 'Looking…' : submitLabel}
              </button>
            </form>

            {status === 'notFound' && (
              <p role="status" className="mt-3 font-body text-sm text-zeus/80">
                We couldn’t find that name — it may be recorded slightly differently on our guest
                list. Try the spelling on your invitation, or{' '}
                <button
                  type="button"
                  onClick={onViewOnJoy}
                  className="underline decoration-rosewood/40 underline-offset-2 hover:text-rosewood"
                >
                  view your details on Joy
                </button>
                .
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default ScheduleUnlockModal
