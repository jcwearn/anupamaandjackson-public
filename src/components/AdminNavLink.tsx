import React from 'react'
import { Link, NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { useGuestScheduleContext } from '../lib/guestScheduleContext'
import { ADMIN_NAV_ITEM } from '../lib/navItems'
import { CogIcon } from '../icons/CogIcon'

interface Props {
  /**
   * Which surface this is on: `popover` is the panel that opens off the guest's
   * name on the bar, `menu` is FloatingNav's dropdown. Both read "Admin" with
   * the cog trailing it; they differ only in the type scale and padding of the
   * list each belongs to. Same split as GuestBadge, whose two surfaces these
   * are.
   */
  variant: 'popover' | 'menu'
  /**
   * Both callers close themselves when the link is used. FloatingNav's handler
   * also defers the navigation past its close animation, so it passes that in
   * rather than this component reproducing it.
   */
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
}

/**
 * The way in to /admin for the family running the guest list.
 *
 * /admin used to be reachable only by typing it, which is a poor way to hand a
 * page to the people who use it most. Showing it costs nothing: AdminLayout
 * gates on this same tag and then on the passphrase, so anyone else who follows
 * the link lands where they land today.
 *
 * Renders on `isAdmin` alone, which is false until a guest record resolves.
 * That is deliberate and is not the flash AdminLayout guards against: a link
 * that appears when the lookup lands is an addition, not a gate being taken
 * back — and it keeps the cog out of the prerendered HTML for free.
 */
const AdminNavLink: React.FC<Props> = ({ variant, onClick }) => {
  const { isAdmin } = useGuestScheduleContext()

  // Also covers the layouts with no guest state at all: the invite and
  // save-the-date pages share FloatingNav, and the context default outside a
  // provider is not an admin.
  if (!isAdmin) return null

  if (variant === 'popover') {
    return (
      <Link
        to={ADMIN_NAV_ITEM.to}
        viewTransition
        role="menuitem"
        onClick={onClick}
        // Sized and spaced to match the sign-out button it sits above, so the
        // panel reads as one list rather than a link bolted onto a note.
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 font-body text-sm text-zeus transition-colors hover:bg-peach/40"
      >
        {ADMIN_NAV_ITEM.label}
        <CogIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      </Link>
    )
  }

  return (
    <NavLink
      to={ADMIN_NAV_ITEM.to}
      viewTransition
      role="menuitem"
      onClick={onClick}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-2 rounded-lg px-3 py-2 font-body text-base transition-colors hover:bg-peach/40',
          isActive
            ? 'text-rosewood font-semibold underline decoration-gold decoration-2 underline-offset-4'
            : 'text-zeus',
        )
      }
    >
      {ADMIN_NAV_ITEM.label}
      <CogIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
    </NavLink>
  )
}

export default AdminNavLink
