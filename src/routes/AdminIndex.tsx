import React from 'react'
import { Link } from 'react-router-dom'
import { ADMIN_NAV_ITEMS } from '../lib/navItems'

/**
 * What each tool is for, in the order the chip row lists them.
 *
 * Keyed off ADMIN_NAV_ITEMS rather than repeating the paths, so a tool added to
 * the row cannot be left off this page — the two going out of step is the one
 * way a new tool ends up unreachable from anywhere.
 */
const TOOL_BLURBS: Record<string, { title: string; blurb: string }> = {
  '/admin/invite-links': {
    title: 'Invite Links',
    blurb: 'Every version of the invitation, and who each one is for.',
  },
  '/admin/guest-summary': {
    title: 'Guest Summary',
    blurb: 'Who has answered, and who still needs asking.',
  },
  '/admin/kerala-trip': {
    title: 'Kerala Trip',
    blurb: 'Rooming, flights and money for the travel agent.',
  },
}

const AdminIndex: React.FC = () => (
  <ul className="flex flex-col gap-4">
    {ADMIN_NAV_ITEMS.filter((item) => item.to in TOOL_BLURBS).map((item) => {
      const { title, blurb } = TOOL_BLURBS[item.to]
      return (
        <li key={item.to}>
          {/* The whole card is the target, not a link buried in it: every one
              of these rows leads exactly one place, and a phone-sized tap
              should not have to find the underlined words. */}
          <Link
            to={item.to}
            className="card block transition-colors hover:bg-lily/20 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
          >
            <span className="font-display text-xl text-rosewood">{title}</span>
            <span className="mt-1 block text-sm text-zeus/80">{blurb}</span>
          </Link>
        </li>
      )
    })}
  </ul>
)

export default AdminIndex
