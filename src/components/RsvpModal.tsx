import React, { useEffect, useId, useRef, useState } from 'react'
import { CopyIcon, CheckIcon } from '../icons/CopyIcon'
import { WITHJOY_HOMEPAGE_URL } from '../lib/constants'

const RSVP_PASSWORD = 'mangopickle'

type RsvpModalProps = {
  open: boolean
  onClose: () => void
  heading?: string
  description?: string
  ctaLabel?: string
  /** Where the CTA lands. Defaults to Joy's homepage; pass WITHJOY_RSVP_URL to
   *  drop guests straight onto the RSVP form. */
  href?: string
}

const RsvpModal: React.FC<RsvpModalProps> = ({
  open,
  onClose,
  heading = 'Before you RSVP',
  description = 'Use this password to view our RSVP page on Joy.',
  ctaLabel = 'RSVP',
  href = WITHJOY_HOMEPAGE_URL,
}) => {
  const [copied, setCopied] = useState(false)
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

  useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(t)
  }, [copied])

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(RSVP_PASSWORD)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4"
      style={{
        pointerEvents: open ? 'auto' : 'none',
      }}
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
        className="relative w-full max-w-sm bg-peach rounded-2xl shadow-2xl p-6"
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
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-zeus/60 hover:text-zeus hover:bg-zeus/5 transition-colors cursor-pointer"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="w-4 h-4">
            <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>

        <h2 id={headingId} className="font-display text-2xl text-rosewood pr-8">
          {heading}
        </h2>
        <p className="mt-2 font-body text-sm text-zeus/80">{description}</p>

        <div className="mt-4">
          <div className="text-xs font-body uppercase tracking-wide text-zeus/60 mb-1.5">
            Password
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/70 border border-rosewood/20 rounded-md px-3 py-2 font-mono text-zeus select-all">
              {RSVP_PASSWORD}
            </div>
            <button
              type="button"
              onClick={copyPassword}
              aria-label={copied ? 'Password copied' : 'Copy password'}
              className="w-10 h-10 flex items-center justify-center rounded-md border border-rosewood/20 bg-white/70 hover:bg-white text-zeus transition-colors cursor-pointer"
            >
              {copied ? (
                <CheckIcon className="w-4 h-4 text-fern" />
              ) : (
                <CopyIcon className="w-4 h-4" />
              )}
            </button>
          </div>
          <div role="status" aria-live="polite" className="sr-only">
            {copied ? 'Password copied to clipboard' : ''}
          </div>
        </div>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${ctaLabel} (opens in a new tab)`}
          className="mt-6 block w-full text-center bg-rosewood/90 hover:bg-rosewood text-cream font-body rounded-full font-medium shadow-lg py-2.5 transition-colors duration-150"
        >
          {ctaLabel}
        </a>
      </div>
    </div>
  )
}

export default RsvpModal
