import React, { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useNavItems } from '../lib/useNavItems'
import { ExternalLinkIcon } from '../icons/ExternalLinkIcon'
import GuestBadge from './GuestBadge'
import RsvpModal from './RsvpModal'
import { WITHJOY_RSVP_URL } from '../lib/constants'

type FloatingNavProps = {
  mobileOnly?: boolean
  hidden?: boolean
}

// Covers the longest close animation below (menu fade and icon morph, both
// 100ms) so navigation's view-transition snapshot never catches the menu
// mid-close — that snapshot swaps unanimated and would flash the menu back.
const MENU_CLOSE_MS = 100

const FloatingNav: React.FC<FloatingNavProps> = ({ mobileOnly = false, hidden = false }) => {
  const navItems = useNavItems()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [rsvpOpen, setRsvpOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  // The trigger lives in the dropdown, which is hidden again by the time the
  // modal closes, so return focus to the hamburger instead.
  useEffect(() => {
    if (!rsvpOpen) return
    // Captured here rather than read in the cleanup; see SiteNav.
    const hamburger = menuButtonRef.current
    return () => hamburger?.focus()
  }, [rsvpOpen])

  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  return (
    <>
      {/* The brand pill only accompanies SiteNav's bar (mobileOnly); pill-only pages get just the hamburger */}
      {mobileOnly && (
        <Link
          to="/"
          viewTransition
          className="fixed z-50 flex h-11 items-center rounded-full bg-cream px-4 font-display text-lg text-rosewood shadow-lg transition-colors hover:bg-white nav:hidden"
          style={{
            // 1.125rem centers the h-11 pill in SiteNav's h-20 bar; pill-only
            // pages use the same offset so the pills never shift between pages.
            top: 'calc(env(safe-area-inset-top, 0px) + 1.125rem)',
            left: 'calc(env(safe-area-inset-left, 0px) + 0.75rem)',
            viewTransitionName: 'floating-nav-brand',
          }}
        >
          A & J
        </Link>
      )}
      <div
        ref={containerRef}
        // While open, the dropdown must beat page overlays that share z-50
        // (e.g. the invite envelope's full-card "Tap to Open" button, which
        // comes later in the DOM and would otherwise swallow menu taps);
        // stays below the RSVP modal (z-60).
        className={clsx('fixed', open ? 'z-[58]' : 'z-50', mobileOnly && 'nav:hidden')}
        style={{
          top: 'calc(env(safe-area-inset-top, 0px) + 1.125rem)',
          right: 'calc(env(safe-area-inset-right, 0px) + 0.75rem)',
          viewTransitionName: 'floating-nav-menu',
          // Fades in step with Invite's zoomed-state controls: out right away,
          // back in after the un-zoom settles.
          opacity: hidden ? 0 : 1,
          pointerEvents: hidden ? 'none' : undefined,
          transition: hidden ? 'opacity 300ms ease-out' : 'opacity 300ms ease-out 600ms',
        }}
      >
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle navigation menu"
          aria-haspopup="menu"
          aria-expanded={open}
          className={clsx(
            'flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-colors',
            // On SiteNav pages the pills sit on the rosewood bar, so they flip
            // light; pill-only pages (invites, save-the-date) have no bar and
            // keep the rosewood-on-light look.
            mobileOnly
              ? 'bg-cream text-rosewood hover:bg-white'
              : 'bg-rosewood/95 text-cream hover:bg-rosewood',
          )}
        >
          <span className="relative flex h-4 w-5 flex-col justify-between">
            <span
              className={clsx(
                'block h-0.5 w-full bg-current transition-transform duration-100',
                open && 'translate-y-[7px] rotate-45',
              )}
            />
            <span
              className={clsx(
                'block h-0.5 w-full bg-current transition-opacity duration-100',
                open && 'opacity-0',
              )}
            />
            <span
              className={clsx(
                'block h-0.5 w-full bg-current transition-transform duration-100',
                open && '-translate-y-[7px] -rotate-45',
              )}
            />
          </span>
        </button>

        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-gold/30 bg-white/95 p-2 shadow-xl backdrop-blur transition-[opacity,transform] duration-100"
          style={{
            opacity: open ? 1 : 0,
            transform: open ? 'scale(1)' : 'scale(0.95)',
            pointerEvents: open ? 'auto' : 'none',
          }}
        >
          {navItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              viewTransition
              role="menuitem"
              onClick={(e) => {
                setOpen(false)
                // Modifier/middle clicks keep the browser's default handling
                // (e.g. open in new tab); plain clicks wait for the close
                // animation before navigating.
                if (e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
                e.preventDefault()
                window.setTimeout(() => navigate(n.to, { viewTransition: true }), MENU_CLOSE_MS)
              }}
              className={({ isActive }) =>
                clsx(
                  'block rounded-lg px-3 py-2 font-body text-base transition-colors hover:bg-peach/40',
                  isActive
                    ? 'text-rosewood font-semibold underline decoration-gold decoration-2 underline-offset-4'
                    : 'text-zeus',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
          <div className="my-1 border-t border-gold/20" />
          <GuestBadge variant="menu" onAction={() => setOpen(false)} />
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={rsvpOpen}
            onClick={() => {
              setOpen(false)
              setRsvpOpen(true)
            }}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-full border border-gold/60 px-3 py-1.5 font-body text-base font-medium text-zeus transition-colors hover:bg-peach/60 cursor-pointer"
          >
            <span className="text-center">RSVP</span>
            <ExternalLinkIcon className="h-4 w-4 shrink-0" />
          </button>
        </div>
      </div>
      <RsvpModal open={rsvpOpen} onClose={() => setRsvpOpen(false)} href={WITHJOY_RSVP_URL} />
    </>
  )
}

export default FloatingNav
