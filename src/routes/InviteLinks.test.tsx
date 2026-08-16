import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import InviteLinks from './InviteLinks'
import AdminLayout from '../layouts/AdminLayout'
import { GuestScheduleProvider } from '../lib/GuestScheduleProvider'
import { universalEvents } from '../data/scheduleEvents'
import { SITE_ORIGIN } from '../lib/constants'
import type { GuestScheduleState } from '../lib/useGuestSchedule'
import type { AdminUnlockState, AdminUnlockStatus } from '../lib/adminUnlock'

const state = vi.hoisted(() => ({ current: null as GuestScheduleState | null }))
const unlockState = vi.hoisted(() => ({ current: null as AdminUnlockState | null }))

vi.mock('../lib/useGuestSchedule', () => ({
  useGuestSchedule: () => state.current,
}))

// The passphrase layer is stubbed here; its crypto is the subject of
// adminUnlock.test.tsx. What this file cares about is that the links stay
// behind it.
vi.mock('../lib/adminUnlock', () => ({
  useAdminUnlock: () => unlockState.current,
}))

const writeText = vi.fn(() => Promise.resolve())

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
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
})

// Through the real provider and the real layout, with only the underlying hooks
// stubbed. The gate itself is AdminLayout's, and AdminLayout.test.tsx is where
// it is tested — mounting it here is what puts this page past it.
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/invite-links']}>
      <GuestScheduleProvider>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="invite-links" element={<InviteLinks />} />
          </Route>
        </Routes>
      </GuestScheduleProvider>
    </MemoryRouter>,
  )

const paths = [
  '/invites/wearn/',
  '/invites/tadanki/',
  '/invites/tadanki/reception/',
  '/invites/tadanki/muhurtham/',
]

describe('InviteLinks contents', () => {
  beforeEach(() => {
    setState({ status: 'identified', displayName: 'Anupama', isAdmin: true })
    setUnlock('unlocked')
  })

  it('lists every invite variant with its scope', () => {
    renderPage()

    for (const path of paths) {
      expect(screen.getByText(`${SITE_ORIGIN}${path}`)).toBeInTheDocument()
    }

    // Only /invites/tadanki/muhurtham/ drops the reception card, and only the
    // two narrowed variants drop the sangeet one.
    expect(screen.getAllByText('Sangeet, Muhurtham & Reception')).toHaveLength(2)
    expect(screen.getByText('Muhurtham & Reception')).toBeInTheDocument()
    expect(screen.getByText('Muhurtham only')).toBeInTheDocument()
  })

  it('points each link at the page it names', () => {
    renderPage()

    for (const path of paths) {
      const link = screen.getByRole('link', { name: `${SITE_ORIGIN}${path}` })
      // The visible text is absolute so it can be read off the screen and typed
      // out; the href stays relative so following it routes client-side.
      expect(link).toHaveAttribute('href', path)
    }
  })

  it('copies the production URL, not the one being previewed', () => {
    // window.location.origin is localhost under `vite preview`, and a link
    // copied from there is dead for whoever receives it.
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: `Copy ${SITE_ORIGIN}/invites/wearn/` }))

    expect(writeText).toHaveBeenCalledWith(`${SITE_ORIGIN}/invites/wearn/`)
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument()
  })

  it('offers both invite PDFs for viewing and download', () => {
    renderPage()

    const hrefs = (name: string) =>
      screen.getAllByRole('link', { name }).map((link) => link.getAttribute('href'))

    const files = ['/invites/invite-tadanki.pdf', '/invites/invite-wearn.pdf']
    expect(hrefs('View').sort()).toEqual(files)
    expect(hrefs('Download').sort()).toEqual(files)

    // Without the attribute the browser navigates to the PDF instead of saving
    // it, which makes the two links do the same thing.
    for (const link of screen.getAllByRole('link', { name: 'Download' })) {
      expect(link).toHaveAttribute('download')
    }
  })
})
