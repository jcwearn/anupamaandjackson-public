import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminLayout from './AdminLayout'
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

/** Stands in for the hub. */
const Tool: React.FC = () => <p>tool shown</p>

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

const toolShown = () => screen.queryByText('tool shown')

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

  it('shows no gate at all while the lookup is resolving', () => {
    // Mid-lookup isAdmin is false but the guest is not yet identified, so the
    // "not for you" copy would be a lie — and so would the unlock prompt, which
    // an admin the site is in the middle of recognizing would watch flash past.
    setState({ status: 'resolving', isAdmin: false })
    renderAt()

    expect(screen.queryByRole('button', { name: 'Unlock This Page' })).not.toBeInTheDocument()
    expect(screen.queryByText(/We know you as/)).not.toBeInTheDocument()
    expect(toolShown()).not.toBeInTheDocument()
  })

  it('shows no gate before the lookup has started either', () => {
    // 'loading' is the state the page is prerendered in, so whatever this branch
    // renders is what ships in dist/admin/index.html and is painted before any
    // of this has run. A locked card there is a guess, and it was a visible one.
    setState({ status: 'loading', isAdmin: false })
    renderAt()

    expect(screen.queryByRole('button', { name: 'Unlock This Page' })).not.toBeInTheDocument()
    expect(toolShown()).not.toBeInTheDocument()
  })

  it('offers the unlock once the lookup comes back with nobody', () => {
    // The suppression above is a pending state, not a hole in the gate: the
    // moment the answer is in, a visitor the roster doesn't know is asked again.
    setState({ status: 'notFound', isAdmin: false })
    renderAt()

    expect(screen.getByRole('button', { name: 'Unlock This Page' })).toBeInTheDocument()
    expect(toolShown()).not.toBeInTheDocument()
  })
})

describe('AdminLayout for an admin', () => {
  it('shows the hub on the admin tag alone, with no passphrase', () => {
    // The passphrase guarded the roster and the Kerala books, which were taken
    // out of the public index when the tools moved to Wedding HQ. HQ's own
    // login guards them now; the tag only decides who sees the links.
    setState({ status: 'identified', displayName: 'Ada', isAdmin: true })
    renderAt()

    expect(toolShown()).toBeInTheDocument()
    expect(screen.queryByLabelText('Admin passphrase')).not.toBeInTheDocument()
  })
})
