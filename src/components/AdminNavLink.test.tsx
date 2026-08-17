import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminNavLink from './AdminNavLink'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { universalEvents } from '../data/scheduleEvents'
import type { GuestScheduleState } from '../lib/useGuestSchedule'

const state = vi.hoisted(() => ({ current: null as GuestScheduleState | null }))

vi.mock('../lib/useGuestSchedule', () => ({
  useGuestSchedule: () => state.current,
}))

const setState = (overrides: Partial<GuestScheduleState> = {}) => {
  state.current = {
    status: 'anonymous',
    events: universalEvents,
    isAdmin: false,
    candidates: [],
    emailPrompt: false,
    emailFailed: false,
    submitEmail: vi.fn(),
    skipEmail: vi.fn(),
    lookup: vi.fn(),
    chooseCandidate: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  setState()
})

const renderLink = (variant: 'popover' | 'menu' = 'popover', onClick?: () => void) =>
  render(
    <MemoryRouter>
      <GuestScheduleProvider>
        <AdminNavLink variant={variant} onClick={onClick} />
      </GuestScheduleProvider>
    </MemoryRouter>,
  )

describe('AdminNavLink', () => {
  it('points a tagged guest at the admin tools', () => {
    setState({ status: 'identified', displayName: 'Grace', isAdmin: true })
    renderLink()

    expect(screen.getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('href', '/admin')
  })

  it('stays hidden from a guest without the tag', () => {
    setState({ status: 'identified', displayName: 'Grace' })
    renderLink()

    expect(screen.queryByRole('menuitem')).toBeNull()
  })

  it('stays hidden while the lookup is still out', () => {
    // 'loading' is the prerendered default and 'resolving' covers the index
    // fetch and the guest PBKDF2 behind it. isAdmin is false throughout, so the
    // link simply arrives with the answer instead of guessing ahead of it.
    for (const status of ['loading', 'resolving'] as const) {
      setState({ status })
      const { unmount } = renderLink()

      expect(screen.queryByRole('menuitem')).toBeNull()
      unmount()
    }
  })

  it('stays out of layouts that have no guest state', () => {
    // FloatingNav is shared with the invite and save-the-date pages, which sit
    // outside the provider entirely.
    const { container } = render(
      <MemoryRouter>
        <AdminNavLink variant="menu" />
      </MemoryRouter>,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('spells it out in the dropdown, where there is room', () => {
    setState({ status: 'identified', displayName: 'Grace', isAdmin: true })
    renderLink('menu')

    expect(screen.getByRole('menuitem', { name: 'Admin' })).toHaveTextContent('Admin')
  })

  it('trails the label with the cog on both surfaces', () => {
    setState({ status: 'identified', displayName: 'Grace', isAdmin: true })

    for (const variant of ['popover', 'menu'] as const) {
      const { container, unmount } = renderLink(variant)
      const item = container.querySelector('[role="menuitem"]') as HTMLElement
      const cog = item.querySelector('svg')

      expect(cog).not.toBeNull()
      // Order, not just presence: the cog follows the word rather than leading
      // it. compareDocumentPosition is the assertion jsdom can actually make —
      // it has no layout, so "to the right of" is only ever DOM order here.
      expect(item.firstChild?.textContent).toBe('Admin')
      expect(item.compareDocumentPosition(cog!) & Node.DOCUMENT_POSITION_CONTAINED_BY).toBeTruthy()
      expect(cog!.previousSibling?.textContent).toBe('Admin')
      unmount()
    }
  })

  it('hands the dropdown its click back, so the menu can close before navigating', () => {
    const onClick = vi.fn()
    setState({ status: 'identified', displayName: 'Grace', isAdmin: true })
    renderLink('menu', onClick)

    fireEvent.click(screen.getByRole('menuitem', { name: 'Admin' }))

    expect(onClick).toHaveBeenCalled()
  })
})
