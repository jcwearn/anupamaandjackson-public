import React, { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { useScrolled } from '../lib/useScrolled'

const navItems = [
  { to: '/engagement', label: 'Home' },
  { to: '/engagement/schedule', label: 'Schedule' },
]

const Navbar: React.FC = () => {
  const [open, setOpen] = useState(false)
  const scrolled = useScrolled()

  return (
    <header
      className={clsx(
        'fixed inset-x-0 top-0 z-50 bg-rosewood border-b border-gold/30 transition-shadow duration-300',
        scrolled && 'shadow-md shadow-rosewood/30',
      )}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <nav className="mx-auto flex h-20 max-w-screen-lg items-center justify-between px-4">
        <Link
          to="/engagement"
          className="font-display text-xl text-cream transition-colors hover:text-peach focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
        >
          A & J
        </Link>
        <button
          className="sm:hidden rounded p-2 text-cream hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
          aria-label="Toggle navigation menu"
          onClick={() => setOpen(!open)}
        >
          ☰
        </button>
        <ul className="hidden gap-6 sm:flex">
          {navItems.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.to === '/engagement'}
                className={({ isActive }) =>
                  clsx(
                    'text-lg font-body transition-colors focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2',
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
      </nav>
      {open && (
        <div className="sm:hidden border-t border-gold/30 bg-rosewood">
          <ul className="flex flex-col items-start gap-2 px-4 py-4">
            {navItems.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.to === '/engagement'}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'block py-2 text-lg font-body',
                      isActive
                        ? 'text-cream font-semibold underline decoration-gold decoration-2 underline-offset-4'
                        : 'text-cream/90',
                    )
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  )
}

export default Navbar
