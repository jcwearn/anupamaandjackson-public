import React, { useState, useEffect, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { useNavItems } from '../lib/useNavItems'
import { useScrolled } from '../lib/useScrolled'
import { WITHJOY_RSVP_URL } from '../lib/constants'
import { ExternalLinkIcon } from '../icons/ExternalLinkIcon'
import FloatingNav from './FloatingNav'
import GuestBadge from './GuestBadge'
import RsvpModal from './RsvpModal'

const SiteNav: React.FC = () => {
  const navItems = useNavItems()
  const scrolled = useScrolled()
  const [rsvpOpen, setRsvpOpen] = useState(false)
  const rsvpTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!rsvpOpen) return
    return () => rsvpTriggerRef.current?.focus()
  }, [rsvpOpen])

  return (
    <>
      <header
        className={clsx(
          'fixed inset-x-0 top-0 z-50 bg-rosewood border-b border-gold/30 transition-shadow duration-300',
          scrolled && 'shadow-md shadow-rosewood/30',
        )}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', viewTransitionName: 'site-nav' }}
      >
        {/* Equal 1fr side columns keep the link list centered in the viewport,
            but only while there's width for it: the right column is far wider
            than the wordmark, so once the row tightens every spare pixel lands
            in the left gap and the links slide into the guest pill. `gap-x-6`
            is the floor that keeps the three columns off each other when that
            happens — without it they measured 0px apart from `nav:` up to
            1024px. `xl:px-8` restores the roomier padding once it's affordable. */}
        <nav className="grid h-20 grid-cols-[1fr_auto_1fr] items-center gap-x-6 px-4 sm:px-6 xl:px-8">
          <Link
            to="/"
            viewTransition
            className="hidden justify-self-start whitespace-nowrap font-display text-xl text-cream transition-colors hover:text-peach focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 nav:block"
          >
            A & J
          </Link>
          {/* The link row grows every time a page is added — seven items once
              Kerala unlocks. `nav:` (880px) is where those seven still clear
              the wordmark and the RSVP pill at this compact size; below it
              FloatingNav's hamburger takes over. gap-3 rather than gap-4 is
              part of what pays for the column gap above — it buys back 24px
              across the six spaces. The roomier original spacing waits for xl,
              where there's width to spare for it. */}
          <ul className="hidden items-center gap-3 nav:flex xl:gap-6">
            {navItems.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  viewTransition
                  className={({ isActive }) =>
                    clsx(
                      'whitespace-nowrap font-body text-base transition-colors focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 xl:text-lg',
                      isActive
                        ? 'text-cream underline decoration-gold decoration-2 underline-offset-4'
                        : 'text-cream/80 hover:text-peach',
                    )
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
          {/* The guest badge shares the right column with RSVP. It's the piece
              that gives on a narrow row: gap-3 until xl, and the anonymous
              state is deliberately plain text rather than a second pill so it
              reads as an aside next to the RSVP call to action. */}
          <div className="hidden items-center gap-3 justify-self-end nav:flex xl:gap-4">
            <GuestBadge variant="bar" />
            <button
              ref={rsvpTriggerRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={rsvpOpen}
              onClick={() => setRsvpOpen(true)}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-gold/70 px-4 py-1.5 font-body text-base font-medium text-cream transition-colors hover:bg-gold hover:text-buccaneer focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2 cursor-pointer"
            >
              RSVP
              <ExternalLinkIcon className="h-4 w-4" />
            </button>
          </div>
        </nav>
      </header>
      <FloatingNav mobileOnly />
      <RsvpModal open={rsvpOpen} onClose={() => setRsvpOpen(false)} href={WITHJOY_RSVP_URL} />
    </>
  )
}

export default SiteNav
