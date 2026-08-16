import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminLayout from './AdminLayout'
import { useAdminContext } from '../lib/adminContext'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { universalEvents } from '../data/scheduleEvents'
import type { GuestScheduleState } from '../lib/useGuestSchedule'
import type { AdminUnlockState, AdminUnlockStatus } from '../lib/adminUnlock'

const state = vi.hoisted(() => ({ current: null as GuestScheduleState | null }))
const unlockState = vi.hoisted(() => ({ current: null as AdminUnlockState | null }))

vi.mock('../lib/useGuestSchedule', () => ({
  useGuestSchedule: () => state.current,
}))

// The passphrase layer is stubbed here; its crypto is the subject of
// adminUnlock.test.tsx. What this file cares about is that the tools stay
// behind it.
vi.mock('../lib/adminUnlock', () => ({
  useAdminUnlock: () => unlockState.current,
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

const setUnlock = (
  status: AdminUnlockStatus = 'locked',
  overrides: Partial<AdminUnlockState> = {},
) => {
  unlockState.current = {
    status,
    summary: [],
    unlock: vi.fn(),
    forget: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  setState()
  setUnlock()
})

/** Stands in for a real tool, and proves the roster reaches one. */
const Tool: React.FC = () => {
  const { summary } = useAdminContext()
  return <p>tool sees {summary.length} guests</p>
}

const renderAt = (path = '/admin/tool') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <GuestScheduleProvider>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="tool" element={<Tool />} />
          </Route>
        </Routes>
      </GuestScheduleProvider>
    </MemoryRouter>,
  )

const toolShown = () => screen.queryByText(/tool sees/)

describe('AdminLayout gate', () => {
  it('shows an anonymous visitor the way in, not the tools', () => {
    renderAt()

    expect(screen.getByRole('button', { name: 'Unlock This Page' })).toBeInTheDocument()
    expect(toolShown()).not.toBeInTheDocument()
  })

  it('withholds the tools from an identified guest who is not an admin', () => {
    // The gate is the admin tag, not merely being known to the site — every
    // other guest-aware page on the site unlocks on `identified` alone.
    setState({ status: 'identified', displayName: 'Ada', isAdmin: false })
    renderAt()

    expect(toolShown()).not.toBeInTheDocument()
  })

  it('tells an identified non-admin why the section is empty, and offers a way out', () => {
    // GuestGateNotice would print "Showing your invitation, Ada" here — a
    // success message above nothing at all, with no way to correct it.
    const signOut = vi.fn()
    setState({ status: 'identified', displayName: 'Ada', isAdmin: false, signOut })
    renderAt()

    expect(screen.getByText(/We know you as Ada/)).toBeInTheDocument()
    expect(screen.queryByText(/Showing your invitation/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Not you?' }))
    expect(signOut).toHaveBeenCalled()
  })

  it('still offers the unlock while the lookup is resolving', () => {
    // Mid-lookup isAdmin is false but the guest is not yet identified, so the
    // "not for you" copy would be a lie.
    setState({ status: 'resolving', isAdmin: false })
    renderAt()

    expect(screen.getByRole('button', { name: 'Unlock This Page' })).toBeInTheDocument()
  })

  it('withholds the tools from an admin who has not entered the passphrase', () => {
    // The admin tag is who you are; the passphrase is the secret. Carrying the
    // tag alone is not enough, and this is the assertion that says so.
    setState({ status: 'identified', displayName: 'Anupama', isAdmin: true })
    setUnlock('locked')
    renderAt()

    expect(screen.getByLabelText('Admin passphrase')).toBeInTheDocument()
    expect(toolShown()).not.toBeInTheDocument()
  })

  it('hands a submitted passphrase to the unlock hook', () => {
    const unlock = vi.fn()
    setState({ status: 'identified', displayName: 'Anupama', isAdmin: true })
    setUnlock('locked', { unlock })
    renderAt()

    fireEvent.change(screen.getByLabelText('Admin passphrase'), {
      target: { value: 'open sesame' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))

    expect(unlock).toHaveBeenCalledWith('open sesame')
  })

  it('says so when the passphrase was wrong, without showing the tools', () => {
    setState({ status: 'identified', displayName: 'Anupama', isAdmin: true })
    setUnlock('wrong')
    renderAt()

    expect(screen.getByRole('alert')).toHaveTextContent('not the passphrase')
    expect(toolShown()).not.toBeInTheDocument()
  })

  it('shows nothing at all while the index is still loading', () => {
    // Rather than flashing a password field at an admin who unlocked months ago.
    setState({ status: 'identified', displayName: 'Anupama', isAdmin: true })
    setUnlock('loading')
    renderAt()

    expect(screen.queryByLabelText('Admin passphrase')).not.toBeInTheDocument()
    expect(toolShown()).not.toBeInTheDocument()
  })

  it('keeps the tool names off the page until the passphrase is in', () => {
    // The chip row is the section's table of contents. Rendering it to someone
    // still at the passphrase prompt would answer the question being asked.
    setState({ status: 'identified', displayName: 'Anupama', isAdmin: true })
    setUnlock('locked')
    renderAt()

    expect(screen.queryByRole('navigation', { name: 'Admin section' })).not.toBeInTheDocument()
  })
})

describe('AdminLayout once unlocked', () => {
  beforeEach(() => {
    setState({ status: 'identified', displayName: 'Anupama', isAdmin: true })
    setUnlock('unlocked')
  })

  it('renders the tool and hands it the decrypted roster', () => {
    setUnlock('unlocked', {
      summary: [
        { name: 'Ada Lovelace', status: 'none' },
        { name: 'Alan Turing', status: 'attending' },
      ],
    })
    renderAt()

    expect(screen.getByText('tool sees 2 guests')).toBeInTheDocument()
  })

  it('offers the section nav so the tools reach each other', () => {
    renderAt()

    const nav = screen.getByRole('navigation', { name: 'Admin section' })
    expect(nav).toBeInTheDocument()
    // The index chip has to be `end`-matched or it reads as current on every
    // page beneath it; SectionNav derives that from the path depth.
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', '/admin')
  })

  it('offers a way to re-lock the device', () => {
    const forget = vi.fn()
    setUnlock('unlocked', { forget })
    renderAt()

    fireEvent.click(screen.getByRole('button', { name: 'Forget this device' }))
    expect(forget).toHaveBeenCalled()
  })
})
